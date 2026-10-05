import PocketBase from 'pocketbase';
import type { Task, Goal, DailySnapshot, AIMemory, LearnedPattern, UserPreferences } from '@/types';
import { db, withDeletionsSuppressed } from './db';

/**
 * Local-first sync layer.
 *
 * localStorage (via db.ts) stays the authoritative local cache — the app works
 * fully offline. syncNow() reconciles it with the user's PocketBase account:
 *
 *   1. push deletes  — flush the local deletion queue into sync_deletions
 *                      (and remove the corresponding server record)
 *   2. pull deletes  — apply every not-yet-applied tombstone (tracked by a
 *                      persisted applied-set of server record ids, so no
 *                      device clock is ever compared to another device's)
 *   3. push          — local records newer than remote (or missing) → create/update
 *   4. pull          — remote records newer than local (or missing) → merge into localStorage
 *
 * Conflicts: per-record last-write-wins on `updatedAt` (ISO timestamps).
 */

// Default: same-origin /pb proxy (see rewrites in next.config.ts) so the browser
// CSP ('self') already allows it and no per-device URL is needed. A direct URL
// can still be set at runtime (Settings -> Cloud Sync).
function defaultPbUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/pb`;
  }
  return process.env.NEXT_PUBLIC_PB_URL || 'http://127.0.0.1:8090';
}

const URL_KEY = 'mindsync_pb_url';
const LAST_SYNC_KEY = 'mindsync_last_sync';
const APPLIED_TOMBSTONES_KEY = 'mindsync_applied_tombstones';
const PREFS_APP_ID = 'preferences';

let client: PocketBase | null = null;
let syncInFlight: Promise<SyncResult> | null = null;

export interface SyncResult {
  pushed: number;
  pulled: number;
  deleted: number;
}

function readKey(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function writeKey(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** PocketBase filter values must escape backslash and double quote. */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function getPbUrl(): string {
  return readKey(URL_KEY) || defaultPbUrl();
}

/** Settings screen can point the app at a different PocketBase (advanced; note CSP). */
export function setPbUrl(url: string): void {
  writeKey(URL_KEY, url.trim());
  client = null; // force re-create against the new URL
}

export function getClient(): PocketBase {
  if (!client) client = new PocketBase(getPbUrl());
  return client;
}

export interface SyncUser {
  id: string;
  email: string;
}

export function currentUser(): SyncUser | null {
  const rec = getClient().authStore.record;
  return rec ? { id: rec.id, email: rec.email || '' } : null;
}

export function isSignedIn(): boolean {
  return getClient().authStore.isValid && !!getClient().authStore.record;
}

export async function signIn(email: string, password: string): Promise<SyncUser> {
  const auth = await getClient().collection('users').authWithPassword(email, password);
  return { id: auth.record.id, email: auth.record.email || '' };
}

export function signOut(): void {
  getClient().authStore.clear();
}

interface CollectionBinding<T> {
  collection: string;
  list: () => T[];
  upsert: (record: T) => void;
  appIdOf: (record: T) => string;
  updatedAtOf: (record: T) => string;
}

const bindings: Record<string, CollectionBinding<unknown>> = {
  tasks: {
    collection: 'tasks',
    list: () => db.getTasks(),
    upsert: (t) => db.saveTask(t as Task),
    appIdOf: (r) => (r as Task).id,
    updatedAtOf: (r) => (r as Task).updatedAt || (r as Task).createdAt,
  },
  goals: {
    collection: 'goals',
    list: () => db.getGoals(),
    upsert: (g) => db.saveGoal(g as Goal),
    appIdOf: (r) => (r as Goal).id,
    updatedAtOf: (r) => (r as Goal).updatedAt || (r as Goal).createdAt,
  },
  snapshots: {
    collection: 'snapshots',
    list: () => db.getHistory(),
    upsert: (s) => db.saveSnapshot(s as DailySnapshot),
    appIdOf: (r) => (r as DailySnapshot).date,
    updatedAtOf: (r) => (r as DailySnapshot).updatedAt || (r as DailySnapshot).date, // date serves as fallback clock
  } as CollectionBinding<unknown>,
  memories: {
    collection: 'memories',
    list: () => db.getAiMemory(),
    upsert: (m) => db.addAiMemory(m as AIMemory),
    appIdOf: (r) => (r as AIMemory).id,
    updatedAtOf: (r) => (r as AIMemory).updatedAt || (r as AIMemory).createdAt,
  },
  patterns: {
    collection: 'patterns',
    list: () => db.getLearnedPatterns(),
    upsert: (p) => db.addLearnedPattern(p as LearnedPattern),
    appIdOf: (r) => (r as LearnedPattern).id,
    updatedAtOf: (r) => (r as LearnedPattern).updatedAt || (r as LearnedPattern).createdAt,
  },
};

const deletionsByEntity: Record<string, (appId: string) => void> = {
  tasks: (id) => db.deleteTask(id),
  goals: (id) => db.deleteGoal(id),
  snapshots: (date) => db.deleteSnapshot(date),
  memories: (id) => db.deleteAiMemory(id),
  patterns: (id) => db.deleteLearnedPattern(id),
  settings: () => db.resetPreferences(),
};

/**
 * PocketBase 0.40.x silently ignores field-level `unique: true`, so duplicate
 * rows per appId are possible (e.g. racing devices). Resolve to the newest row
 * and delete the rest — self-heals any server state.
 */
async function resolveRows(
  pb: PocketBase,
  collection: string,
  appId: string
): Promise<Record<string, unknown> | null> {
  const rows = await pb.collection(collection).getFullList({ filter: `appId = "${esc(appId)}"` });
  if (rows.length <= 1) return rows[0] ?? null;
  rows.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
  for (const dup of rows.slice(1)) {
    try { await pb.collection(collection).delete(dup.id); } catch { /* already gone */ }
  }
  return rows[0];
}

async function syncCollection<T>(
  pb: PocketBase,
  binding: CollectionBinding<T>,
  userId: string
): Promise<{ pushed: number; pulled: number }> {
  let local = binding.list();
  let remote = await pb.collection(binding.collection).getFullList();
  const remoteByAppId = new Map(remote.map((r) => [r.appId as string, r]));

  // --- push: local newer (or remote missing) ---
  let pushed = 0;
  for (const record of local) {
    const appId = binding.appIdOf(record);
    const updatedAt = binding.updatedAtOf(record) || nowIso();
    const remoteRec = remoteByAppId.get(appId);
    if (!remoteRec || updatedAt > (remoteRec.updatedAt as string)) {
      // include the authoritative stamp inside data too, so a pull on another
      // device never re-stamps legacy rows with its local clock
      const payload = {
        appId,
        updatedAt,
        data: { ...(record as unknown as Record<string, unknown>), updatedAt },
        user: userId,
      };
      if (remoteRec) await pb.collection(binding.collection).update(remoteRec.id, payload);
      else await pb.collection(binding.collection).create(payload);
      pushed++;
    }
  }

  // --- pull: remote newer (or local missing) ---
  // Re-read local AFTER pushes so mid-sync edits are seen fresh.
  local = binding.list();
  if (pushed > 0) remote = await pb.collection(binding.collection).getFullList();
  const localByAppId = new Map(local.map((r) => [binding.appIdOf(r), r]));
  let pulled = 0;
  for (const rec of remote) {
    const appId = rec.appId as string;
    const localRec = localByAppId.get(appId);
    const localStamp = localRec ? binding.updatedAtOf(localRec) || '' : '';
    if (!localRec || (rec.updatedAt as string) > localStamp) {
      if (process.env.SYNC_DEBUG) console.log(`[sync:debug] pull ${binding.collection} ${appId} remote=${rec.updatedAt} local=${localRec ? localStamp : 'none'}`);
      // preserve the remote stamp inside data as well as at row level
      binding.upsert({ ...(rec.data as object), updatedAt: rec.updatedAt } as T);
      pulled++;
    }
  }
  return { pushed, pulled };
}

async function syncPreferences(pb: PocketBase, userId: string): Promise<{ pushed: number; pulled: number }> {
  const localPrefs = db.getPreferences();
  // Never-modified local prefs have no timestamp — treat as oldest so remote wins,
  // instead of clobbering the server with a fresh "now" stamp.
  const localStamp = localPrefs.updatedAt || '';
  const remote = await resolveRows(pb, 'settings', PREFS_APP_ID);

  if (!remote) {
    const stamp = localStamp || nowIso();
    await pb.collection('settings').create({
      appId: PREFS_APP_ID,
      updatedAt: stamp,
      data: { ...localPrefs, updatedAt: stamp },
      user: userId,
    });
    return { pushed: 1, pulled: 0 };
  }
  const remoteStamp = String(remote.updatedAt ?? '');
  if (localStamp && localStamp > remoteStamp) {
    await pb.collection('settings').update(remote.id as string, {
      updatedAt: localStamp,
      data: { ...localPrefs, updatedAt: localStamp },
      user: userId,
    });
    return { pushed: 1, pulled: 0 };
  }
  if (remoteStamp > localStamp) {
    const remotePrefs = remote.data as UserPreferences & { updatedAt: string };
    db.savePreferences(remotePrefs); // keeps remote updatedAt (db stamp is absent-preserving)
    return { pushed: 0, pulled: 1 };
  }
  return { pushed: 0, pulled: 0 };
}

/** Deletes the underlying record for an entity+appId, so pulls can't resurrect it. */
async function deleteRemoteRecord(pb: PocketBase, entity: string, appId: string): Promise<void> {
  const collection = entity === 'settings' ? 'settings' : bindings[entity]?.collection;
  if (!collection) return;
  const rows = await pb.collection(collection).getFullList({ filter: `appId = "${esc(appId)}"` });
  for (const row of rows) {
    try { await pb.collection(collection).delete(row.id); } catch { /* already gone */ }
  }
}

/** Applied-tombstone ledger (server record ids are never reused/compared to clocks). */
function getAppliedTombstones(): string[] {
  try {
    return JSON.parse(readKey(APPLIED_TOMBSTONES_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

function markTombstonesApplied(ids: string[]): void {
  if (!ids.length) return;
  const merged = [...new Set([...getAppliedTombstones(), ...ids])];
  writeKey(APPLIED_TOMBSTONES_KEY, JSON.stringify(merged.slice(-500)));
}

async function pushDeletions(pb: PocketBase, userId: string): Promise<number> {
  const queue = db.getDeletionQueue();
  let pushed = 0;
  for (const t of queue) {
    try {
      await pb.collection('sync_deletions').create({
        appId: t.appId,
        entity: t.entity,
        deletedAt: t.deletedAt,
        user: userId,
      });
      // remove the underlying server record too — tombstone rows alone would let a pull resurrect it
      await deleteRemoteRecord(pb, t.entity, t.appId);
      db.removeDeletion(t.entity, t.appId); // checkpoint per item
      pushed++;
    } catch {
      // keep this item queued; it will retry on the next sync
    }
  }
  return pushed;
}

async function pullDeletions(pb: PocketBase): Promise<number> {
  const remoteTombstones = await pb.collection('sync_deletions').getFullList();
  const applied = new Set(getAppliedTombstones());
  let appliedNow = 0;
  for (const t of remoteTombstones) {
    if (applied.has(t.id)) continue;
    const remove = deletionsByEntity[t.entity as string];
    if (remove) {
      try {
        withDeletionsSuppressed(() => remove(t.appId as string));
        appliedNow++;
        applied.add(t.id);
      } catch { /* skip */ }
    } else {
      applied.add(t.id); // unknown entity: don't retry forever
    }
  }
  markTombstonesApplied([...applied]);
  return appliedNow;
}

/**
 * Reconcile localStorage with PocketBase. Rejects if not signed in or offline —
 * callers should treat failure as a silent no-op (local data is untouched).
 * Concurrent calls are serialized: the in-flight promise is shared.
 */
export async function syncNow(): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSync().finally(() => { syncInFlight = null; });
  return syncInFlight;
}

async function runSync(): Promise<SyncResult> {
  const pb = getClient();
  if (!isSignedIn()) throw new Error('Not signed in');
  const userId = pb.authStore.record!.id;

  // 1. push local deletions (writes tombstones + removes server records)
  const pushedDeletions = await pushDeletions(pb, userId);

  // 2. pull remote deletions BEFORE pushing changes — otherwise this device
  //    would re-upload its stale copy of a record another device deleted
  const deleted = await pullDeletions(pb);

  let pushed = pushedDeletions;
  let pulled = 0;
  for (const binding of Object.values(bindings)) {
    const r = await syncCollection(pb, binding, userId);
    pushed += r.pushed;
    pulled += r.pulled;
  }
  const prefs = await syncPreferences(pb, userId);
  pushed += prefs.pushed;
  pulled += prefs.pulled;

  writeKey(LAST_SYNC_KEY, nowIso()); // informational only (UI "last sync")
  return { pushed, pulled, deleted };
}

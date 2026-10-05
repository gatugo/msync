#!/usr/bin/env node
/**
 * tools/sync-smoke-test.ts — end-to-end verification of the MindSync sync layer
 * against a live PocketBase, using two simulated devices (isolated localStorage).
 *
 * Prereqs:
 *   - PocketBase running (local binary or `docker compose up pocketbase`)
 *   - `node tools/pb-setup.mjs` has created the collections
 *   - test users exist: user-a@mindsync.local / user-b@mindsync.local (same password)
 *     (create one account in the PocketBase admin UI and set TEST_EMAIL/TEST_PASSWORD,
 *      or reuse user-b as the same account via a second device profile)
 *
 * Run:  npx tsx tools/sync-smoke-test.ts
 * Env:  PB_URL (default http://127.0.0.1:8090), TEST_EMAIL, TEST_PASSWORD
 */

class MemoryStorage {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

async function main() {
  const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
  const email = process.env.TEST_EMAIL || 'user-a@mindsync.local';
  const password = process.env.TEST_PASSWORD || 'test-pass-123';

  // Minimal browser globals for the client-side-only modules
  const storageA = new MemoryStorage();
  const storageB = new MemoryStorage();
  const setDevice = (s: MemoryStorage) => {
    (globalThis as Record<string, unknown>).localStorage = s;
    (globalThis as Record<string, unknown>).window = { localStorage: s };
  };

  process.env.NEXT_PUBLIC_PB_URL = URL;
  const sync = await import('../src/lib/sync');
  const { db } = await import('../src/lib/db');

  // --- reset: wipe prior test data so runs are deterministic ---
  {
    const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@mindsync.local';
    const adminPass = process.env.PB_ADMIN_PASSWORD || 'mindsync-admin-123';
    const { default: PocketBase } = await import('pocketbase');
    const admin = new PocketBase(URL);
    await admin.admins.authWithPassword(adminEmail, adminPass);
    for (const coll of ['tasks', 'goals', 'snapshots', 'memories', 'patterns', 'settings', 'sync_deletions']) {
      const rows = await admin.collection(coll).getFullList();
      for (const row of rows) await admin.collection(coll).delete(row.id);
    }
    console.log(`· reset done (prior test records cleared)`);
  }

  // --- Device A: sign in, seed local data, push ---
  setDevice(storageA);
  await sync.signIn(email, password);
  const t1 = '2030-01-01T00:00:00.000Z';
  db.saveTask({ id: 'a1', title: 'write plan', type: 'ADULT', status: 'TODO', createdAt: t1 });
  db.saveGoal({ id: 'g1', title: 'launch', targetDate: '2030-02-01', completed: false, createdAt: t1 });
  db.savePreferences({ hobbies: ['chess'] });
  const r1 = await sync.syncNow();
  check('A first sync pushes task+goal+prefs', r1.pushed >= 3, JSON.stringify(r1));

  // --- Device B: fresh profile, same account ---
  setDevice(storageB);
  await sync.signIn(email, password);
  const r2 = await sync.syncNow();
  check('B pulls A task', db.getTasks().some((t) => t.id === 'a1'), JSON.stringify(r2));
  check('B pulls A goal', db.getGoals().some((g) => g.id === 'g1'));
  check('B pulls A preferences', db.getPreferences().hobbies.includes('chess'));

  // --- B edits, A receives (LWW) ---
  db.saveTask({ id: 'a1', title: 'write plan (edited on B)', type: 'ADULT', status: 'DONE', createdAt: t1, updatedAt: '2031-01-01T00:00:00.000Z' });
  const r3 = await sync.syncNow();
  check('B pushes edit', r3.pushed >= 1, JSON.stringify(r3));

  setDevice(storageA);
  await sync.syncNow();
  const aTask = db.getTasks().find((t) => t.id === 'a1');
  check('A receives B edit (LWW)', aTask?.status === 'DONE' && !!aTask?.title.includes('edited on B'), aTask?.title);

  // --- A deletes, tombstone propagates to B ---
  db.deleteTask('a1');
  check('A queues tombstone', db.getDeletionQueue().length === 1);
  await sync.syncNow();

  setDevice(storageB);
  await sync.syncNow();
  check('B has task removed', !db.getTasks().some((t) => t.id === 'a1'));

  // --- idempotency: no changes -> nothing pushed ---
  setDevice(storageA);
  const r4 = await sync.syncNow();
  check('re-sync is a no-op', r4.pushed === 0 && r4.pulled === 0, JSON.stringify(r4));

  // --- REGRESSION: delayed-peer-sync tombstone (finding: watermark clock crossing) ---
  // A deletes OFFLINE (queue only), B syncs first, THEN A syncs. B must still
  // receive the deletion and must NOT resurrect the record by re-pushing it.
  {
    const { default: PocketBase } = await import('pocketbase');
    const probe = new PocketBase(URL);
    await probe.collection('users').authWithPassword(email, password);

    setDevice(storageA);
    db.saveTask({ id: 'late1', title: 'deleted offline', type: 'REST', status: 'TODO', createdAt: '2029-01-01T00:00:00.000Z', updatedAt: '2029-01-01T00:00:00.000Z' });
    await sync.syncNow(); // pushed to server
    check('late-tombstone setup: server has task', (await probe.collection('tasks').getFullList({ filter: 'appId = "late1"' })).length === 1);

    db.deleteTask('late1'); // LOCAL delete, no sync yet (simulates offline window)

    setDevice(storageB);
    await sync.syncNow(); // B syncs inside A's offline window
    check('delayed-peer: B still has task before A syncs', db.getTasks().some((t) => t.id === 'late1'));

    setDevice(storageA);
    await sync.syncNow(); // A's delayed push: tombstone + server-row delete

    setDevice(storageB);
    await sync.syncNow(); // B must NOT re-push its stale copy
    check('delayed-peer: deletion reaches B', !db.getTasks().some((t) => t.id === 'late1'));
    setDevice(storageA);
    await sync.syncNow();
    check('delayed-peer: no resurrection on A', !db.getTasks().some((t) => t.id === 'late1'));
  }

  // --- REGRESSION: duplicate appId rows heal (finding: no-op unique index) ---
  {
    const { default: PocketBase } = await import('pocketbase');
    const probe = new PocketBase(URL);
    const probeAuth = await probe.collection('users').authWithPassword(email, password);
    const probeUserId = probeAuth.record.id;
    await probe.collection('settings').create({ appId: 'preferences', updatedAt: '2028-01-01T00:00:00.000Z', data: { hobbies: ['dup-old'] }, user: probeUserId });
    await probe.collection('settings').create({ appId: 'preferences', updatedAt: '2028-02-01T00:00:00.000Z', data: { hobbies: ['dup-new'] }, user: probeUserId });
    setDevice(storageB);
    db.savePreferences({ hobbies: ['dup-new'], updatedAt: '2028-02-01T00:00:00.000Z' });
    await sync.syncNow();
    const rows = await probe.collection('settings').getFullList({ filter: 'appId = "preferences"' });
    check('duplicate rows healed to one', rows.length === 1, `${rows.length} rows`);
    check('newest duplicate kept', (rows[0]?.data as { hobbies?: string[] })?.hobbies?.[0] === 'dup-new', JSON.stringify(rows[0]?.data));
  }

  // --- REGRESSION: erase flow wipes server + does not resurrect ---
  {
    const { default: PocketBase } = await import('pocketbase');
    const probe = new PocketBase(URL);
    await probe.collection('users').authWithPassword(email, password);
    setDevice(storageA);
    db.saveTask({ id: 'e1', title: 'to be erased', type: 'ADULT', status: 'TODO', createdAt: '2029-03-01T00:00:00.000Z', updatedAt: '2029-03-01T00:00:00.000Z' });
    db.saveGoal({ id: 'e2', title: 'to be erased', targetDate: '2029-04-01', completed: false, createdAt: '2029-03-01T00:00:00.000Z', updatedAt: '2029-03-01T00:00:00.000Z' });
    await sync.syncNow();
    // simulate the store's clearAllData erase at the sync level: tombstone everything + sync
    db.getTasks().forEach((t) => db.queueDeletion('tasks', t.id));
    db.getGoals().forEach((g) => db.queueDeletion('goals', g.id));
    await sync.syncNow();
    check('erase: server has no tasks', (await probe.collection('tasks').getFullList()).length === 0);
    check('erase: server has no goals', (await probe.collection('goals').getFullList()).length === 0);
    setDevice(storageB);
    await sync.syncNow();
    check('erase: deletions propagate to other device', db.getTasks().length === 0 && db.getGoals().length === 0);
  }

  // --- offline: unreachable server fails cleanly, local data intact ---
  setDevice(storageA);
  const tasksBefore = db.getTasks().length;
  sync.setPbUrl('http://127.0.0.1:9999');
  let threw = false;
  try { await sync.syncNow(); } catch { threw = true; }
  check('offline sync throws (caller treats as no-op)', threw);
  check('local data untouched after failed sync', db.getTasks().length === tasksBefore, `${tasksBefore} tasks`);
  sync.setPbUrl(URL);

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('smoke test crashed:', e); process.exit(1); });

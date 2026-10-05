# MindSync Sync Documentation

**Created:** 2026-10-05 01:36

---

## How Sync Works in MindSync

The sync system is local-first, opt-in, and PocketBase-backed. Here's the full picture:

---

### 1. Core Principle: Local-First

- Every task, goal, and preference saves to browser localStorage immediately via src/lib/db.ts.
- The app works fully offline — no network required for any core feature.
- Sync is opt-in: users sign in via Settings → Data Lab → Cloud Sync.
- Your AI API key never leaves your device — it's never synced.

---

### 2. What Gets Synced

Three record types:

| Type   | LocalStorage key  | PocketBase collection |
| ━━━━━  | ━━━━━━━━━━━━━━━━  | ━━━━━━━━━━━━━━━━━━━━━ |
| Tasks  | mindsync-tasks    | tasks                 |
| Goals  | mindsync-goals    | goals                 |
| Prefs  | mindsync-prefs    | prefs                 |

---

### 3. The Sync Engine (src/lib/sync.ts)

When a user signs in (or on app load if already signed in), the sync loop runs:

1. Push local changes   → PocketBase
2. Pull remote deletions ← PocketBase (tombstones)
3. Push/pull records    → by updatedAt (newer wins)
4. Pull remaining changes ← PocketBase

Serialized: only one sync can run at a time; subsequent calls are debounced/queued.

---

### 4. Conflict Resolution: Last-Write-Wins (LWW)

- Every record carries an updatedAt timestamp (ISO string, UTC).
- On conflict (same record changed on two devices), newer updatedAt wins.
- No manual merge UI — deterministic and simple.

---

### 5. Deletions: Tombstones + Server Removal

When you delete a task/goal/pref locally:

1. A tombstone row is written to PocketBase (deleted: true, updatedAt set).
2. The server record is also removed from its main table.
3. Other devices pull tombstones and remove their local copy.
4. A ledger (_deletionQueue in localStorage) tracks which items have been tombstoned, with per-item checkpoints, so deletions survive app restarts and propagate reliably.

> This prevents a deleted task from being resurrected by another device's stale copy.

---

### 6. Self-Healing: Duplicate Row Detection

PocketBase assigns a random id to each new record. If the same record somehow ends up with two different IDs (e.g., created offline on two devices before first sync), the sync layer:

- Detects duplicates by matching on a content hash of the record fields.
- Marks the older copy as a tombstone.
- Keeps the newer updatedAt copy as canonical.

---

### 7. Auto-Sync on App Load

When the app starts:

- If a PocketBase auth token exists in localStorage (mindsync-pb-token), sync runs automatically.
- Runs once per session (unless manually triggered via "Sync now").
- If the token is expired/invalid, the user is signed out silently.

---

### 8. The Sync Panel UI (src/components/SyncPanel.tsx)

| Element  | Purpose |
| ━━━━━━━━━ | ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ |
| Sign in  | Email + password → PocketBase auth token stored locally |
| Sync now | Manual trigger (also shows last-sync timestamp) |
| Sign out | Clears local token; does not delete remote data |
| Status   | Shows current state: synced / syncing / error |
| Erase All Data | Tombstones every local record, signs out, wipes localStorage — next sync propagates deletions everywhere |

---

### 9. Transport: Same-Origin /pb Proxy

The browser never talks to http://localhost:8090 directly. Instead, next.config.ts rewrites /pb/* → http://localhost:8090/*.

Why this matters:

- Keeps CSP connect-src 'self' satisfied (no cross-origin requests).
- Phones/LAN devices accessing the app via http://<pc-ip>:3000 sync without any per-device URL config.
- The proxy is handled entirely server-side (Next.js edge/Node).

> Direct cross-origin PocketBase URLs (Settings → Data Lab URL field) are supported but fall outside the CSP allowlist — the /pb path is the supported configuration.

---

### 10. Schema & Isolation (tools/pb-setup.mjs)

The bootstrap script creates 7 PocketBase collections with owner-based isolation:

- Each record has an owner field (the PocketBase user ID).
- A composite unique index on (owner, appId) prevents cross-user collisions.
- appId is a constant (mindsync) scoped to this app.
- The script is idempotent — safe to re-run.

---

### 11. Data Model Timestamps (src/lib/db.ts)

Every mutator (addTask, updateTask, deleteTask, etc.) stamps updatedAt = new Date().toISOString() before writing to localStorage. This timestamp is what drives LWW during sync.

---

### 12. Known Limitations

| Limitation | Impact | Workaround |
| ━━━━━━━━━━━━━━━━━━━━━━━ | ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ | ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ |
| Daily snapshots keyed by device-local date | Devices in different timezones write separate snapshot rows for the same calendar day | Acceptable — task/goal/pref sync unaffected |
| Direct cross-origin PocketBase URL | Outside CSP, may be SW-cached | Use default /pb proxy |
| "Erase All Data" while offline | Tombstones queue locally and flush on next sign-in | Expected behavior — propagates eventually |
| pb_data/ is gitignored | No versioned backup of sync DB | User responsible for their own backups (Export JSON or copy pb_data/) |

---

### 13. Verification

The smoke test (tools/sync-smoke-test.ts) covers 20 checks including:

- Two simulated devices (different users)
- Delayed-peer-sync deletion (the original tombstone watermark bug)
- Duplicate-row self-healing
- Erase propagation
- Idempotent re-sync
- Clean offline failure

Run it: `npx tsx tools/sync-smoke-test.ts` (needs PocketBase running + test user).

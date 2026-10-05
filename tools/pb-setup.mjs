#!/usr/bin/env node
/**
 * tools/pb-setup.mjs — PocketBase schema bootstrap for MindSync sync
 *
 * Idempotently creates the 7 sync collections (+ user-based isolation rules)
 * against a running PocketBase instance. Safe to re-run: existing collections
 * are left untouched (checked by name).
 *
 * Usage:
 *   node tools/pb-setup.mjs \
 *     --url http://127.0.0.1:8090 \
 *     --email admin@mindsync.local \
 *     --password mindsync-admin-123
 *
 * Env fallbacks: PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
 *
 * Collection model (per signed-in user):
 *   tasks, goals, snapshots, memories, patterns, settings, sync_deletions
 * Data-bearing collections store the whole app record as JSON in `data`,
 * keyed by its app-side id in `appId`. `updatedAt` drives last-write-wins
 * merging. Per-user isolation comes from the owner-based rules, and per-user
 * uniqueness from a composite (user, appId) unique index — a field-level
 * `unique: true` is silently ignored by PocketBase 0.40.x, and a plain global
 * unique index would collide across users.
 */

import PocketBase from "pocketbase";

// --- arg parsing (no deps) ---
const args = process.argv.slice(2);
const flag = (name, env) => {
  const i = args.indexOf(`--${name}`);
  return (i >= 0 && args[i + 1]) || process.env[env] || null;
};

const URL = flag("url", "PB_URL") || "http://127.0.0.1:8090";
const EMAIL = flag("email", "PB_ADMIN_EMAIL");
const PASSWORD = flag("password", "PB_ADMIN_PASSWORD");

if (!EMAIL || !PASSWORD) {
  console.error(
    "Missing superuser credentials. Pass --email/--password or set PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD."
  );
  process.exit(1);
}

const pb = new PocketBase(URL);
const authed = `@request.auth.id = user.id`; // owner-only rule

const DATA_COLLECTIONS = [
  { name: "tasks", note: "appId = Task.id" },
  { name: "goals", note: "appId = Goal.id" },
  { name: "snapshots", note: "appId = DailySnapshot.date (one per day)" },
  { name: "memories", note: "appId = AIMemory.id" },
  { name: "patterns", note: "appId = LearnedPattern.id" },
  { name: "settings", note: 'single record, appId = "preferences"' },
];

const DELETIONS_COLLECTION = { name: "sync_deletions" };

function baseFields(withJson) {
  const fields = [
    { name: "appId", type: "text", required: true },
    { name: "updatedAt", type: "text", required: true },
  ];
  if (withJson) fields.push({ name: "data", type: "json" });
  return fields;
}

/** Per-user uniqueness: (user, appId). A field-level unique:true is a no-op in PB 0.40.x. */
function userAppIdIndex(name) {
  return `CREATE UNIQUE INDEX \`idx_${name}_user_appId\` ON \`${name}\` (\`user\`, \`appId\`)`;
}

async function main() {
  await pb.admins.authWithPassword(EMAIL, PASSWORD);
  console.log(`✓ authenticated as superuser on ${URL}`);

  const existing = new Set((await pb.collections.getFullList()).map((c) => c.name));

  for (const { name } of DATA_COLLECTIONS) {
    if (existing.has(name)) {
      console.log(`· ${name} — already exists, skipped`);
      continue;
    }
    try {
      await pb.collections.create({
        name,
        type: "base",
        fields: [
          ...baseFields(true),
          { name: "user", type: "relation", required: true, collectionId: "_pb_users_auth_", cascadeDelete: true },
        ],
        indexes: [userAppIdIndex(name)],
        listRule: authed,
        viewRule: authed,
        createRule: authed,
        updateRule: authed,
        deleteRule: authed,
      });
      console.log(`✓ ${name} — created`);
    } catch (err) {
      console.warn(`! ${name} — could not create cleanly (${err.message}); re-running after fixing duplicates may help`);
    }
  }

  if (existing.has(DELETIONS_COLLECTION.name)) {
    console.log(`· ${DELETIONS_COLLECTION.name} — already exists, skipped`);
  } else {
    await pb.collections.create({
      name: DELETIONS_COLLECTION.name,
      type: "base",
      fields: [
        { name: "appId", type: "text", required: true },
        { name: "entity", type: "text", required: true },
        { name: "deletedAt", type: "text", required: true },
        { name: "user", type: "relation", required: true, collectionId: "_pb_users_auth_", cascadeDelete: true },
      ],
      listRule: authed,
      viewRule: authed,
      createRule: authed,
      updateRule: authed,
      deleteRule: authed,
    });
    console.log(`✓ ${DELETIONS_COLLECTION.name} — created`);
  }

  const after = await pb.collections.getFullList();
  const names = after.map((c) => c.name).sort();
  const want = [...DATA_COLLECTIONS.map((c) => c.name), DELETIONS_COLLECTION.name].sort();
  const missing = want.filter((n) => !names.includes(n));
  if (missing.length) {
    console.error(`✗ missing collections: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`✓ verified: ${want.length} sync collections present`);
  console.log(
    "\nNext: PocketBase admin UI (http://127.0.0.1:8090/_/) → create your app user (email+password),\n" +
      "then sign in from MindSync Settings → Cloud Sync."
  );
}

main().catch((err) => {
  console.error("pb-setup failed:", err.message || err);
  process.exit(1);
});

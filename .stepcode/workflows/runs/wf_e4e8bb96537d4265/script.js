const REPO = 'C:/Users/mela/.aiprojects_2/mindsync';

const CONTEXT = `
MindSync project at ${REPO}. A local-first sync feature was just added:
- src/lib/sync.ts  — PocketBase sync layer (push/pull, LWW by updatedAt, tombstones)
- src/lib/db.ts    — localStorage persistence + deletion queue + updatedAt stamping
- src/store/useStore.ts — Zustand store, sync actions, hydration in fetchInitialData
- src/types.ts     — updatedAt fields
- src/components/SyncPanel.tsx — sync UI
- next.config.ts   — output: 'standalone'
- Dockerfile, docker-compose.yml, .dockerignore — app + pocketbase (adrianmusante/pocketbase:0.40.4)
- tools/pb-setup.mjs — schema bootstrap; tools/sync-smoke-test.ts — two-device E2E test (all passing)
Design intent: localStorage stays authoritative offline; sync is best-effort; conflicts = last-write-wins per record; deletions via tombstone rows + server-side record deletion. PocketBase collection rules are owner-based (@request.auth.id = user.id).
`;

const reviewSchema = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          location: { type: 'string', description: 'function/line if known' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          description: { type: 'string' },
          evidence: { type: 'string', description: 'concrete code quote or reasoning chain' },
        },
        required: ['file', 'severity', 'description', 'evidence'],
      },
    },
  },
  required: ['findings'],
};

const verifySchema = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['valid', 'invalid', 'partial'] },
    reason: { type: 'string' },
    suggestedFix: { type: 'string' },
  },
  required: ['verdict', 'reason'],
};

const dims = [
  { id: 'sync-correctness', focus: 'src/lib/sync.ts, src/store/useStore.ts, src/lib/db.ts — LWW logic, tombstone ordering/resurrection, offline failure paths, idempotency, clock/timezone edge cases, concurrent multi-device edits, settings merge, filter-injection in PB queries (appId interpolation)' },
  { id: 'data-safety', focus: 'localStorage remains authoritative offline; no data loss on sync failure; deletion queue durability; export/import (exportData/importData) still correct; clearAll/resetStore interactions; what happens if PocketBase is wiped/unreachable mid-session; auth token handling' },
  { id: 'backward-compat', focus: 'pre-existing records with NO updatedAt (legacy localStorage data); old exported JSON import; unchanged app behavior for users who never enable sync; SSR/hydration behavior changes in fetchInitialData; PWA service worker (public/sw.js) caching of new code' },
  { id: 'deployment', focus: 'Dockerfile (standalone layout, node:24-alpine, user perms), docker-compose.yml (ports, env NEXT_PUBLIC_PB_URL browser-resolution, volumes), .dockerignore, CSP header in next.config.ts vs new runtime needs, package.json/pocketbase dep, tsconfig scope including tools/*.ts' },
];

// Phase 1 — parallel dimension reviewers (read-only; report only)
const reviews = await parallel(dims.map((d) => () => agent(
  `You are a meticulous code reviewer. Repository: ${REPO}. ${CONTEXT}
Review ONLY this dimension: ${d.focus}
Read the actual files. Report REAL defects (correctness, data loss, security, regression) — not style nits. Every finding needs a concrete evidence quote or precise reasoning. If the dimension is clean, return an empty findings array. Be skeptical of your own findings before reporting.`,
  { schema: reviewSchema, label: `review:${d.id}` }
)));

const findings = [];
reviews.filter(Boolean).forEach((r, i) => {
  (r.findings || []).forEach((f, j) => {
    findings.push({ ...f, dim: dims[i].id, key: `${i}-${j}` });
  });
});
log(`phase 1: ${findings.length} raw findings across ${dims.length} dimensions`);
if (!findings.length) return { confirmed: [], raw: 0 };

// Phase 2 — adversarial verification: two independent verifiers per finding.
// A finding survives only if it is NOT refuted by both verifiers.
const verdicts = await parallel(findings.map((f) => () => Promise.all([
  agent(
    `You are an adversarial verifier. Someone claims the following defect in ${REPO}. ${CONTEXT}
CLAIM (${f.dim}): ${f.description}
Evidence given: ${f.evidence}
Open the code and verify independently. Is the claim correct as stated? Accept 'valid' only if you confirmed the defect by reading the code; 'partial' if real but mis-stated; 'invalid' if refuted.`,
    { schema: verifySchema, label: `verify-a:${f.key}` },
  ),
  agent(
    `Independent second verification (do not assume the claim is true; try to refute it). ${CONTEXT}
CLAIM (${f.dim}): ${f.description}
Evidence given: ${f.evidence}
Read the code yourself and judge: valid / partial / invalid, with reasoning and a concrete fix if warranted.`,
    { schema: verifySchema, label: `verify-b:${f.key}` },
  ),
]).then(([a, b]) => ({ finding: f, a, b }))));

const outcome = verdicts.filter(Boolean).map((v) => {
  const votes = [v.a?.verdict, v.b?.verdict].filter(Boolean);
  const refutedByBoth = votes.length === 2 && votes.every((x) => x === 'invalid');
  return {
    dim: v.finding.dim,
    file: v.finding.file,
    location: v.finding.location || '',
    severity: v.finding.severity,
    description: v.finding.description,
    votes,
    survives: !refutedByBoth,
    reasons: [v.a?.reason, v.b?.reason].filter(Boolean),
    suggestedFix: v.a?.suggestedFix || v.b?.suggestedFix || '',
  };
});

const confirmed = outcome.filter((o) => o.survives);
log(`phase 2: ${outcome.length - confirmed.length} refuted by both verifiers; ${confirmed.length} confirmed`);
return { raw: findings.length, confirmed, refuted: outcome.filter((o) => !o.survives) };
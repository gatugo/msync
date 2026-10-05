/** Local-calendar day helpers shared by the store, UI, and sync (snapshot keys). */

/** Today's date key in the device's local timezone (YYYY-MM-DD). */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Converts an ISO timestamp to the local-timezone date key.
 * `completedAt` is stored as UTC ISO; comparing its string prefix to a local
 * date breaks for timezones off UTC — always convert explicitly.
 * Returns null for missing/invalid input.
 */
export function isoToLocalDateKey(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

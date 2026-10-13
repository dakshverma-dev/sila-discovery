/**
 * Fixed-window, per-instance rate limiter for public endpoints such as sandbox
 * creation. Serverless instances do not share memory, so this is a best-effort
 * guard; the per-group run lock and call budgets in the database remain the
 * authoritative protection for provider quota (RISK13).
 */
const windows = new Map<string, { start: number; count: number }>();

export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) windows.clear();
    return true;
  }
  if (w.count >= limit) return false;
  w.count++;
  return true;
}

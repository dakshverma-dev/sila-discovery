import { timingSafeEqual } from "node:crypto";
import { failure, handle, success } from "@/lib/api/http";
import { runSilaTick } from "@/lib/sila/commands/worker";

/**
 * Sila worker pass (§12, §22): schedule payment openings, open payment at the
 * staffed release, record delays and close sessions that did not fill.
 * Requires the worker trigger secret as a bearer token, exactly as
 * /api/v1/internal/tick does (WORKER_TRIGGER_SECRET, or Vercel Cron's CRON_SECRET).
 */
function authorised(request: Request): boolean {
  const secret = process.env.WORKER_TRIGGER_SECRET || process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST = handle<unknown>(async (request) => {
  if (!authorised(request)) return failure("AUTH_REQUIRED", "Worker authentication required.");
  return success(await runSilaTick());
});

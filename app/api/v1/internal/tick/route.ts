import { timingSafeEqual } from "node:crypto";
import { failure, handle, success } from "@/lib/api/http";
import { processMatchRun } from "@/lib/agent/run";
import { callApi } from "@/lib/db/api";
import { getPool } from "@/lib/db/pool";

/**
 * Scheduled maintenance (D10, D23): expire proposals at their database
 * deadline, fail runs past their deadline, recover runs whose worker lease
 * lapsed, and purge expired sandboxes. Requires the worker trigger secret;
 * Vercel Cron sends it as a bearer token (CRON_SECRET).
 */
function authorised(request: Request): boolean {
  const secret = process.env.WORKER_TRIGGER_SECRET || process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function tick(request: Request): Promise<Response> {
  if (!authorised(request)) return failure("AUTH_REQUIRED", "Worker authentication required.");
  const pool = getPool();
  const scalar = async (fn: string) =>
    (await pool.query<{ n: number }>(`select scb_api.${fn}() as n`)).rows[0]?.n ?? 0;
  const expired = await scalar("expire_proposals");
  const failed = await scalar("fail_stale_match_runs");
  const recoverable = await callApi<{ run_ids: string[] }>("list_recoverable_match_runs", []);
  const recovered = recoverable.ok
    ? await Promise.all(recoverable.data.run_ids.map((id) => processMatchRun(id)))
    : [];
  const purged = await scalar("purge_expired_demos");
  return success({ expired_proposals: expired, failed_runs: failed, recovered_runs: recovered.length, purged_sandboxes: purged });
}

export const GET = handle<unknown>(tick);
export const POST = handle<unknown>(tick);

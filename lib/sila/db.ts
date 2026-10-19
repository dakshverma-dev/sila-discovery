import type { Pool } from "pg";
import { toParam, type ApiResult } from "@/lib/db/api";
import { getPool } from "@/lib/db/pool";

/** Guarded `sila_api` functions the server may call. Later slices append here. */
export const SILA_FUNCTIONS = [
  "ensure_person",
  "get_my_context",
  "create_venue",
  "add_venue_member",
  "revoke_venue_member",
  "save_session_draft",
  "get_venue_session",
  "list_venue_sessions",
  "publish_session",
  "get_public_session",
  "set_session_intake",
  "submit_plan",
  "get_my_plan",
  "list_my_plans",
  "list_session_requests",
  "post_plan_message",
  "approve_plan",
  "decline_plan",
  "commit_plan",
  "get_schedule_inputs",
  "schedule_payment_opening",
  "list_session_work",
  "release_payment_opening",
  "block_payment_opening",
  "close_unfilled_session",
  "reschedule_payment_opening",
  "withdraw_plan",
  "report_payment",
  "record_receipt",
  "confirm_session",
  "close_session",
  "record_refund",
  "close_decision_sessions",
  "get_practical_summary",
] as const;

export type SilaFunction = (typeof SILA_FUNCTIONS)[number];

/** Calls a `sila_api` function with positional parameters and returns its envelope. */
export async function callSila<T>(
  fn: SilaFunction,
  args: readonly unknown[],
  pool: Pool = getPool(),
): Promise<ApiResult<T>> {
  // Function names come only from the allowlist; never interpolate user input into SQL.
  if (!SILA_FUNCTIONS.includes(fn)) throw new Error(`Unknown Sila function ${fn}`);
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await pool.query<{ result: ApiResult<T> }>(
    `select sila_api.${fn}(${placeholders}) as result`,
    args.map(toParam),
  );
  const result = rows[0]?.result;
  if (!result || typeof result !== "object" || !("ok" in result)) {
    throw new Error(`Malformed result from sila_api.${fn}`);
  }
  return result;
}

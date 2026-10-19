import type { Pool } from "pg";
import { getPool } from "./pool";

/** Result envelope returned by every `scb_api` function. */
export type ApiResult<T> =
  | { ok: true; data: T; replayed?: boolean }
  | { ok: false; error: ApiError };

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/** Function names are fixed here; never interpolate user input into SQL. */
const FUNCTIONS = [
  "ensure_user_for_auth",
  "get_actor_context",
  "get_proposal_detail",
  "get_workspace_overview",
  "list_audit_events",
  "save_group_brief",
  "create_quote",
  "save_draft",
  "publish_proposal",
  "revise_proposal",
  "respond_to_proposal",
  "reserve_seat",
  "withdraw_seat",
  "confirm_booking",
  "cancel_proposal",
  "complete_proposal",
  "create_demo_workspace",
  "list_demo_personas",
  "create_match_run",
  "lease_match_run",
  "checkpoint_match_run",
  "finish_match_run",
  "record_evidence",
  "get_match_run",
  "list_recoverable_match_runs",
  "request_venue_review",
  "get_quote_terms",
  "demo_simulate",
  "export_my_data",
  "record_consent",
  "delete_my_account",
  "list_my_updates",
] as const;

export type ApiFunction = (typeof FUNCTIONS)[number];

/** Marks a value (typically an array) to be sent as jsonb rather than a SQL array. */
export class JsonParam {
  constructor(readonly value: unknown) {}
}

export function json(value: unknown): JsonParam {
  return new JsonParam(value);
}

export function toParam(a: unknown): unknown {
  if (a instanceof JsonParam) return JSON.stringify(a.value);
  // Plain objects are jsonb; arrays stay SQL arrays (uuid[], text[]).
  if (a !== null && typeof a === "object" && !Array.isArray(a) && !(a instanceof Date)) return JSON.stringify(a);
  return a;
}

/** Calls a guarded function with positional parameters and returns its envelope. */
export async function callApi<T>(
  fn: ApiFunction,
  args: readonly unknown[],
  pool: Pool = getPool(),
): Promise<ApiResult<T>> {
  if (!FUNCTIONS.includes(fn)) throw new Error(`Unknown API function ${fn}`);
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await pool.query<{ result: ApiResult<T> }>(
    `select scb_api.${fn}(${placeholders}) as result`,
    args.map(toParam),
  );
  const result = rows[0]?.result;
  if (!result || typeof result !== "object" || !("ok" in result)) {
    throw new Error(`Malformed result from scb_api.${fn}`);
  }
  return result;
}

/** Plain-value helpers for functions that return scalars. */
export async function callScalar<T>(sql: string, args: readonly unknown[], pool: Pool = getPool()): Promise<T> {
  const { rows } = await pool.query<{ value: T }>(sql, [...args]);
  return rows[0]!.value;
}

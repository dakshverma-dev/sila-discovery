/** Application error codes from D16 that the Qloo adapter can surface. */
export type QlooErrorCode =
  | "QLOO_UNAVAILABLE"
  | "PROVIDER_SCHEMA_CHANGED"
  | "RATE_LIMITED"
  | "JOB_DEADLINE_EXCEEDED"
  | "VALIDATION_FAILED";

/** Provider-level cause, kept for operators; never includes the key or payload. */
export type QlooFailureReason =
  | "NOT_CONFIGURED"
  | "AUTH_REJECTED"
  | "ENTITY_TYPE_FORBIDDEN"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "TIMEOUT"
  | "NETWORK"
  | "CALL_BUDGET_EXHAUSTED"
  | "DEADLINE_EXCEEDED"
  | "MALFORMED_RESPONSE"
  | "INVALID_INPUT";

export class QlooError extends Error {
  constructor(
    readonly code: QlooErrorCode,
    readonly reason: QlooFailureReason,
    readonly retryable: boolean,
    readonly status?: number,
    /** Provider-requested wait before a retry, from Retry-After. */
    readonly retryAfterMs?: number,
  ) {
    super(`Qloo request failed: ${code} (${reason}${status ? `, HTTP ${status}` : ""})`);
    this.name = "QlooError";
  }
}

import { withinMaximumWait } from "./schedule";

export type SessionPhase = "draft" | "published" | "closed" | "confirmed" | "cancelled";

export interface CommitSession {
  phase: SessionPhase;
  termsVersion: number;
  fillBy: Date;
  decisionBy: Date;
  minimum: number;
  capacity: number;
  maxClubs: number;
  intakePaused: boolean;
  /** Set once current commitments reach the minimum; the contributing set is then frozen. */
  minimumReachedAt: Date | null;
}

export interface LiveAllocation {
  planId: string;
  places: number;
}

export interface CommitInput {
  now: Date;
  planId: string;
  session: CommitSession;
  /** Venue approval for this plan, or null if none. */
  approval: { quantity: number; termsVersion: number } | null;
  /** What the organiser reviewed and is committing to. */
  request: { quantity: number; termsVersion: number };
  liveAllocations: readonly LiveAllocation[];
}

export type CommitRejection =
  | "INTAKE_PAUSED"
  | "SESSION_NOT_OPEN"
  | "FILL_DEADLINE_PASSED"
  | "MINIMUM_ALREADY_REACHED"
  | "NOT_APPROVED"
  | "STALE_TERMS"
  | "QUANTITY_NOT_APPROVED"
  | "ALREADY_COMMITTED"
  | "CLUB_LIMIT_REACHED"
  | "CAPACITY_EXCEEDED"
  | "SECOND_CLUB_BELOW_MINIMUM"
  | "WAIT_EXCEEDS_LIMIT";

export type CommitResult =
  | { ok: true; placesAfter: number; reachesMinimum: boolean }
  | { ok: false; reason: CommitRejection; status: 409 | 422 };

/**
 * Commitment checks from guide §07, §15 and §23. The database transaction repeats these
 * under row locks; this function is the single statement of the rule.
 */
export function checkCommit(input: CommitInput): CommitResult {
  const { session: s, now } = input;
  const reject = (reason: CommitRejection, status: 409 | 422 = 409): CommitResult => ({ ok: false, reason, status });

  if (s.intakePaused) return reject("INTAKE_PAUSED");
  if (s.phase !== "published") return reject("SESSION_NOT_OPEN");
  if (now.getTime() > s.fillBy.getTime()) return reject("FILL_DEADLINE_PASSED");
  if (s.minimumReachedAt) return reject("MINIMUM_ALREADY_REACHED");
  if (!input.approval) return reject("NOT_APPROVED");
  if (input.approval.termsVersion !== s.termsVersion || input.request.termsVersion !== s.termsVersion) {
    return reject("STALE_TERMS");
  }
  if (input.request.quantity !== input.approval.quantity) return reject("QUANTITY_NOT_APPROVED", 422);
  if (input.liveAllocations.some((a) => a.planId === input.planId)) return reject("ALREADY_COMMITTED");
  if (input.liveAllocations.length >= s.maxClubs) return reject("CLUB_LIMIT_REACHED");

  const committed = input.liveAllocations.reduce((sum, a) => sum + a.places, 0);
  const placesAfter = committed + input.request.quantity;
  if (placesAfter > s.capacity) return reject("CAPACITY_EXCEEDED");
  const isLastClubSlot = input.liveAllocations.length + 1 === s.maxClubs;
  if (isLastClubSlot && placesAfter < s.minimum) return reject("SECOND_CLUB_BELOW_MINIMUM");
  if (!withinMaximumWait(now, s.decisionBy)) return reject("WAIT_EXCEEDS_LIMIT");

  return { ok: true, placesAfter, reachesMinimum: placesAfter >= s.minimum };
}

export type WithdrawalOutcome =
  /** Before payment opens: places released without charge. */
  | { kind: "released"; cancelScheduledOpening: boolean }
  /** After payment opens: the venue's accepted cancellation policy applies; no automatic reset or repricing. */
  | { kind: "venue_review" };

export function withdrawalOutcome(input: {
  paymentOpenedAt: Date | null;
  placesAfterWithdrawal: number;
  minimum: number;
  paymentScheduled: boolean;
}): WithdrawalOutcome {
  if (input.paymentOpenedAt) return { kind: "venue_review" };
  return {
    kind: "released",
    cancelScheduledOpening: input.paymentScheduled && input.placesAfterWithdrawal < input.minimum,
  };
}

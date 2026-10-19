import type { SilaActor } from "@/lib/sila/auth";
import { scottishVenueCalendar } from "@/lib/sila/calendar";
import { callSila } from "@/lib/sila/db";
import { scheduledPaymentOpening } from "@/lib/sila/schedule";
import type { LocalDate } from "@/lib/sila/time";

/**
 * Server commands for the payment opening, closure of unfilled sessions and
 * organiser withdrawal (§12, §15, §22). The scheduling, release, block, close
 * and work-list functions are server-only and never exposed by a route.
 */

export interface PaymentScheduling {
  scheduled_for: string | null;
  /** `NO_COVERAGE` when no covered business day exists within the search horizon. */
  blocked_reason: string | null;
}

interface ScheduleInputs {
  session_id: string;
  minimum_reached_at: string | null;
  payment_scheduled_for: string | null;
  blocked_reason: string | null;
  covered_dates: LocalDate[];
}

/** One session's scheduling facts from `list_session_work`. Timestamps are the database's strings. */
export interface SessionWork {
  id: string;
  minimum_reached_at: string | null;
  covered_dates: LocalDate[];
  decision_by: string;
  payment_window_days: number;
  payment_scheduled_for: string | null;
}

export interface SessionWorkList {
  to_schedule: SessionWork[];
  /** Openings due now and still inside their 11:00-12:30 London staffed window. */
  to_release: SessionWork[];
  /** Openings whose staffed window passed without payment opening. */
  to_reschedule: SessionWork[];
  to_close: SessionWork[];
}

export interface ReleasedOpening {
  payment_opened_at: string;
  pay_by: string;
  verify_by: string;
  /** False when payment had already opened; the stored deadlines are returned unchanged. */
  opened: boolean;
}

export interface BlockedOpening {
  blocked_reason: string;
  /** False when the same reason was already recorded. */
  blocked: boolean;
}

export interface RescheduledOpening {
  payment_scheduled_for: string | null;
  blocked_reason: string | null;
  /** False when the opening had already moved or opened, or the session is no longer published. */
  rescheduled: boolean;
}

export interface ClosedSession {
  session_id: string;
  released_allocations: number;
}

export interface WithdrawnPlan {
  outcome: "released" | "venue_review";
  cancelled_scheduled_opening: boolean;
  /** Live places on the session after the withdrawal. */
  committed_places: number;
}

/**
 * Records the staffed 11:45 opening for the minimum stamped at `minimumReachedAt`
 * (passed through as the database's string so its microseconds survive), or
 * `NO_COVERAGE` when no covered business day exists. The database writes once.
 */
export async function schedulePaymentOpening(sessionId: string, minimumReachedAt: string): Promise<PaymentScheduling> {
  const inputs = await callSila<ScheduleInputs>("get_schedule_inputs", [sessionId]);
  if (!inputs.ok) throw new Error(`Schedule inputs unavailable: ${inputs.error.code}`);
  const opening = scheduledPaymentOpening(
    new Date(minimumReachedAt),
    scottishVenueCalendar(),
    new Set(inputs.data.covered_dates),
  );
  const result = await callSila<{ payment_scheduled_for: string | null; blocked_reason: string | null }>(
    "schedule_payment_opening",
    [sessionId, minimumReachedAt, opening, opening ? null : "NO_COVERAGE"],
  );
  if (!result.ok) throw new Error(`Payment scheduling failed: ${result.error.code}`);
  return { scheduled_for: result.data.payment_scheduled_for, blocked_reason: result.data.blocked_reason };
}

export function listSessionWork() {
  return callSila<SessionWorkList>("list_session_work", []);
}

/** Opens payment now with deadlines computed from `paymentDeadlines`; the database clock stamps the opening. */
export function releasePaymentOpening(sessionId: string, payBy: Date, verifyBy: Date) {
  return callSila<ReleasedOpening>("release_payment_opening", [sessionId, payBy, verifyBy]);
}

/**
 * Moves a missed opening (its staffed window passed unopened) to the next
 * staffed 11:45 release computed from `now`, so the same-day 11:00 cutoff
 * applies to the current instant, or records NO_COVERAGE. The expected time is
 * the database's string, so the compare-and-set sees exactly what was listed.
 */
export function reschedulePaymentOpening(session: SessionWork, now = new Date()) {
  const opening = scheduledPaymentOpening(now, scottishVenueCalendar(), new Set(session.covered_dates));
  return callSila<RescheduledOpening>("reschedule_payment_opening",
                                      [session.id, session.payment_scheduled_for, opening,
                                       opening ? null : "NO_COVERAGE"]);
}

export function blockPaymentOpening(sessionId: string, reason: string) {
  return callSila<BlockedOpening>("block_payment_opening", [sessionId, reason]);
}

export function closeUnfilledSession(sessionId: string) {
  return callSila<ClosedSession>("close_unfilled_session", [sessionId]);
}

/**
 * The organiser withdraws their club's commitment (`withdrawalOutcome` in
 * lib/sila/commitment.ts) at the plan version they saw; a stale version (for
 * example payment opened meanwhile) returns VERSION_CONFLICT.
 */
export function withdrawPlan(actor: SilaActor, key: string, planId: string, expectedVersion: number,
                             reason: string) {
  return callSila<WithdrawnPlan>("withdraw_plan", [actor.personId, key, planId, expectedVersion, reason]);
}

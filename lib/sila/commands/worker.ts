import { scottishVenueCalendar } from "@/lib/sila/calendar";
import {
  blockPaymentOpening,
  closeUnfilledSession,
  listSessionWork,
  releasePaymentOpening,
  reschedulePaymentOpening,
  schedulePaymentOpening,
  type SessionWork,
} from "@/lib/sila/commands/payments";
import { paymentDeadlines } from "@/lib/sila/schedule";
import { closeDecisionSessions } from "@/lib/sila/commands/refunds";

export interface SilaTickResult {
  scheduled: number;
  rescheduled: number;
  released: number;
  blocked: number;
  closed: number;
}

/** Verification would fall on or after the final decision, so payment cannot open (§12). */
export const VERIFY_AFTER_DECISION = "VERIFY_AFTER_DECISION";

/**
 * One worker pass (§12, §22, §28): schedule the staffed opening for sessions
 * that reached their minimum; move openings whose 11:00-12:30 London window
 * passed unopened (worker outage, or paused through it) to the next staffed
 * release; open payment for sessions due inside their window (or record the
 * delay when verification would not precede the final decision); and close
 * published sessions whose fill deadline passed below the minimum. Each
 * session is handled on its own: a failure is logged and counted nowhere, and
 * the others continue. The database writes each fact once, so a repeated or
 * overlapping pass changes nothing further.
 */
export async function runSilaTick(): Promise<SilaTickResult> {
  const counts: SilaTickResult = { scheduled: 0, rescheduled: 0, released: 0, blocked: 0, closed: 0 };
  // Close overdue unconfirmed sessions before considering any new payment
  // request. The transaction serialises with confirmation and late receipts.
  const decisions = await closeDecisionSessions();
  if (!decisions.ok) throw new Error(`Final-decision closure unavailable: ${decisions.error.code}`);
  counts.closed += decisions.data.closed;
  counts.blocked += decisions.data.blocked;
  const work = await listSessionWork();
  if (!work.ok) throw new Error(`Session work unavailable: ${work.error.code}`);
  const cal = scottishVenueCalendar();

  const each = async (step: string, sessions: SessionWork[], fn: (s: SessionWork) => Promise<void>) => {
    for (const session of sessions) {
      try {
        await fn(session);
      } catch (error) {
        console.error(`sila tick ${step} failed`, session.id, error);
      }
    }
  };

  await each("schedule", work.data.to_schedule, async (s) => {
    if (!s.minimum_reached_at) return;
    const r = await schedulePaymentOpening(s.id, s.minimum_reached_at);
    if (r.scheduled_for) counts.scheduled++;
    else if (r.blocked_reason) counts.blocked++;
  });

  await each("reschedule", work.data.to_reschedule, async (s) => {
    const r = await reschedulePaymentOpening(s);
    if (!r.ok) throw new Error(`Reschedule failed: ${r.error.code}`);
    if (r.data.rescheduled) counts.rescheduled++;
  });

  await each("release", work.data.to_release, async (s) => {
    const deadlines = paymentDeadlines(new Date(), new Date(s.decision_by), cal, s.payment_window_days);
    if (!deadlines.feasible) {
      const r = await blockPaymentOpening(s.id, VERIFY_AFTER_DECISION);
      if (!r.ok) throw new Error(`Block failed: ${r.error.code}`);
      if (r.data.blocked) counts.blocked++;
      return;
    }
    const r = await releasePaymentOpening(s.id, deadlines.payBy, deadlines.verifyBy);
    // NOT_READY (set changed, paused, not yet due, window missed) is an expected outcome, not a failure.
    if (!r.ok) {
      if (r.error.code !== "NOT_READY") throw new Error(`Release failed: ${r.error.code}`);
      return;
    }
    if (r.data.opened) counts.released++;
  });

  await each("close", work.data.to_close, async (s) => {
    const r = await closeUnfilledSession(s.id);
    if (r.ok) counts.closed++;
    else if (r.error.code !== "NOT_READY") throw new Error(`Close failed: ${r.error.code}`);
  });

  return counts;
}

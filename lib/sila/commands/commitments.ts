import type { ApiResult } from "@/lib/db/api";
import type { SilaActor } from "@/lib/sila/auth";
import { schedulePaymentOpening, type PaymentScheduling } from "@/lib/sila/commands/payments";
import { callSila } from "@/lib/sila/db";

export type { PaymentScheduling };

/** Server commands for venue approval and conditional commitment (§07, §12, §15); shared by routes and pages. */

export interface ApprovedPlan {
  approval_id: string;
}

export interface DeclinedPlan {
  plan_id: string;
  version: number;
}

export interface CommittedPlan {
  allocation_id: string;
  session_id: string;
  places_after: number;
  reaches_minimum: boolean;
  minimum_reached_at: string | null;
  next_action: "payment_scheduled" | "waiting_for_more_places";
  /** GBP minor units, computed by the database (§18). */
  total_minor: number;
  deposit_minor: number;
  balance_minor: number;
}

/** `payment` is null when the minimum is not reached, or when scheduling could not run (the commit still stands). */
export type CommitOutcome = CommittedPlan & { payment: PaymentScheduling | null };

export function approvePlan(actor: SilaActor, key: string, planId: string, places: number, termsVersion: number) {
  return callSila<ApprovedPlan>("approve_plan", [actor.personId, key, planId, places, termsVersion]);
}

export function declinePlan(actor: SilaActor, key: string, planId: string, reason: string) {
  return callSila<DeclinedPlan>("decline_plan", [actor.personId, key, planId, reason]);
}

/**
 * Commits the organiser's approved places (the database repeats checkCommit
 * under row locks). When this commitment reaches the minimum, the payment
 * opening is scheduled after the commit transaction; a scheduling failure
 * leaves the commitment in place, `payment` null and the queued
 * `payment.schedule` outbox row for a later worker. Replaying the commit key
 * re-runs scheduling, which the database applies at most once.
 */
export async function commitPlan(
  actor: SilaActor,
  key: string,
  planId: string,
  places: number,
  termsVersion: number,
): Promise<ApiResult<CommitOutcome>> {
  const result = await callSila<CommittedPlan>("commit_plan", [actor.personId, key, planId, places, termsVersion]);
  if (!result.ok) return result;
  let payment: PaymentScheduling | null = null;
  if (result.data.reaches_minimum && result.data.minimum_reached_at) {
    try {
      payment = await schedulePaymentOpening(result.data.session_id, result.data.minimum_reached_at);
    } catch (error) {
      console.error("sila payment scheduling deferred", error);
    }
  }
  return { ...result, data: { ...result.data, payment } };
}

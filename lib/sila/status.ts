/** Viewer-facing plan states from guide §16, derived from separately stored records. */
export type PlanStatus =
  | "draft"
  | "waiting_for_venue_approval"
  | "review_conditions"
  | "waiting_for_more_places"
  | "payment_scheduled"
  | "payment_delayed"
  | "deposit_due"
  | "verification_pending"
  | "waiting_for_another_deposit"
  | "waiting_for_confirmation"
  | "confirmed"
  | "balance_overdue"
  | "change_proposed"
  | "not_proceeding";

export interface PlanFacts {
  submitted: boolean;
  approved: boolean;
  committed: boolean;
  /** Session failed, was closed below minimum, or the booking was cancelled. */
  closed: boolean;
  minimumReached: boolean;
  openingBlocked: boolean;
  paymentOpened: boolean;
  ownPaymentReported: boolean;
  ownDepositVerified: boolean;
  allDepositsVerified: boolean;
  confirmed: boolean;
  balanceDefaultEstablished: boolean;
  amendmentPending: boolean;
}

export function derivePlanStatus(f: PlanFacts): PlanStatus {
  if (f.closed) return "not_proceeding";
  if (f.confirmed) {
    if (f.amendmentPending) return "change_proposed";
    if (f.balanceDefaultEstablished) return "balance_overdue";
    return "confirmed";
  }
  if (!f.submitted) return "draft";
  if (!f.approved) return "waiting_for_venue_approval";
  if (!f.committed) return "review_conditions";
  if (!f.minimumReached) return "waiting_for_more_places";
  if (!f.paymentOpened) return f.openingBlocked ? "payment_delayed" : "payment_scheduled";
  if (f.allDepositsVerified) return "waiting_for_confirmation";
  if (f.ownDepositVerified) return "waiting_for_another_deposit";
  if (f.ownPaymentReported) return "verification_pending";
  return "deposit_due";
}

export const PLAN_STATUS_COPY: Record<PlanStatus, { label: string; nextAction: string }> = {
  draft: { label: "Draft", nextAction: "Finish your request." },
  waiting_for_venue_approval: { label: "Waiting for the venue to approve your places", nextAction: "The venue approves your quantity or replies." },
  review_conditions: { label: "Review conditions", nextAction: "Decide whether to commit. Your places are not reserved yet." },
  waiting_for_more_places: { label: "Waiting for more places", nextAction: "This session is not confirmed. No deposit is due yet." },
  payment_scheduled: { label: "Minimum reached, payment scheduled", nextAction: "Payment opens at the scheduled time. Nothing is due yet." },
  payment_delayed: { label: "Payment opening is delayed", nextAction: "Nothing is due yet. The named coordinator will update you." },
  deposit_due: { label: "Deposit due", nextAction: "Your group payer pays the venue by the pay-by time." },
  verification_pending: { label: "Verification pending", nextAction: "The venue checks your payment by its verify-by time." },
  waiting_for_another_deposit: { label: "Waiting for another deposit", nextAction: "Your deposit is verified. Another group or the venue still has to act." },
  waiting_for_confirmation: { label: "Waiting for confirmation", nextAction: "The venue completes its final checks and confirms." },
  confirmed: { label: "Your booking is confirmed", nextAction: "Share practical details and pay any later balance." },
  balance_overdue: { label: "Balance overdue", nextAction: "The venue issues notice and allows the agreed remedy period." },
  change_proposed: { label: "Change proposed", nextAction: "Your original booking stays valid while you and the venue decide." },
  not_proceeding: { label: "This session will not go ahead", nextAction: "See the release or refund outcome." },
};

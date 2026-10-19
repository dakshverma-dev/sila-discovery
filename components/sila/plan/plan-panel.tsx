import { PLAN_STATUS_COPY } from "@/lib/sila/status";
import { ConfirmedPanel } from "./confirmed";
import { DepositDuePanel } from "./deposit-due";
import { NotProceedingPanel } from "./not-proceeding";
import { PaymentScheduledPanel } from "./payment-scheduled";
import { ReviewConditionsPanel } from "./review-conditions";
import type { PanelProps } from "./types";
import { WaitingApprovalPanel } from "./waiting-approval";
import { WaitingDepositPanel } from "./waiting-deposit";
import { WaitingMorePanel } from "./waiting-more";

/** The overview panel for the plan's derived status (§16). One component per state. */
export function PlanPanel(props: PanelProps) {
  const { view } = props;
  switch (view.status) {
    case "waiting_for_venue_approval":
      return <WaitingApprovalPanel {...props} />;
    case "review_conditions":
      return <ReviewConditionsPanel {...props} />;
    case "waiting_for_more_places":
      return <WaitingMorePanel {...props} />;
    case "payment_scheduled":
      return <PaymentScheduledPanel {...props} delayed={false} />;
    case "payment_delayed":
      return <PaymentScheduledPanel {...props} delayed />;
    case "deposit_due":
      return <DepositDuePanel {...props} pending={false} />;
    case "verification_pending":
      return <DepositDuePanel {...props} pending />;
    case "waiting_for_another_deposit":
      return <WaitingDepositPanel {...props} allIn={false} />;
    case "waiting_for_confirmation":
      return <WaitingDepositPanel {...props} allIn />;
    case "confirmed":
      return <ConfirmedPanel {...props} />;
    case "not_proceeding":
      return <NotProceedingPanel {...props} />;
    default: {
      // balance_overdue and change_proposed are later slices; show the state honestly.
      const copy = PLAN_STATUS_COPY[view.status];
      return (
        <section className="stack" aria-labelledby="panel-heading">
          <h2 id="panel-heading">{copy.label}</h2>
          <p>{copy.nextAction}</p>
        </section>
      );
    }
  }
}

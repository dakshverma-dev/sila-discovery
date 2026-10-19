import { formatGBP } from "@/lib/sila/money";
import { london, sessionWhen } from "@/lib/sila/plan-copy";
import { PLAN_STATUS_COPY } from "@/lib/sila/status";
import { Box, FactList } from "./parts";
import { WithdrawControl } from "./plan-forms";
import { planHref, type PanelProps } from "./types";

/**
 * Your deposit is verified: either another group's deposit is outstanding
 * (`waiting_for_another_deposit`) or the venue is completing its final checks
 * (`waiting_for_confirmation`). Nothing more is due from this club now.
 */
export function WaitingDepositPanel({
  view,
  keys,
  flash,
  allIn,
}: PanelProps & { allIn: boolean }) {
  const { plan, allocation, payment, terms } = view;
  if (!allocation) return null;
  const copy = allIn ? PLAN_STATUS_COPY.waiting_for_confirmation : PLAN_STATUS_COPY.waiting_for_another_deposit;
  return (
    <section className="stack" aria-labelledby="panel-heading">
      <h2 id="panel-heading">{copy.label}</h2>

      <Box>
        <strong>Deposit {formatGBP(payment.verified_deposit_minor ?? allocation.deposit_minor)} verified</strong>
        <span>{copy.nextAction}</span>
      </Box>

      <FactList
        rows={[
          {
            label: "Your group",
            value: `${plan.club_name} · ${allocation.places} places · ${formatGBP(allocation.total_minor)}`,
          },
          { label: "Session", value: sessionWhen(view) },
          { label: "Balance", value: `${formatGBP(allocation.balance_minor)} due ${london(terms.balance_due_at)}` },
        ]}
      />
      <p>Nothing more is due from your club now.</p>
      <p>
        <a className="link-button" href={planHref(plan.id, { tab: "messages" }, "#message")}>
          Message the venue
        </a>
      </p>

      <WithdrawControl
        planId={plan.id}
        idemKey={keys.withdraw}
        version={plan.version}
        paymentOpen
        places={allocation.places}
        flash={flash}
      />
    </section>
  );
}

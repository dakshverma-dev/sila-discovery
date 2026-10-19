import { formatGBP } from "@/lib/sila/money";
import { london, sessionWhen } from "@/lib/sila/plan-copy";
import { PLAN_STATUS_COPY } from "@/lib/sila/status";
import { Box, FactList, venueContactHref } from "./parts";
import { WithdrawControl } from "./plan-forms";
import { planHref, type PanelProps } from "./types";

/** Minimum reached; payment has a scheduled opening, or the opening is delayed (§12, §16). */
export function PaymentScheduledPanel({ view, keys, flash, delayed }: PanelProps & { delayed: boolean }) {
  const { plan, session, allocation, payment, terms } = view;
  if (!allocation) return null;
  const status = delayed ? PLAN_STATUS_COPY.payment_delayed : PLAN_STATUS_COPY.payment_scheduled;
  return (
    <section className="stack" aria-labelledby="panel-heading">
      <h2 id="panel-heading">{status.label}</h2>

      <Box>
        {delayed ? (
          <>
            <strong>Nothing is due yet.</strong>
            <span>The named coordinator will update you.</span>
          </>
        ) : (
          <>
            <strong>
              {payment.scheduled_for ? `Payment opens ${london(payment.scheduled_for)}` : "Payment opening is scheduled"}
            </strong>
            <span>Nothing is due yet. You then have at least five calendar days to pay.</span>
          </>
        )}
        <span>{status.nextAction}</span>
      </Box>

      <FactList
        rows={[
          {
            label: "Your group",
            value: `${plan.club_name} · ${allocation.places} places · ${formatGBP(allocation.total_minor)}`,
          },
          { label: "Session", value: sessionWhen(view) },
          {
            label: "Your payments",
            value: (
              <>
                Deposit {formatGBP(allocation.deposit_minor)} when payment opens
                <br />
                Balance {formatGBP(allocation.balance_minor)} due {london(terms.balance_due_at)}
              </>
            ),
          },
        ]}
      />

      <div className="pn-actions">
        <a className="link-button" href={planHref(plan.id, { tab: "messages" }, "#message")}>
          Message the venue
        </a>
        {delayed ? (
          <a className="link-button" href={venueContactHref(session.venue)}>
            Contact the venue
          </a>
        ) : null}
      </div>

      <WithdrawControl
        planId={plan.id}
        idemKey={keys.withdraw}
        version={plan.version}
        paymentOpen={false}
        places={allocation.places}
        flash={flash}
      />
    </section>
  );
}

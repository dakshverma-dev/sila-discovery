import { formatGBP } from "@/lib/sila/money";
import { depositOutstanding, london, poundsInput, treasurerInstructions } from "@/lib/sila/plan-copy";
import { PLAN_STATUS_COPY } from "@/lib/sila/status";
import { CopyButton } from "./copy-button";
import { Box, FactList, venueContactHref } from "./parts";
import { PaidForm, WithdrawControl } from "./plan-forms";
import { planHref, type PanelProps } from "./types";

/** O5 — Deposit payment instructions, and the same page once a payment has been reported (§09, §17). */
export function DepositDuePanel({ view, keys, flash, pending }: PanelProps & { pending: boolean }) {
  const { plan, session, allocation, payment, terms } = view;
  if (!allocation || !payment.pay_by || !payment.opened_at || !terms.allocation_id) return null;
  const outstanding = depositOutstanding(view);
  const reports = payment.reports;
  const heading = pending ? PLAN_STATUS_COPY.verification_pending.label : "Pay your group deposit";
  const balanceDue = new Date(terms.balance_due_at);

  return (
    <section className="stack" aria-labelledby="panel-heading">
      <h2 id="panel-heading">{heading}</h2>

      <Box>
        {pending ? (
          <>
            <strong>Your payment report is with the venue</strong>
            <span>{PLAN_STATUS_COPY.verification_pending.nextAction}</span>
          </>
        ) : (
          <strong>{formatGBP(outstanding)} due</strong>
        )}
        <span>Pay {session.venue.name} directly.</span>
        <span>Your group has {allocation.places} conditional places.</span>
      </Box>

      <FactList
        rows={[
          {
            label: "Pay by",
            value: (
              <>
                {london(payment.pay_by)}
                <br />
                <span className="muted">Opened {london(payment.opened_at)}</span>
              </>
            ),
          },
          { label: "Plan reference", value: plan.plan_ref },
          ...(payment.payment_route
            ? [{ label: "Payment details", value: <span className="pn-pre">{payment.payment_route}</span> }]
            : []),
        ]}
      />
      <p>Bank transfer must reach the venue by {london(payment.pay_by)}.</p>
      {payment.verify_by ? <p>Venue verifies by {london(payment.verify_by)}.</p> : null}

      {reports.length > 0 ? (
        <section className="stack-sm" aria-labelledby="reports-heading">
          <h3 id="reports-heading">You reported</h3>
          <ul className="checklist">
            {reports.map((r) => (
              <li key={r.report_id}>
                {formatGBP(r.amount_minor)} · reference {r.reference} · {london(r.reported_at)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pending ? (
        <>
          <p>
            Verification pending. A venue checking delay does not make a timely payment late.
          </p>
          <PaidForm
            planId={plan.id}
            allocationId={terms.allocation_id}
            idemKey={keys.paid}
            suggestedAmount={poundsInput(outstanding)}
            flash={flash}
            summary="Report another payment"
          />
        </>
      ) : (
        <>
          <PaidForm
            planId={plan.id}
            allocationId={terms.allocation_id}
            idemKey={keys.paid}
            suggestedAmount={poundsInput(outstanding)}
            flash={flash}
          />
          <p className="muted">
            After reporting: Verification pending. A venue checking delay does not make a timely payment late.
          </p>
        </>
      )}

      <div className="pn-actions">
        <CopyButton text={treasurerInstructions(view, balanceDue)} label="Copy instructions for your treasurer" />
      </div>

      <p>
        Your total is {formatGBP(allocation.total_minor)}. The later balance is {formatGBP(allocation.balance_minor)} due{" "}
        {london(terms.balance_due_at)}.
      </p>
      <p className="pn-links">
        <a href={venueContactHref(session.venue)}>Need more time? Contact the venue</a>
        <a href={planHref(plan.id, { tab: "messages" }, "#message")}>Message the venue</a>
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

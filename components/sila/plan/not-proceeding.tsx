import { london, sessionWhen } from "@/lib/sila/plan-copy";
import { formatGBP } from "@/lib/sila/money";
import { PLAN_STATUS_COPY } from "@/lib/sila/status";
import { Box, FactList } from "./parts";
import { planHref, type PanelProps } from "./types";

/** O6 — The session will not go ahead (§09), and the venue's decline of a single request. */
export function NotProceedingPanel({ view, now }: PanelProps) {
  const { plan, session, allocation, payment } = view;

  if (plan.status === "declined") {
    return (
      <section className="stack" aria-labelledby="panel-heading">
        <h2 id="panel-heading">The venue could not approve this request</h2>
        <Box>
          <strong>{plan.requested_places} places requested</strong>
          <span>{plan.declined_reason ?? "The venue did not give a reason."}</span>
        </Box>
        <p>Nothing was committed and nothing is due. You can ask the venue about another session.</p>
        <p>
          <a className="button button-secondary" href={planHref(plan.id, { tab: "messages", prefill: "session" }, "#message")}>
            Ask about another session
          </a>
        </p>
      </section>
    );
  }

  // Closing releases the live places, so the count the session reached is live plus released.
  const reached = session.committed_places + view.terms.released_places;
  const short = reached < session.minimum;
  const deadlinePassed = now.getTime() > new Date(session.fill_by).getTime();
  const paymentOpened = payment.opened_at !== null;
  const places = allocation?.places ?? plan.requested_places;

  return (
    <section className="stack" aria-labelledby="panel-heading">
      <h2 id="panel-heading">{PLAN_STATUS_COPY.not_proceeding.label}</h2>

      <Box>
        <strong>
          {reached} of {session.minimum} needed places
        </strong>
        <span>
          {short && deadlinePassed
            ? `The fill deadline passed on ${london(session.fill_by)}.`
            : "The venue has closed this session."}
        </span>
      </Box>

      {view.refund ? <Box>
        <strong>{view.refund.status === "refunded" ? "Refund verified" : view.refund.status === "refund_due" ? `${formatGBP(view.refund.due_minor)} due back` : "No verified payment to return"}</strong>
        <span>{view.refund.venue_owner} returns the money. {view.refund.reason}</span>
        <span>{view.refund.target_at ? `Refund target ${london(view.refund.target_at)}.` : "The venue must resolve the refund target against its approved calendar."} Received {formatGBP(view.refund.received_minor)}; verified returns {formatGBP(view.refund.refunded_minor)}.</span>
        {view.refund.entries.map((entry) => <span key={entry.id}>Return {entry.reference}: {formatGBP(entry.amount_minor)}, verified {london(entry.verified_at)}.</span>)}
      </Box> : allocation && !paymentOpened ? (
        <p>
          <strong>Your {allocation.places} conditional places are released. No payment was requested.</strong>
        </p>
      ) : paymentOpened ? (
        <p>
          <strong>Payment had already opened.</strong> Message the venue about the release or refund outcome.
        </p>
      ) : (
        <p>
          <strong>Your request for {places} places is closed. Nothing was committed and nothing is due.</strong>
        </p>
      )}

      <FactList
        rows={[
          {
            label: "Your plan",
            value: (
              <>
                {session.title} · {sessionWhen(view)}
                <br />
                {plan.club_name}
                {paymentOpened ? "" : " · No balance due"}
              </>
            ),
          },
        ]}
      />
      <p>You can ask about another session. Your commitment will not move automatically.</p>

      <div className="pn-actions">
        <a className="button button-secondary" href={planHref(plan.id, { tab: "messages", prefill: "session" }, "#message")}>
          Ask about another session
        </a>
        <a className="link-button" href={planHref(plan.id, { tab: "messages" }, "#message")}>
          Message the venue
        </a>
        <a className="link-button" href={planHref(plan.id, { tab: "agreement" })}>
          View the closed agreement
        </a>
      </div>
    </section>
  );
}

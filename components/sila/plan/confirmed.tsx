import { formatGBP } from "@/lib/sila/money";
import { london, practicalDetails, sessionWhen } from "@/lib/sila/plan-copy";
import { PLAN_STATUS_COPY } from "@/lib/sila/status";
import { CopyButton } from "./copy-button";
import { Box, FactList, VenueContact } from "./parts";
import { planHref, type PanelProps } from "./types";

/**
 * O4 — The plan after venue confirmation (§13). This is the only panel that
 * says the booking is confirmed; the status only reaches here when the venue
 * has recorded the booking that includes this club.
 */
export function ConfirmedPanel({ view }: PanelProps) {
  const { plan, session, allocation, payment, terms, booking } = view;
  if (!allocation || !booking) return null;
  return (
    <section className="stack" aria-labelledby="panel-heading">
      <h2 id="panel-heading">{PLAN_STATUS_COPY.confirmed.label}</h2>

      <Box tone="success">
        <strong>Booking {booking.booking_ref}</strong>
        <span>
          {session.title} at {session.venue.name}
        </span>
      </Box>

      <FactList
        rows={[
          {
            label: "Date and places",
            value: (
              <>
                {sessionWhen(view)}
                <br />
                Your group has {allocation.places} places
              </>
            ),
          },
          {
            label: "Your payment",
            value: (
              <>
                Deposit {formatGBP(payment.verified_deposit_minor ?? allocation.deposit_minor)} received
                <br />
                Balance {formatGBP(allocation.balance_minor)} due {london(terms.balance_due_at)}
              </>
            ),
          },
          ...(session.meeting_point ? [{ label: "On the day", value: `Meet at ${session.meeting_point}` }] : []),
        ]}
      />

      <details>
        <summary>View directions and access details</summary>
        <div className="details-body">
          <VenueContact venue={session.venue} />
        </div>
      </details>

      <div className="pn-actions">
        <CopyButton text={practicalDetails(view)} label="Copy practical details" />
        <a className="link-button" href={`/api/v1/sila/sessions/${session.id}/summary`}>Download practical details</a>
        <a className="link-button" href={planHref(plan.id, { tab: "messages" }, "#message")}>
          Message the venue
        </a>
        <a className="link-button" href={planHref(plan.id, { tab: "messages", prefill: "change" }, "#message")}>
          Request a change
        </a>
        <a className="link-button" href={planHref(plan.id, { tab: "agreement" })}>
          View agreement
        </a>
      </div>

      <p className="muted">You manage this club booking. Other clubs cannot see your invoice or messages.</p>
    </section>
  );
}

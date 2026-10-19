import { randomUUID } from "node:crypto";
import { approveAction, declineAction, venueMessageAction } from "@/app/venue/sessions/[id]/actions";
import { CommandForm } from "./command-form";
import type { SessionRequest } from "@/lib/sila/commands/plans";
import type { VenueSessionRow } from "@/lib/sila/forms";
import { formatLondon } from "@/lib/sila/forms";
import { formatGBP, groupAmounts } from "@/lib/sila/money";

export function VenueRequests({ session: s, plans, coordinator }: {
  session: VenueSessionRow; plans: SessionRequest[]; coordinator: boolean;
}) {
  return <section id="requests" className="stack-lg surface" aria-labelledby="requests-title">
    <h2 id="requests-title">Club requests</h2>
    <p>Approval reuses your published price and terms. It does not commit for the club.</p>
    {plans.length === 0 ? <p>No club requests yet. Share the session link with venue-approved clubs.</p> : null}
    {plans.map((plan) => {
      const money = groupAmounts(s.price_minor, plan.requested_places, s.deposit_bp);
      const ids = <>
        <input type="hidden" name="session_id" value={s.id} />
        <input type="hidden" name="plan_id" value={plan.id} />
        <input type="hidden" name="expected_version" value={plan.version} />
        <input type="hidden" name="terms_version" value={s.terms_version} />
      </>;
      return <article key={plan.id} className="stack surface" aria-labelledby={`club-${plan.id}`}>
        <p className="kicker">{plan.plan_ref}</p>
        <h3 id={`club-${plan.id}`}>{plan.club_name}</h3>
        <p>{plan.requested_places} places requested · {formatGBP(money.totalMinor)} total · Deposit {formatGBP(money.depositMinor)}</p>
        <p>{plan.allocation?.status === "live" ? `${plan.allocation.places} places conditionally committed`
          : plan.status === "declined" ? `Declined: ${plan.declined_reason}`
          : plan.approval ? `${plan.approval.approved_places} places approved · Waiting for the organiser to commit`
          : "Waiting for venue approval"}</p>
        {coordinator && s.phase === "published" && plan.status === "submitted" && !plan.allocation && !plan.approval ? <>
          <CommandForm action={approveAction} idempotencyKey={randomUUID()}>
            {ids}
            <label className="stack-sm">Approved places for {plan.club_name}
              <input type="number" name="places" min={1} max={s.capacity} required defaultValue={plan.requested_places} />
            </label>
            <p className="muted">Confirm suitability directly with the organiser. Keep individual access arrangements with the venue.</p>
            <button type="submit" className="button button-primary">Approve {plan.requested_places} places and invite</button>
          </CommandForm>
          <details><summary>Decline this request</summary>
            <CommandForm action={declineAction} idempotencyKey={randomUUID()}>
              {ids}
              <label className="stack-sm">Reason for declining {plan.club_name}<textarea name="reason" required maxLength={500} /></label>
              <button type="submit" className="button button-destructive">Decline request</button>
            </CommandForm>
          </details>
        </> : null}
        <details><summary>Conversation with {plan.club_name}</summary>
          <div className="stack">
            {plan.messages.length ? plan.messages.map((message) => <div className="surface stack-sm" key={message.id}>
              <p className="muted">{message.author_role === "organiser" ? "Club organiser" : message.author_role === "venue" ? "Venue" : "Sila operator"} · {formatLondon(new Date(message.created_at))}</p>
              <p className="vn-message">{message.body}</p>
            </div>) : <p>No messages yet.</p>}
            <CommandForm action={venueMessageAction} idempotencyKey={randomUUID()}>
              {ids}
              <label className="stack-sm">Ask {plan.club_name} a question<textarea name="body" maxLength={2000} required /></label>
              <p className="muted">Discuss personal access arrangements directly with the venue, outside Sila. Do not include health information here.</p>
              <button type="submit" className="button button-secondary">Send question</button>
            </CommandForm>
          </div>
        </details>
      </article>;
    })}
  </section>;
}

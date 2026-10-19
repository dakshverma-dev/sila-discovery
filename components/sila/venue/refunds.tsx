import { randomUUID } from "node:crypto";
import { closeAction, refundAction } from "@/app/venue/sessions/[id]/actions";
import type { VenueSessionView } from "@/lib/sila/commands/sessions";
import { formatGBP } from "@/lib/sila/money";
import { formatLondon } from "@/lib/sila/forms";
import { CommandForm } from "./command-form";

export function VenueRefunds({ view }: { view: VenueSessionView }) {
  const s = view.session;
  const coordinator = view.roles.includes("coordinator");
  const finance = view.roles.includes("finance");
  return <section className="stack-lg surface" aria-labelledby="refund-heading">
    <h2 id="refund-heading">Closure and refunds</h2>
    {view.refunds?.map((refund) => <article key={refund.allocation_id} className="stack surface">
      <h3>{view.allocations.find((a) => a.allocation_id === refund.allocation_id)?.club_name ?? "Club allocation"}</h3>
      <p>{refund.reason} · {refund.venue_owner} owns the return.</p>
      <p>{formatGBP(refund.received_minor)} received · {formatGBP(refund.refunded_minor)} returned and verified · <strong>{formatGBP(refund.due_minor)} due back</strong></p>
      <p>{refund.target_at ? `Target ${formatLondon(new Date(refund.target_at))}.` : "Resolve the refund target against the approved venue calendar."} {refund.status === "refunded" ? "Refund verified." : refund.status === "no_payment_received" ? "No verified payment received." : "Awaiting venue refund."}</p>
      {refund.entries.map((entry) => <p key={entry.id}>{entry.reference} · {formatGBP(entry.amount_minor)} returned {formatLondon(new Date(entry.returned_at))}</p>)}
      {finance && refund.due_minor > 0 ? <CommandForm action={refundAction} idempotencyKey={randomUUID()} label="Record verified refund">
        <input type="hidden" name="session_id" value={s.id} /><input type="hidden" name="allocation_id" value={refund.allocation_id} />
        <input type="hidden" name="expected_version" value={s.version} />
        <label className="stack-sm">Amount returned (GBP)<input name="amount" inputMode="decimal" defaultValue={(refund.due_minor / 100).toFixed(2)} required /></label>
        <label className="stack-sm">Venue refund reference<input name="reference" required maxLength={100} /></label>
        <label className="stack-sm">Money actually returned (London)<input name="returned_at" type="datetime-local" step="1" required /></label>
        <label className="stack-sm">Evidence of return<textarea name="evidence" required maxLength={1000} /></label>
        <button type="submit" className="button button-primary">Record verified refund</button>
      </CommandForm> : refund.due_minor > 0 ? <p>A venue finance member records the actual return. No refund is automatic.</p> : null}
    </article>)}
    {coordinator && (s.phase === "published" || s.phase === "confirmed") ? <details>
      <summary>{s.phase === "confirmed" ? "Venue cannot deliver this booking" : "Close the unconfirmed session"}</summary>
      <p>{s.phase === "confirmed" ? "Record a venue-caused delivery failure. Each club's deposit and balance must be returned in full." : "This releases the conditional places and requires full return of every received session payment."}</p>
      <CommandForm action={closeAction} idempotencyKey={randomUUID()} label="Close session with full refunds">
        <input type="hidden" name="session_id" value={s.id} /><input type="hidden" name="expected_version" value={s.version} />
        <input type="hidden" name="cause" value={s.phase === "confirmed" ? "venue_fault" : "unconfirmed"} />
        <label className="stack-sm">Reason for closure<textarea name="reason" required maxLength={500} /></label>
        <label className="choice"><input name="full_refund_reviewed" type="checkbox" required />The venue accepts full return of every club&apos;s session payments.</label>
        <button type="submit" className="button button-destructive">Close session and track full refunds</button>
      </CommandForm>
    </details> : null}
  </section>;
}

import { randomUUID } from "node:crypto";
import { confirmAction, receiptAction } from "@/app/venue/sessions/[id]/actions";
import { CommandForm } from "./command-form";
import type { VenueSessionView } from "@/lib/sila/commands/sessions";
import { formatLondon } from "@/lib/sila/forms";
import { formatGBP } from "@/lib/sila/money";

export function VenueReceipts({ view, coordinator }: { view: VenueSessionView; coordinator: boolean }) {
  const s = view.session;
  return <section className="stack-lg surface" aria-labelledby="receipts-title">
    <h2 id="receipts-title">Record receipt{coordinator ? " and confirm" : ""}</h2>
    <p>Clubs pay the venue directly. A payment report is unverified until venue staff record the receipt.</p>
    <dl className="terms">
      <dt>Payment opened</dt><dd>{s.payment_opened_at ? formatLondon(new Date(s.payment_opened_at)) : "Not opened"}</dd>
      <dt>Clubs pay by</dt><dd>{s.pay_by ? formatLondon(new Date(s.pay_by)) : "Not set"}</dd>
      <dt>Venue verifies by</dt><dd>{s.verify_by ? formatLondon(new Date(s.verify_by)) : "Not set"}</dd>
      <dt>Final decision</dt><dd>{formatLondon(new Date(s.decision_by))}</dd>
    </dl>
    {view.allocations.map((allocation) => {
      const due = Math.max(0, allocation.deposit_minor - allocation.verified_deposit_minor);
      return <article className="stack surface" key={allocation.allocation_id}>
        <h3>{allocation.club_name} · {allocation.plan_ref}</h3>
        <p>Deposit {formatGBP(allocation.deposit_minor)} · {formatGBP(allocation.verified_deposit_minor)} verified{due > 0 ? ` · ${formatGBP(due)} to record` : " · Required deposit verified"}</p>
        <p>Balance {formatGBP(allocation.balance_minor)} · {formatGBP(allocation.verified_balance_minor)} verified · Due {formatLondon(new Date(s.balance_due_at))}</p>
        {allocation.reports.map((report) => <p className="callout" key={report.report_id}>
          Unverified {report.kind} report: {formatGBP(report.amount_minor)} · Reference {report.reference}
        </p>)}
        {allocation.receipts.length ? <details><summary>Verified ledger entries</summary>
          <ul>{allocation.receipts.map((entry) => <li key={entry.entry_id}>
            {entry.receipt_id ?? "Correction"} · {entry.kind} · {formatGBP(entry.amount_minor)}
            {entry.received_at ? ` · Received ${formatLondon(new Date(entry.received_at))}` : ""}
            {entry.timely === false ? " · Received after pay-by" : ""}
            {" · "}Verified {formatLondon(new Date(entry.verified_at))}
          </li>)}</ul>
        </details> : null}
        {allocation.status === "live" || s.phase === "closed" || s.phase === "cancelled" ? <section aria-label={`Record receipt for ${allocation.club_name}`}>
          <CommandForm action={receiptAction} idempotencyKey={randomUUID()} label={`Record receipt for ${allocation.club_name}`}>
            <input type="hidden" name="session_id" value={s.id} />
            <input type="hidden" name="allocation_id" value={allocation.allocation_id} />
            <input type="hidden" name="expected_version" value={s.version} />
            <label className="stack-sm">Payment for<select name="kind" defaultValue="deposit"><option value="deposit">Deposit</option><option value="balance">Balance</option></select></label>
            <label className="stack-sm">Venue receipt identifier<input name="receipt_id" required maxLength={100} /></label>
            <label className="stack-sm">Funds actually received (London)<input type="datetime-local" name="received_at" required /></label>
            <label className="stack-sm">Amount received (GBP)<input name="amount" type="number" min="0.01" step="0.01" defaultValue={((due || allocation.deposit_minor) / 100).toFixed(2)} required /></label>
            <label className="stack-sm">Evidence reference (no personal or financial account details)<textarea name="evidence" maxLength={2000} /></label>
            {coordinator && s.phase === "published" ? <label className="choice"><input type="checkbox" name="diary_checked" />External diary checked</label> : null}
            <div className="done-actions">
              {coordinator && s.phase === "published" ? <button type="submit" name="intent" value="confirm" className="button button-primary">Record {formatGBP(due || allocation.deposit_minor)} and confirm</button> : null}
              <button type="submit" name="intent" value="record" className="button button-secondary">Record receipt only</button>
            </div>
            <p className="muted">If a confirmation condition fails, the receipt stays saved and the blocker is shown. Use Confirm session once the blocker is resolved.</p>
          </CommandForm>
        </section> : <p>Allocation {allocation.status}. Its financial history remains recorded.</p>}
      </article>;
    })}
    {coordinator && s.phase === "published" ? <CommandForm action={confirmAction} idempotencyKey={randomUUID()}>
      <input type="hidden" name="session_id" value={s.id} />
      <input type="hidden" name="expected_version" value={s.version} />
      <h3>Confirm after the venue checks</h3>
      <label className="choice"><input type="checkbox" name="diary_checked" />External diary checked</label>
      <button type="submit" className="button button-primary">Confirm session</button>
    </CommandForm> : null}
  </section>;
}

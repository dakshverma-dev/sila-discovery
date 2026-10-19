import { randomUUID } from "node:crypto";
import { saveDraftAction } from "@/app/venue/sessions/[id]/actions";
import { CommandForm } from "./command-form";
import type { VenueSessionRow } from "@/lib/sila/forms";
import { toLocal } from "@/lib/sila/time";

export function londonInput(iso: string | null): string {
  if (!iso) return "";
  const local = toLocal(new Date(iso));
  return `${local.date}T${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`;
}

export function DraftEditor({ session: s }: { session: VenueSessionRow }) {
  const inputs: { name: string; label: string; type?: string; value: string | number; min?: number; max?: number; step?: string }[] = [
    { name: "title", label: "Activity title", value: s.title },
    { name: "image_url", label: "Approved image URL (https)", type: "url", value: s.image_url ?? "" },
    { name: "meeting_point", label: "Meeting point", value: s.meeting_point ?? "" },
    { name: "starts_at", label: "Start (London)", type: "datetime-local", value: londonInput(s.starts_at) },
    { name: "ends_at", label: "End (London)", type: "datetime-local", value: londonInput(s.ends_at) },
    { name: "price", label: "Price per person (GBP, all compulsory charges included)", type: "number", step: "0.01", min: 0.01, value: (s.price_minor / 100).toFixed(2) },
    { name: "minimum", label: "Minimum places", type: "number", min: 1, max: 1000, value: s.minimum },
    { name: "capacity", label: "Capacity", type: "number", min: 1, max: 1000, value: s.capacity },
    { name: "max_clubs", label: "Maximum clubs", type: "number", min: 1, max: 2, value: s.max_clubs },
    { name: "deposit_percent", label: "Deposit (%)", type: "number", min: 0.01, max: 100, step: "0.01", value: s.deposit_bp / 100 },
    { name: "payment_window_days", label: "Calendar days to pay", type: "number", min: 5, max: 60, value: s.payment_window_days },
    { name: "fill_by", label: "Fill by (London)", type: "datetime-local", value: londonInput(s.fill_by) },
    { name: "decision_by", label: "Final decision (London)", type: "datetime-local", value: londonInput(s.decision_by) },
    { name: "balance_due_at", label: "Balance due (London)", type: "datetime-local", value: londonInput(s.balance_due_at) },
    { name: "resource_name", label: "Room and instructor / resource", value: s.resource_name ?? "" },
    { name: "hold_expires_at", label: "Resource held until (London)", type: "datetime-local", value: londonInput(s.hold_expires_at) },
    { name: "hold_checked_by", label: "Resource hold checked by", value: s.hold_checked_by ?? "" },
    { name: "venue_terms_version", label: "Venue terms version", value: s.venue_terms_version ?? "" },
    { name: "platform_terms_version", label: "Platform terms version", value: s.platform_terms_version ?? "" },
  ];
  const texts = [
    { name: "description", label: "Activity description", value: s.description ?? "", max: 4000 },
    { name: "inclusions", label: "Inclusions", value: s.inclusions ?? "", max: 2000 },
    { name: "covered_dates", label: "Approved staffed coverage dates", value: s.covered_dates.join("\n"), max: 1500 },
    { name: "venue_terms_text", label: "Full venue terms", value: s.venue_terms_text ?? "", max: 20000 },
    { name: "payment_route", label: "How clubs pay the venue directly", value: s.payment_route ?? "", max: 2000 },
  ];
  return <CommandForm action={saveDraftAction} idempotencyKey={randomUUID()}>
    <input type="hidden" name="session_id" value={s.id} />
    <input type="hidden" name="expected_version" value={s.version} />
    <div className="grid-2">
      {inputs.map((input) => <label key={input.name} className="stack-sm">
        {input.label}
        <input name={input.name} type={input.type ?? "text"} defaultValue={input.value}
          min={input.min} max={input.max} step={input.step} maxLength={input.type ? undefined : 2000} />
      </label>)}
    </div>
    {texts.map((item) => <div key={item.name} className="stack-sm">
      <label htmlFor={`draft-${item.name}`}>{item.label}</label>
      {item.name === "covered_dates" ? <span id="coverage-help" className="muted">One YYYY-MM-DD date per line. Include opening, fill, payment, verification and final decision cover.</span> : null}
      <textarea id={`draft-${item.name}`} name={item.name} rows={4} defaultValue={item.value} maxLength={item.max}
        aria-describedby={item.name === "covered_dates" ? "coverage-help" : undefined} />
    </div>)}
    <label className="choice"><input type="checkbox" name="access_facts_reviewed" defaultChecked={s.access_facts_reviewed} />
      Venue terms and access facts reviewed</label>
    <label className="choice"><input type="checkbox" name="run_at_minimum_approved" defaultChecked={s.run_at_minimum_approved} />
      Venue approves running at the minimum without public top-ups</label>
    <button className="button button-primary" type="submit">Save draft</button>
  </CommandForm>;
}

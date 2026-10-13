import Link from "next/link";
import { Flash, SubmitButton } from "@/components/ui";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import { ACCESS_OPTIONS, MAX_REFERENCES, MAX_WINDOWS } from "@/lib/demo/brief-form";
import type { Overview } from "@/lib/demo/views";
import { allowRequest } from "@/lib/server/rate-limit";
import { CallBudget } from "@/lib/providers/qloo/client";
import { QlooError } from "@/lib/providers/qloo/errors";
import type { SearchCandidate } from "@/lib/providers/qloo/parse";
import { qlooClientOrNull } from "@/lib/providers/qloo/server";
import { COPY } from "@/lib/ui/copy";
import { chooseReference, saveBrief } from "../../../actions";

const FIELD_LABEL: Record<string, string> = {
  budget: "Per-person maximum",
  budget_pence: "Per-person maximum",
  expected_seats: "Expected people",
  sharing_choice: "Sharing",
  access: "Access needs",
  access_requirements: "Access needs",
  availability: "Availability",
  references: "Cultural references",
};

const london = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", hourCycle: "h23", ...opts }).format(new Date(iso));

type Lookup =
  | { state: "none" }
  | { state: "unavailable"; reason: string }
  | { state: "results"; index: number; label: string; candidates: SearchCandidate[] };

export default async function BriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string; fields?: string; lookup?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const session = await requireDemoSession();
  const overview = await callApi<Overview>("get_workspace_overview", [session.actorId, session.workspaceId]);
  const group = overview.ok ? overview.data.organised_groups.find((g) => g.id === id) : undefined;
  if (!group) {
    return (
      <main id="main" className="page stack">
        <Flash error="NOT_FOUND" />
        <Link href="/demo">Back to dashboard</Link>
      </main>
    );
  }
  const b = group.brief;
  const badFields = (sp.fields ?? "").split(",").filter(Boolean);
  const lookup = await runLookup(session.actorId, b, sp.lookup);

  const windows = [...(b?.availability ?? [])];
  while (windows.length < MAX_WINDOWS) windows.push({ start_at: "", end_at: "" });
  const refs = [...(b?.references ?? [])];
  while (refs.length < Math.min(MAX_REFERENCES, (b?.references.length ?? 0) + 2)) {
    refs.push({ input_label: "", declared_meaning: null, resolved: false, entity_id: null, subtype: null });
  }

  return (
    <main id="main" className="page stack-lg">
      <p>
        <Link href="/demo">← Dashboard</Link>
      </p>
      <h1>{group.name}: group brief</h1>
      <Flash notice={sp.notice} error={sp.error} />
      {badFields.length > 0 && (
        <div className="surface stack-sm" role="group" aria-labelledby="errors-h">
          <h2 id="errors-h">Fix these fields</h2>
          <ul>
            {badFields.map((f) => (
              <li key={f}>
                <a href={`#${f.startsWith("window_") ? f + "_date" : f}`}>
                  {FIELD_LABEL[f] ?? (f.startsWith("window_") ? `Time window ${Number(f.split("_")[1]) + 1}` : f)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lookup.state !== "none" && <LookupPanel lookup={lookup} groupId={group.id} />}

      <form action={saveBrief} className="stack-lg">
        <input type="hidden" name="group_id" value={group.id} />
        <p className="muted">
          Saving creates version {(b?.version ?? 0) + 1}. Practical requirements are hard limits: they are never
          relaxed to find a match.
        </p>

        <fieldset className="stack">
          <legend>Size and budget</legend>
          <label htmlFor="expected_seats">Expected people (an estimate; only individual reservations count)</label>
          <input id="expected_seats" name="expected_seats" type="number" min={1} max={100} required
                 defaultValue={b?.expected_seats ?? ""} aria-invalid={badFields.includes("expected_seats") || undefined} />
          <label htmlFor="budget">Per-person maximum, all-in (£)</label>
          <input id="budget" name="budget" inputMode="decimal" required
                 defaultValue={b ? (b.budget_pence / 100).toFixed(2) : ""} aria-invalid={badFields.includes("budget") || undefined} />
        </fieldset>

        <fieldset className="stack-sm" id="sharing_choice">
          <legend>Sharing a session with other groups</legend>
          {(
            [
              ["WILLING_TO_SHARE", "Willing to share", "We can be suggested for shared sessions."],
              ["ASK_FIRST", "Ask us first", "Not suggested until we choose to share."],
              ["PRIVATE_ONLY", "Private only", "Never suggested for a shared session."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="choice">
              <input type="radio" name="sharing_choice" value={value} required defaultChecked={b?.sharing_choice === value} />
              <span>
                {label}
                <span className="muted"> — {hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="stack-sm" id="access">
          <legend>Access needs the venue must explicitly support</legend>
          {ACCESS_OPTIONS.map((a) => (
            <label key={a} className="choice">
              <input type="checkbox" name="access" value={a} defaultChecked={b?.access_requirements.includes(a)} />
              {a.replaceAll("_", " ")}
            </label>
          ))}
          <p className="muted">Only structured needs are stored; please do not add medical details.</p>
        </fieldset>

        <fieldset className="stack" id="availability">
          <legend>When the whole group is available (Edinburgh time)</legend>
          {windows.map((w, i) => (
            <div key={i} className="window-row" role="group" aria-label={`Time window ${i + 1}`}>
              <label htmlFor={`window_${i}_date`}>Date</label>
              <input id={`window_${i}_date`} name={`window_${i}_date`} type="date"
                     defaultValue={w.start_at ? london(w.start_at, { year: "numeric", month: "2-digit", day: "2-digit" }) : ""}
                     aria-invalid={badFields.includes(`window_${i}`) || undefined} />
              <label htmlFor={`window_${i}_start`}>From</label>
              <input id={`window_${i}_start`} name={`window_${i}_start`} type="time"
                     defaultValue={w.start_at ? london(w.start_at, { hour: "2-digit", minute: "2-digit" }) : ""} />
              <label htmlFor={`window_${i}_end`}>Until</label>
              <input id={`window_${i}_end`} name={`window_${i}_end`} type="time"
                     defaultValue={w.end_at ? london(w.end_at, { hour: "2-digit", minute: "2-digit" }) : ""} />
            </div>
          ))}
        </fieldset>

        <fieldset className="stack" id="references">
          <legend>Cultural references that matter to the group</legend>
          <label className="choice">
            <input type="checkbox" name="external_query_consent" defaultChecked={b?.external_query_consent} />
            <span>
              Allow these references to be looked up with Qloo to inform suggestions. Only the reference text and
              chosen entity IDs are sent; never names, contact details or access needs. This is separate from
              sharing a session.
            </span>
          </label>
          {refs.map((r, i) => (
            <div key={i} className="stack-sm reference-row">
              <label htmlFor={`ref_${i}_label`}>Reference {i + 1}</label>
              <input id={`ref_${i}_label`} name={`ref_${i}_label`} maxLength={200} defaultValue={r.input_label} />
              <label htmlFor={`ref_${i}_meaning`}>What it means to the group (optional, private)</label>
              <input id={`ref_${i}_meaning`} name={`ref_${i}_meaning`} maxLength={1000} defaultValue={r.declared_meaning ?? ""} />
              <input type="hidden" name={`ref_${i}_entity`} value={r.entity_id ?? ""} />
              <input type="hidden" name={`ref_${i}_subtype`} value={r.subtype ?? ""} />
              {r.input_label && (
                <p className="muted">
                  {r.resolved ? "Linked to a Qloo entity." : "Not linked yet."}{" "}
                  <Link href={`/demo/groups/${group.id}/brief?lookup=${i}`}>Look up in Qloo</Link>
                </p>
              )}
            </div>
          ))}
        </fieldset>

        <SubmitButton>Save brief</SubmitButton>
      </form>
    </main>
  );
}

async function runLookup(actorId: string, brief: Overview["organised_groups"][number]["brief"], raw?: string): Promise<Lookup> {
  if (raw === undefined || !brief) return { state: "none" };
  const index = Number(raw);
  const ref = brief.references[index];
  if (!Number.isInteger(index) || !ref) return { state: "none" };
  if (!brief.external_query_consent) {
    return { state: "unavailable", reason: "Allow Qloo lookups for this group and save the brief first." };
  }
  const client = qlooClientOrNull();
  if (!client) {
    return {
      state: "unavailable",
      reason: "Reference lookup needs live Qloo access, which is not configured here. The reference stays unlinked; no entity is guessed.",
    };
  }
  if (!allowRequest(`search:${actorId}`, 10, 60_000)) return { state: "unavailable", reason: "Please wait a moment before searching again." };
  try {
    const r = await client.search(ref.input_label, new CallBudget(2, Date.now() + 10_000), { take: 5 });
    return { state: "results", index, label: ref.input_label, candidates: r.candidates };
  } catch (error) {
    const code = error instanceof QlooError ? error.code : "QLOO_UNAVAILABLE";
    return { state: "unavailable", reason: code === "PROVIDER_SCHEMA_CHANGED" ? "Qloo returned an unexpected response." : COPY.qlooOutage };
  }
}

function LookupPanel({ lookup, groupId }: { lookup: Exclude<Lookup, { state: "none" }>; groupId: string }) {
  if (lookup.state === "unavailable") {
    return (
      <div className="callout callout-warning" role="status">
        {lookup.reason}
      </div>
    );
  }
  return (
    <section className="surface stack" aria-labelledby="lookup-h">
      <h2 id="lookup-h">Which “{lookup.label}” did you mean?</h2>
      {lookup.candidates.length === 0 ? (
        <p>No matches. The reference stays unlinked.</p>
      ) : (
        <form action={chooseReference} className="stack-sm">
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="index" value={lookup.index} />
          {lookup.candidates.map((c) => (
            <label key={c.entity_id} className="choice">
              <input type="radio" name="choice" value={`${c.entity_id}|${c.subtype ?? c.types[0] ?? "unknown"}`} required />
              <span>
                {c.name}
                <span className="muted"> — {(c.subtype ?? c.types[0] ?? "unknown type").replace("urn:entity:", "")}</span>
              </span>
            </label>
          ))}
          <SubmitButton>Use this match</SubmitButton>
        </form>
      )}
      <p className="muted">Results come from Qloo search. Choosing one stores its ID as a new brief version.</p>
    </section>
  );
}

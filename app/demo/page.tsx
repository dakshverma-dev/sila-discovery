import Link from "next/link";
import { Flash, ProgressMeter, StateBadge, SubmitButton } from "@/components/ui";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import type { Overview, ProposalSummary } from "@/lib/demo/views";
import { formatGbp } from "@/lib/domain/money";
import { formatSlot } from "@/lib/ui/format";
import { requestSuggestions } from "./actions";

const SHARING_LABEL = {
  WILLING_TO_SHARE: "Willing to share a session",
  PRIVATE_ONLY: "Private sessions only",
  ASK_FIRST: "Ask us first",
} as const;

export default async function DemoDashboard({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { notice, error } = await searchParams;
  const session = await requireDemoSession();
  const r = await callApi<Overview>("get_workspace_overview", [session.actorId, session.workspaceId]);
  if (!r.ok) {
    return (
      <main id="main" className="page">
        <Flash error={r.error.code} />
      </main>
    );
  }
  const o = r.data;
  const hasRole = o.venues.length + o.organised_groups.length + o.participant_groups.length > 0 || o.is_operator;

  return (
    <main id="main" className="page stack-lg">
      <Flash notice={notice} error={error} />
      <GuidedSteps />

      {o.organised_groups.map((g) => (
        <section key={g.id} className="stack" aria-labelledby={`g-${g.id}`}>
          <h2 id={`g-${g.id}`}>{g.name}</h2>
          <div className="grid-2">
            <div className="surface stack">
              <h3>Group brief</h3>
              {g.brief ? (
                <dl className="terms">
                  <dt>Expected people</dt>
                  <dd>About {g.brief.expected_seats} (an estimate, not a reservation)</dd>
                  <dt>Per-person maximum</dt>
                  <dd>{formatGbp(g.brief.budget_pence)} all-in</dd>
                  <dt>Sharing</dt>
                  <dd>{SHARING_LABEL[g.brief.sharing_choice]}</dd>
                  <dt>Access needs</dt>
                  <dd>{g.brief.access_requirements.join(", ").replaceAll("_", " ") || "None declared"}</dd>
                  <dt>Available</dt>
                  <dd>
                    <ul className="plain-list">
                      {g.brief.availability.map((w) => (
                        <li key={w.start_at}>{formatSlot(w.start_at, w.end_at)}</li>
                      ))}
                    </ul>
                  </dd>
                </dl>
              ) : (
                <p>No brief saved yet.</p>
              )}
              <p className="muted">Brief version {g.brief?.version ?? "–"}. Members: {g.member_count}.</p>
            </div>
            <div className="surface stack">
              <h3>Find a shared session</h3>
              <p>
                The matching agent checks every hard requirement first, then orders feasible options using
                cultural evidence. In this sandbox the evidence is synthetic.
              </p>
              {g.brief?.sharing_choice === "WILLING_TO_SHARE" ? (
                <form action={requestSuggestions}>
                  <input type="hidden" name="group_id" value={g.id} />
                  <SubmitButton>Find shared sessions</SubmitButton>
                </form>
              ) : (
                <p className="callout">
                  This group has not chosen to share a session, so it is never suggested for a shared booking.
                </p>
              )}
            </div>
          </div>
          <ProposalList title="Proposals including this group" proposals={g.proposals} />
        </section>
      ))}

      {o.participant_groups.map((g) => (
        <section key={g.id} className="stack" aria-labelledby={`pg-${g.id}`}>
          <h2 id={`pg-${g.id}`}>Your sessions with {g.name}</h2>
          <ProposalList
            title="Published proposals"
            proposals={g.proposals}
            empty="Nothing has been published for your group yet."
          />
        </section>
      ))}

      {o.venues.map((v) => (
        <section key={v.id} className="stack" aria-labelledby={`v-${v.id}`}>
          <h2 id={`v-${v.id}`}>{v.name}</h2>
          <ProposalList
            title="Proposals"
            proposals={v.proposals.filter((p) => p.state !== "DRAFT" || p.review_requested_at)}
            empty="No organiser has sent a suggestion for review yet."
          />
          <h3>Approved programmes</h3>
          <div className="card-grid">
            {v.experiences.map((e) => (
              <article key={e.id} className="surface stack">
                <h4>{e.title}</h4>
                <p className="muted">{e.description}</p>
                <dl className="terms">
                  <dt>All-in price</dt>
                  <dd>{e.quote ? `${formatGbp(e.quote.ticket_pence)} (quote v${e.quote.version})` : "No quote"}</dd>
                  <dt>Access</dt>
                  <dd>{e.access_support.join(", ").replaceAll("_", " ") || "None confirmed"}</dd>
                  <dt>Sessions</dt>
                  <dd>
                    <ul className="plain-list">
                      {e.slots.map((s) => (
                        <li key={s.id}>
                          {formatSlot(s.start_at, s.end_at)} · {s.capacity} seats · {s.status.toLowerCase()}
                        </li>
                      ))}
                    </ul>
                  </dd>
                  <dt>Book anchors</dt>
                  <dd>
                    <ul className="plain-list">
                      {e.anchors.map((a) => (
                        <li key={a.entity_id}>
                          {a.label}
                          <span className="muted"> — {a.mapping_reason}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </dl>
              </article>
            ))}
          </div>
        </section>
      ))}

      {o.is_operator && (
        <section className="surface stack">
          <h2>Operator</h2>
          <p>
            Review the audit trail of privileged actions in this sandbox. <Link href="/demo/activity">Open activity</Link>
          </p>
        </section>
      )}

      {!hasRole && <p>This persona has no role in the sandbox.</p>}
    </main>
  );
}

function ProposalList({
  title,
  proposals,
  empty = "No proposals yet.",
}: {
  title: string;
  proposals: ProposalSummary[];
  empty?: string;
}) {
  return (
    <div className="stack">
      <h3>{title}</h3>
      {proposals.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="plain-list stack">
          {proposals.map((p) => (
            <li key={p.id} className="surface proposal-row">
              <div className="stack-sm">
                <Link href={`/demo/proposals/${p.id}`} className="row-title">
                  {p.experience_title}
                </Link>
                <span className="muted">
                  {formatSlot(p.slot_start_at, p.slot_end_at)} · {formatGbp(p.ticket_pence)} per person ·{" "}
                  {p.group_names.join(", ")}
                </span>
                {p.my_reservation?.status === "RESERVED" && <span className="badge">You hold a seat</span>}
              </div>
              <div className="stack-sm row-status">
                <StateBadge state={p.state} />
                {p.state !== "DRAFT" && (
                  <ProgressMeter value={p.active_reservations} required={p.required_seats} capacity={p.capacity} />
                )}
                {p.state === "DRAFT" && p.review_requested_at && <span className="muted">Awaiting venue review</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GuidedSteps() {
  return (
    <details className="surface guide">
      <summary>How to try the full workflow</summary>
      <ol className="stack-sm">
        <li>As the book club organiser, choose <strong>Find shared sessions</strong> and compare the options.</li>
        <li>Open an option and <strong>send it for venue review</strong>.</li>
        <li>Switch to <strong>Rowan (venue manager)</strong>, open the proposal and <strong>publish</strong> it.</li>
        <li>Switch back to an organiser to <strong>accept</strong>; simulate the other organisers if you like.</li>
        <li>Switch to a participant and <strong>reserve one seat</strong>; simulate the rest to reach the threshold.</li>
        <li>As the venue manager, <strong>confirm</strong> the reservation booking, or revise the price to see re-acceptance.</li>
      </ol>
    </details>
  );
}

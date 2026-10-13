import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/sila/chrome";
import { isScenarioId, scenarioInput, SCENARIOS, type ScenarioId } from "@/lib/demo/scenarios";
import { SYNTHETIC_GROUP_NAMES } from "@/lib/demo/synthetic-fixture";
import { requiredSeats } from "@/lib/domain/economics";
import { formatGbp } from "@/lib/domain/money";
import { solve, type Candidate, type SlotReport } from "@/lib/domain/solver";
import type { GroupBrief, Offer } from "@/lib/domain/types";
import {
  COPY,
  GROUP_BLOCKER_COPY,
  SLOT_BLOCKER_COPY,
  SOURCE_MODE_COPY,
  UNKNOWN_REASON_COPY,
} from "@/lib/ui/copy";
import { formatSlot } from "@/lib/ui/format";

export const metadata: Metadata = { title: "Matching explorer" };

const groupName = (id: string) => SYNTHETIC_GROUP_NAMES[id] ?? id;

export default async function SandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string | string[] }>;
}) {
  const { scenario } = await searchParams;
  const scenarioId: ScenarioId = isScenarioId(scenario) ? scenario : "baseline";
  const input = scenarioInput(scenarioId);
  const result = solve(input);
  const offer = input.offers[0]!;

  return (
    <>
      <SiteHeader
        nav={[
          { num: "i", label: "Discover", href: "/" },
          { num: "ii", label: "Affinity", href: null },
          { num: "iii", label: "Proposal", href: null },
        ]}
      />
      <div className="sandbox-bar">
        <div className="wrap sandbox-bar-inner">
          <p className="demo-banner" role="note">
            <strong>Sandbox</strong>
            {COPY.demoBanner}
          </p>
        </div>
      </div>
      <main id="main" className="page stack-lg">
        <header className="stack">
          <p className="kicker">
            <Link href="/">sila</Link> · Matching explorer
          </p>
          <h1 className="page-title">Shared session sandbox</h1>
          <p>
            Explore how small groups could pool attendance to reserve one venue-approved session.
            Everything below is synthetic and computed by the deterministic matching rules; no
            Qloo request, reservation or payment is made.
          </p>
        </header>

        <nav aria-label="Sandbox scenarios">
          <ul className="scenario-list">
            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
              <li key={id}>
                <Link
                  href={id === "baseline" ? "/sandbox" : `/sandbox?scenario=${id}`}
                  aria-current={id === scenarioId ? "page" : undefined}
                  className="scenario-link"
                >
                  {SCENARIOS[id].label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="muted">{SCENARIOS[scenarioId].description}</p>
        </nav>

        <div className="grid-2">
          <ProgrammeSummary offer={offer} />
          <GroupList groups={input.groups} />
        </div>

        <section aria-labelledby="results-heading" className="stack">
          <h2 id="results-heading">Suggested shared sessions</h2>
          <p className="muted" role="status">
            {result.candidates.length === 0
              ? "No feasible shared session was found."
              : `${result.feasible_count} feasible option${result.feasible_count === 1 ? "" : "s"} found; showing up to three.`}
          </p>
          {result.candidates.length === 0 ? (
            <NoFeasibleResult reports={result.slot_reports} />
          ) : (
            result.candidates.map((c, i) => (
              <CandidateCard key={`${c.slot_id}:${c.group_ids.join()}`} candidate={c} index={i} />
            ))
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function ProgrammeSummary({ offer }: { offer: Offer }) {
  const slot = offer.slots[0]!;
  const threshold = requiredSeats(offer.quote, slot.capacity);
  return (
    <section className="surface stack" aria-labelledby="programme-heading">
      <span className="badge">Synthetic programme</span>
      <h2 id="programme-heading">{offer.experience.title}</h2>
      <dl className="terms">
        <dt>Session</dt>
        <dd>{formatSlot(slot.start_at, slot.end_at)}</dd>
        <dt>All-in price</dt>
        <dd>{formatGbp(offer.quote.ticket_pence)} per person</dd>
        <dt>Capacity</dt>
        <dd>{slot.capacity} seats</dd>
        <dt>Goes ahead at</dt>
        <dd>{threshold === null ? "Not viable at this capacity" : `${threshold} reserved seats`}</dd>
        <dt>Access support</dt>
        <dd>{offer.experience.access_support.join(", ").replaceAll("_", " ") || "None confirmed"}</dd>
      </dl>
      <p className="muted">{COPY.paymentBoundary}</p>
    </section>
  );
}

function GroupList({ groups }: { groups: readonly GroupBrief[] }) {
  return (
    <section className="surface stack" aria-labelledby="groups-heading">
      <h2 id="groups-heading">Interested groups</h2>
      <ul className="plain-list stack">
        {groups.map((g) => (
          <li key={g.group_id}>
            <strong>{groupName(g.group_id)}</strong>
            <span className="muted">
              {" "}
              · about {g.expected_seats} people · up to {formatGbp(g.budget_pence)} each ·{" "}
              {g.sharing === "WILLING_TO_SHARE" ? "willing to share" : "private session only"}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted">Expected attendance is a planning estimate; only individual reservations count.</p>
    </section>
  );
}

function CandidateCard({ candidate: c, index }: { candidate: Candidate; index: number }) {
  const headingId = `option-${index + 1}`;
  return (
    <article className="surface stack" aria-labelledby={headingId}>
      <div className="card-header">
        <h3 id={headingId}>Option {index + 1}</h3>
        <span className="badge">{c.status === "DRAFT" ? "Draft for venue review" : "Needs review"}</span>
      </div>
      <dl className="terms">
        <dt>Groups</dt>
        <dd>{c.group_ids.map(groupName).join(", ")}</dd>
        <dt>Session</dt>
        <dd>{formatSlot(c.slot_start_at, c.slot_end_at)}</dd>
        <dt>Attendance</dt>
        <dd>
          About {c.planned_seats} expected; {c.required_seats} reserved seats needed; {c.capacity} capacity
        </dd>
        <dt>Indicative quote</dt>
        <dd>
          {formatGbp(c.economics.revenue_pence)} reserved value against{" "}
          {formatGbp(c.economics.total_cost_pence)} quoted cost
        </dd>
        <dt>Payment</dt>
        <dd>{c.payment_status === "NOT_COLLECTED" ? "Not collected" : c.payment_status}</dd>
      </dl>

      <details>
        <summary>Why these groups</summary>
        <div className="stack details-body">
          <p>
            <span className="badge">{SOURCE_MODE_COPY[c.source_mode]}</span>
          </p>
          <ul className="plain-list stack">
            {c.group_ids.map((id) => {
              const u = c.group_utilities[id]!;
              return (
                <li key={id}>
                  <strong>{groupName(id)}:</strong>{" "}
                  {u.status === "scored"
                    ? `ranks this programme's anchors at ${Math.round(u.utility * 100)} on a 0 to 100 ordering scale.`
                    : UNKNOWN_REASON_COPY[u.reason]}
                </li>
              );
            })}
          </ul>
          <p className="muted">
            {c.cultural_score === null
              ? "A shared fit score is withheld until every group's evidence is reviewed."
              : `Shared fit ${Math.round(c.cultural_score * 100)} favours the least-matched group. It orders suggestions and is not a probability that anyone will attend or enjoy the session.`}
          </p>
        </div>
      </details>
      <p className="muted">
        Nothing is published automatically. A venue manager must review and publish these terms
        before organisers can accept or participants can reserve.
      </p>
    </article>
  );
}

function NoFeasibleResult({ reports }: { reports: SlotReport[] }) {
  return (
    <div className="surface stack">
      <p>
        The hard requirements were not relaxed to force a match. These are the blockers for each
        session:
      </p>
      {reports.map((r) => (
        <div key={r.slot_id} className="stack">
          <ul className="plain-list stack">
            {r.slot_blockers.map((b) => (
              <li key={b}>{SLOT_BLOCKER_COPY[b]}</li>
            ))}
            {Object.entries(r.group_blockers).map(([groupId, blockers]) => (
              <li key={groupId}>
                <strong>{groupName(groupId)}:</strong>{" "}
                {blockers.map((b) => GROUP_BLOCKER_COPY[b]).join(" ")}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

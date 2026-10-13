/* eslint-disable @next/next/no-img-element -- plates are pre-sized in public/art */
import Link from "next/link";
import { Band } from "@/components/sila/band";
import { Glyph } from "@/components/sila/chrome";
import { DemoBands, demoInCat } from "@/components/sila/demo-bands";
import { Flash, SubmitButton } from "@/components/ui";
import { Updates } from "@/components/updates";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import type { Overview, ProposalSummary } from "@/lib/demo/views";
import { formatGbp } from "@/lib/domain/money";
import { CATS, img, lookFor } from "@/lib/ui/sila/art";
import { DEMO_EXPS } from "@/lib/ui/sila/showcase";
import { durationWords, fd, glyphOf, illustrativeInterest, LEGEND, STATE_LABEL, timeRange, titleLines } from "@/lib/ui/sila/view";
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
  searchParams: Promise<{ notice?: string; error?: string; cat?: string }>;
}) {
  const { notice, error, cat } = await searchParams;
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

  // Every proposal this persona can see, once, in the order roles list them.
  const seen = new Map<string, ProposalSummary>();
  for (const p of [
    ...o.organised_groups.flatMap((g) => g.proposals),
    ...o.participant_groups.flatMap((g) => g.proposals),
    ...o.venues.flatMap((v) => v.proposals.filter((p) => p.state !== "DRAFT" || p.review_requested_at)),
  ])
    if (!seen.has(p.id)) seen.set(p.id, p);
  const all = [...seen.values()];
  const descriptions = new Map(o.venues.flatMap((v) => v.experiences.map((e) => [e.title, e.description] as const)));
  const filter = CATS.includes(cat as (typeof CATS)[number]) ? cat! : "All";
  const list = all.filter((p) => filter === "All" || lookFor(p.experience_title).cat === filter);
  const demoList = demoInCat(filter);

  return (
    <main id="main">
      {(notice || error) && (
        <div className="wrap flash-wrap">
          <Flash notice={notice} error={error} />
        </div>
      )}

      <section aria-label="Experiences forming" className="index" style={{ borderTop: 0 }}>
        <div className="wrap index-head">
          <div className="count">
            <span>{String(list.length + demoList.length).padStart(2, "0")}</span>
            <span>
              experiences
              <br />
              now forming
            </span>
          </div>
          <div className="index-tools">
            <nav aria-label="Filter by discipline" className="cats">
              {CATS.map((c) => (
                <Link key={c} href={c === "All" ? "/demo" : `/demo?cat=${encodeURIComponent(c)}`} aria-current={filter === c ? "true" : undefined}>
                  {c}
                  <sup>
                    {(c === "All" ? all.length : all.filter((p) => lookFor(p.experience_title).cat === c).length) +
                      (c === "All" ? DEMO_EXPS.length : DEMO_EXPS.filter((e) => e.cat === c).length)}
                  </sup>
                </Link>
              ))}
            </nav>
            <div className="legend">
              {LEGEND.map((lg) => (
                <span key={lg.label}>
                  <Glyph bg={lg.glyph} />
                  <strong>{lg.label}</strong>
                  <span className="op72">{lg.text}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {list.length === 0 && (
          <p className="wrap index-empty">
            {all.length === 0
              ? "Nothing of yours is forming yet. Organisers can ask the agent for shared sessions below."
              : "None of your proposals are in this discipline."}
          </p>
        )}
        {list.map((p) => {
          const look = lookFor(p.experience_title);
          const mine = p.my_reservation?.status === "RESERVED";
          const reserved = p.active_reservations;
          const remaining = Math.max(0, p.required_seats - reserved);
          const interested = illustrativeInterest(p.id, p.capacity, reserved);
          return (
            <Band
              key={p.id}
              no={all.indexOf(p) + 1}
              look={look}
              title={p.experience_title}
              href={`/demo/proposals/${p.id}`}
              place={`Edinburgh · ${fd(p.slot_start_at)}, ${timeRange(p.slot_start_at, p.slot_end_at)}`}
              description={descriptions.get(p.experience_title) ?? look.short}
              format={`${durationWords(p.slot_start_at, p.slot_end_at)} · up to ${p.capacity} people · ${formatGbp(p.ticket_pence)} per person`}
              glyph={glyphOf(p.state)}
              statusLabel={STATE_LABEL[p.state]}
              capacity={p.capacity}
              required={p.required_seats}
              reserved={reserved}
              mine={mine}
              demandText={
                p.state === "DRAFT"
                  ? "Draft for venue review."
                  : p.state === "CONFIRMED" || p.state === "COMPLETED"
                    ? `${reserved} reserved, ${Math.max(0, p.capacity - reserved)} places left.`
                    : `${reserved} of ${p.required_seats} reserved.`
              }
              possible={
                p.state === "DRAFT"
                  ? p.review_requested_at
                    ? "Awaiting venue review."
                    : "Not yet sent to the venue."
                  : p.state === "CONFIRMED" || p.state === "COMPLETED"
                    ? "The minimum was reached and the venue confirmed."
                    : p.state === "OPEN"
                      ? `${remaining} more and the request goes to the venue. ${interested} others are interested (illustrative).`
                      : p.state === "READY"
                        ? "Minimum reached; the venue is reviewing the request."
                        : "Closed."
              }
              pair={p.group_names.join(" + ")}
              interestId={p.state === "OPEN" && !mine ? p.id : undefined}
            >
              {mine && <span className="tag-illus" style={{ borderColor: "var(--cin)" }}>You hold a seat</span>}
            </Band>
          );
        })}
        {demoList.length > 0 && (
          <>
            <div className="wrap demo-divider">
              <span className="kicker">Also forming elsewhere · demo data</span>
              <span className="note">Demonstration experiences from the sila design. They are not part of this sandbox and nothing in them is stored.</span>
            </div>
            <DemoBands list={demoList} startAt={all.length + 1} />
          </>
        )}
      </section>

      <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(40px,5vw,72px)", paddingTop: "clamp(48px,6vw,96px)" }}>
        <Updates actorId={session.actorId} workspaceId={session.workspaceId} />
        <GuidedSteps />

        {o.organised_groups.map((g) => (
          <section key={g.id} className="role-block" aria-labelledby={`g-${g.id}`}>
            <div className="section-head">
              <h2 id={`g-${g.id}`} className="h-xl">
                {g.name}
              </h2>
              <p>{g.public_summary}</p>
            </div>
            <div className="grid-2">
              <div className="act">
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
                <p className="note">
                  Brief version {g.brief?.version ?? "–"}. Members: {g.member_count}.{" "}
                  <Link href={`/demo/groups/${g.id}/brief`}>Edit brief</Link>
                </p>
              </div>
              <div className="act">
                <h3>Find a shared session</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>
                  The matching agent checks every hard requirement first, then orders feasible options using cultural
                  evidence. In this sandbox the evidence is synthetic.
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
          </section>
        ))}

        {o.participant_groups.map((g) => (
          <section key={g.id} className="role-block" aria-labelledby={`pg-${g.id}`}>
            <div className="section-head">
              <h2 id={`pg-${g.id}`} className="h-xl">
                Your sessions with <em>{g.name}</em>
              </h2>
              <p>
                {g.proposals.length === 0
                  ? "Nothing has been published for your group yet."
                  : `${g.proposals.length} published proposal${g.proposals.length === 1 ? "" : "s"} above. Open one to reserve your own seat.`}
              </p>
            </div>
          </section>
        ))}

        {o.venues.map((v) => (
          <section key={v.id} className="role-block" aria-labelledby={`v-${v.id}`}>
            <div className="section-head">
              <h2 id={`v-${v.id}`} className="h-xl">
                {v.name}
              </h2>
              <p>
                {v.proposals.some((p) => p.state !== "DRAFT" || p.review_requested_at)
                  ? "Proposals sent to this venue appear in the index above."
                  : "No organiser has sent a suggestion for review yet."}
              </p>
            </div>
            <h3 className="h-lg" style={{ margin: 0 }}>
              Approved programmes
            </h3>
            <div className="card-grid">
              {v.experiences.map((e) => {
                const look = lookFor(e.title);
                const t = titleLines(e.title);
                return (
                  <article key={e.id} className="act">
                    <div className="suggest" style={{ gridTemplateColumns: "84px minmax(0,1fr)" }}>
                      <span className="pic" style={{ background: look.theme.ground }}>
                        <img src={img(look.layers[0]!.k)} alt="" loading="lazy" />
                      </span>
                      <span className="txt">
                        <span className="kicker op75">{look.cat}{t.illustrative ? " · Illustrative" : ""}</span>
                        <h4 className="ttl" style={{ margin: 0, fontWeight: 400 }}>{t.plain}</h4>
                      </span>
                    </div>
                    <p className="note" style={{ margin: 0 }}>{e.description}</p>
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
                );
              })}
            </div>
          </section>
        ))}

        {o.is_operator && (
          <section className="act">
            <h2 className="h-lg" style={{ margin: 0 }}>Operator</h2>
            <p>
              Review the audit trail of privileged actions in this sandbox. <Link href="/demo/activity">Open activity</Link>
            </p>
          </section>
        )}

        {!hasRole && <p>This persona has no role in the sandbox.</p>}
      </div>
    </main>
  );
}

function GuidedSteps() {
  return (
    <details className="act">
      <summary>How to try the full workflow</summary>
      <ul className="rules" style={{ marginTop: 8 }}>
        {[
          <>As the book club organiser, choose <strong>Find shared sessions</strong> and compare the options.</>,
          <>Open an option and <strong>send it for venue review</strong>.</>,
          <>Switch to <strong>Rowan (venue manager)</strong>, open the proposal and <strong>publish</strong> it.</>,
          <>Switch back to an organiser to <strong>accept</strong>; simulate the other organisers if you like.</>,
          <>Switch to a participant and <strong>commit a place</strong>; simulate the rest to reach the threshold.</>,
          <>As the venue manager, <strong>confirm</strong> the reservation booking, or revise the price to see re-acceptance.</>,
        ].map((t, i) => (
          <li key={i}>
            <span>{["i", "ii", "iii", "iv", "v", "vi"][i]}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

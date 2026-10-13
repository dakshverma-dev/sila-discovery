/* eslint-disable @next/next/no-img-element -- plates are pre-sized in public/art */
import Link from "next/link";
import { ArtLayers } from "@/components/sila/art-layers";
import { themeVars } from "@/components/sila/band";
import { ArrowDown, ArrowLeft, ArrowRight, Glyph, RevealLines } from "@/components/sila/chrome";
import { InterestToggle, Marks } from "@/components/sila/interest";
import { Flash, IdemInput, ReadinessList, SourceBadge, SubmitButton } from "@/components/ui";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import type { ProposalDetail } from "@/lib/demo/views";
import { formatGbp } from "@/lib/domain/money";
import { CIN, credit, groupLook, img, INDIGO, INK, JADE, lookFor, OLIVE, OX } from "@/lib/ui/sila/art";
import {
  dayMonth, fd, glyphOf, illustrativeInterest, planTimes, stageOf, STATE_LABEL, timeRange, titleLines, unitOf,
} from "@/lib/ui/sila/view";
import { COPY } from "@/lib/ui/copy";
import { formatDateTime, formatSlot, londonInputValue } from "@/lib/ui/format";
import {
  cancelProposal, completeProposal, confirmBooking, decide, publishProposal, requestReview, reviseProposal, simulate,
} from "../../actions";

const REASON_KIND = {
  constraint: "Checked requirement",
  observation: "Cultural evidence",
  interpretation: "Our interpretation",
} as const;

const shortName = (n: string) => n.replace(/^Illustrative /i, "");

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ id }, { notice, error }] = await Promise.all([params, searchParams]);
  const session = await requireDemoSession();
  const r = await callApi<ProposalDetail>("get_proposal_detail", [session.actorId, id]);
  if (!r.ok) {
    return (
      <main id="main" className="page stack">
        <Flash error={r.error.code} />
        <p>
          <Link href="/demo">Back to all experiences</Link>
        </p>
      </main>
    );
  }
  const p = r.data;
  const v = p.viewer;
  const look = lookFor(p.experience_title);
  const t = titleLines(p.experience_title);
  const open = p.state === "OPEN" || p.state === "READY";
  const confirmed = p.state === "CONFIRMED" || p.state === "COMPLETED";
  const myGroups = p.group_summaries.filter((g) => v.member_of.includes(g.group_id));
  const accepted = new Set(p.group_summaries.filter((g) => g.decision === "ACCEPT").map((g) => g.group_id));
  const mySeat =
    v.my_reservation?.status === "RESERVED" && v.my_reservation.proposal_version_id === p.proposal_version_id
      ? v.my_reservation
      : null;
  const canReserve = open && myGroups.some((g) => accepted.has(g.group_id));
  const hasRole = v.organiser_of.length > 0 || v.is_venue_manager || v.is_operator || (open && myGroups.length > 0);
  const defaultDeadline = londonInputValue(new Date(Date.parse(p.slot_start_at) - 2 * 86_400_000), 18, 0);

  const reserved = p.active_reservations;
  const remaining = Math.max(0, p.required_seats - reserved);
  const stage = stageOf(p.state);
  const venue = p.venue_name;
  const [A, B] = p.group_summaries;
  const gA = A ? groupLook(A.name) : null;
  const gB = B ? groupLook(B.name) : null;
  const unit = unitOf(p.slot_start_at);
  const reservedText = `${reserved} individual reservation${reserved === 1 ? "" : "s"} of ${p.required_seats} needed · capacity ${p.capacity}`;

  const statusSub =
    p.state === "DRAFT"
      ? p.review_requested_at
        ? "Sent to the venue for review. Not yet published."
        : "Draft for venue review. Not yet sent to the venue."
      : p.state === "OPEN"
        ? `Reservations open${p.deadline ? ` until ${dayMonth(p.deadline)}` : ""}. At ${p.required_seats}, the request goes to ${venue}.`
        : p.state === "READY"
          ? `Minimum reached. ${venue} still needs to confirm.`
          : confirmed
            ? `Confirmed by ${venue}.`
            : "This proposal is closed.";

  const stages = ["Proposed", "Awaiting venue", "Confirmed"].map((label, i) => ({
    label,
    sub: [
      p.published_at ? `Since ${dayMonth(p.published_at)} · gathering reservations` : "Waiting for the venue to publish terms",
      `At ${p.required_seats} reservations, the request goes to ${venue}`,
      `${venue} confirms the date`,
    ][i]!,
    dot: i < stage ? INK : i === stage ? CIN : "transparent",
    dotB: i <= stage ? (i === stage ? CIN : INK) : "oklch(0.22 0.02 50 / .35)",
    line: i <= stage ? (i === stage ? CIN : INK) : "oklch(0.22 0.02 50 / .15)",
  }));

  const rules = confirmed
    ? [
        "This experience is confirmed by the venue. No payment is collected here.",
        "Withdrawing is not available once the venue has confirmed; contact the venue instead.",
        "Interest beyond capacity would be passed to the venue in case it adds a second date.",
      ]
    : [
        `Registering interest is free and holds no place. In this prototype it stays on your device; it only shows that the ${unit} is wanted.`,
        `Committing holds one place for you. Only individual reservations count toward the minimum of ${p.required_seats}.`,
        `If the minimum isn’t reached${p.deadline ? ` by ${dayMonth(p.deadline)}` : ""}, the proposal closes and nothing is charged.`,
      ];

  return (
    <main id="main">
      {(notice || error) && (
        <div className="wrap flash-wrap">
          <Flash notice={notice} error={error} />
        </div>
      )}
      {p.superseded_versions > 0 && (
        <div className="wrap flash-wrap">
          <div className="callout callout-warning" role="note">
            <strong>These terms were revised.</strong> Decisions and seats from earlier versions no longer apply;
            organisers must accept version {p.version} and participants must reserve again.
          </div>
        </div>
      )}

      <section aria-label={t.plain} className="p-hero" style={themeVars(look)}>
        <div className="p-art">
          <div className="p-art-inner">
            <ArtLayers look={look} mode="p" />
          </div>
          <span className="plates-abs">{[...new Set(look.layers.map((l) => l.k))].map(credit).join(" · ")}</span>
        </div>

        <div className="p-panel">
          <div className="crumbs">
            <Link href="/demo">
              <ArrowLeft />
              All experiences
            </Link>
            <span className="op7">
              {look.cat} · Edinburgh · Version {p.version}
            </span>
          </div>
          <h1 className="p-title">
            <RevealLines lines={t.lines} />
          </h1>
          {t.illustrative && <span className="tag-illus">Illustrative programme</span>}
          <div className="chip-row">
            <span className="chip">
              <Glyph bg={glyphOf(p.state)} />
              {STATE_LABEL[p.state]}
            </span>
            <span className="op75">{statusSub}</span>
          </div>

          {A && B && gA && gB && (
            <Link href={`/demo/proposals/${p.id}/affinity`} className="pair-link">
              <span className="avatars">
                <span>
                  <img src={img(gA.img)} alt="" />
                </span>
                <span>
                  <img src={img(gB.img)} alt="" />
                </span>
              </span>
              <span className="names">
                <span>
                  {A.name} + {B.name}
                  {p.group_summaries.length > 2 ? ` + ${p.group_summaries.length - 2} more` : ""}
                </span>
                <span>
                  {look.shared.length} shared interests: {look.shared.map((s) => s[0]).join(", ")}
                </span>
              </span>
              <span className="go">
                Affinity
                <ArrowRight />
              </span>
            </Link>
          )}

          <p className="p-short">{p.rationale?.summary ?? look.short}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="head-num">
              <span>{confirmed ? String(Math.max(0, p.capacity - reserved)) : `${reserved}/${p.required_seats}`}</span>
              <span>
                {confirmed
                  ? `places left. Confirmed by ${venue}.`
                  : p.state === "DRAFT"
                    ? "reserved. Seats open once the venue publishes these terms."
                    : remaining > 0
                      ? `reserved. ${remaining} more and the request goes to ${venue}.`
                      : `reserved. Minimum reached; ${venue} is reviewing.`}
              </span>
            </div>
            <Marks
              id={p.id}
              capacity={p.capacity}
              required={p.required_seats}
              others={reserved - (mySeat ? 1 : 0)}
              mine={mySeat ? 1 : 0}
              interested={open ? illustrativeInterest(p.id, p.capacity, reserved) : 0}
            />
            <div className="marks-key">
              <span><i style={{ background: "var(--ink)" }} />Reserved</span>
              <span><i style={{ border: "1.5px solid var(--ink)" }} />Interested (not counted)</span>
              <span><i style={{ border: "1.5px dotted oklch(0.22 0.02 50 / .5)" }} />Open</span>
              <span><i style={{ background: "var(--cin)" }} />You</span>
              <span><i style={{ width: 2, height: 15, background: "var(--ox)" }} />Venue minimum</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="kicker op7" id="date-label">
              Date
            </span>
            <div role="radiogroup" aria-labelledby="date-label" className="dates">
              <span role="radio" aria-checked="true" tabIndex={0} className="date-opt">
                <span>{fd(p.slot_start_at)}</span>
                <span>
                  {timeRange(p.slot_start_at, p.slot_end_at)} · {reserved} {confirmed ? "booked" : "reserved"}
                </span>
              </span>
            </div>
          </div>

          <div className="p-actions">
            <div className="row">
              {mySeat ? (
                <Link href={`/demo/proposals/${p.id}/reserve`} className="btn-ink lg">
                  You hold a place · view
                </Link>
              ) : canReserve ? (
                <>
                  <Link href={`/demo/proposals/${p.id}/reserve`} className="btn-ink lg">
                    Commit a place · {formatGbp(p.ticket_pence)}
                  </Link>
                  <InterestToggle id={p.id} variant="proposal" />
                </>
              ) : hasRole ? (
                <a href="#your-part" className="btn-ink lg">
                  Your part in this proposal
                  <ArrowDown />
                </a>
              ) : open ? (
                <InterestToggle id={p.id} variant="proposal" />
              ) : null}
            </div>
            <span className="note">
              {mySeat
                ? "Your reservation is the red mark above."
                : p.state === "CONFIRMED"
                  ? COPY.confirmed
                  : p.state === "READY"
                    ? COPY.ready
                    : open && myGroups.length > 0 && !canReserve
                      ? "Your group organiser has not accepted these terms yet, so seats cannot be reserved."
                      : COPY.paymentBoundary}
            </span>
          </div>
        </div>
      </section>

      <section className="wrap section two-col" aria-labelledby="terms-h">
        <div>
          <h2 id="terms-h" className="h-lg">
            The terms
          </h2>
          <dl className="terms">
            <dt>Venue</dt>
            <dd>{venue}</dd>
            <dt>Session</dt>
            <dd>{formatSlot(p.slot_start_at, p.slot_end_at)}</dd>
            <dt>All-in price</dt>
            <dd>
              {formatGbp(p.ticket_pence)} per person
              {!p.quote_is_current && <span className="badge state-expired"> Newer venue quote exists</span>}
            </dd>
            <dt>Goes ahead at</dt>
            <dd>{p.required_seats} individual reservations</dd>
            <dt>Reserved</dt>
            <dd>{p.state === "DRAFT" ? "Seats open once published" : reservedText}</dd>
            <dt>Reserve by</dt>
            <dd>{p.deadline ? formatDateTime(p.deadline) : "Set when the venue publishes"}</dd>
            <dt>Access support</dt>
            <dd>{p.access_support.join(", ").replaceAll("_", " ") || "None confirmed"}</dd>
            <dt>Payment</dt>
            <dd>Not collected</dd>
            <dt>Published</dt>
            <dd>{p.published_at ? `Version ${p.version}, ${formatDateTime(p.published_at)}` : "Not published"}</dd>
          </dl>
          <p className="note" style={{ marginTop: 14 }}>
            {p.experience_description} {COPY.paymentBoundary}
          </p>
        </div>
        <div>
          <h2 className="h-lg">The groups</h2>
          <ul className="groups-list">
            {p.group_summaries.map((g) => (
              <li key={g.group_id}>
                <span className="av">
                  <img src={img(groupLook(g.name).img)} alt="" />
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>
                    <strong>{g.name}</strong>{" "}
                    <span className="badge">
                      {g.decision === "ACCEPT" ? "Accepted" : g.decision === "DECLINE" ? "Declined" : "No decision yet"}
                    </span>
                  </span>
                  <span className="muted">{g.summary}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="note" style={{ marginTop: 10 }}>
            Other groups&apos; member lists and private preferences are never shown.
          </p>
          {p.readiness_blockers && (
            <div style={{ marginTop: 18 }}>
              <span className="kicker" style={{ fontWeight: 600 }}>
                Before the venue can confirm
              </span>
              <ReadinessList blockers={p.readiness_blockers} />
            </div>
          )}
        </div>
      </section>

      {hasRole && (
        <section id="your-part" className="wrap section" aria-labelledby="part-h">
          <div className="section-head">
            <h2 id="part-h" className="h-xl">
              Your <em>part</em>
            </h2>
            <p>Every action re-checks the current terms. Nothing here takes or implies payment.</p>
          </div>
          <div className="acts">
            {v.organiser_of.length > 0 && (
              <div className="act" aria-labelledby="org-h" role="group">
                <h3 id="org-h">Organiser actions</h3>
                {p.state === "DRAFT" && !p.review_requested_at && (
                  <form action={requestReview}>
                    <input type="hidden" name="proposal_id" value={p.id} />
                    <SubmitButton>Send this option for venue review</SubmitButton>
                  </form>
                )}
                {p.state === "DRAFT" && p.review_requested_at && <p>Waiting for the venue to review and publish.</p>}
                {open &&
                  p.group_summaries
                    .filter((g) => v.organiser_of.includes(g.group_id))
                    .map((g) => (
                      <form key={g.group_id} action={decide} className="stack-sm form-panel">
                        <span className="kicker" style={{ fontWeight: 600 }}>
                          Decision for {g.name}
                        </span>
                        <p className="note" style={{ margin: 0 }}>
                          Accepting agrees to version {p.version} and to sharing the session. It does not reserve any
                          seats; each person reserves their own.
                        </p>
                        <input type="hidden" name="proposal_id" value={p.id} />
                        <input type="hidden" name="version_id" value={p.proposal_version_id} />
                        <input type="hidden" name="version" value={p.version} />
                        <input type="hidden" name="group_id" value={g.group_id} />
                        <IdemInput />
                        <fieldset className="stack-sm">
                          <legend>Decision</legend>
                          <label className="choice">
                            <input type="radio" name="decision" value="ACCEPT" defaultChecked={g.decision !== "DECLINE"} />
                            Accept these terms
                          </label>
                          <label className="choice">
                            <input type="radio" name="decision" value="DECLINE" defaultChecked={g.decision === "DECLINE"} />
                            Decline
                          </label>
                        </fieldset>
                        <label htmlFor={`rc-${g.group_id}`}>Reason if declining (optional)</label>
                        <select id={`rc-${g.group_id}`} name="reason_category" defaultValue="">
                          <option value="">No reason given</option>
                          <option value="SUBJECT">Subject</option>
                          <option value="INTERPRETATION">Interpretation</option>
                          <option value="COST">Cost</option>
                          <option value="TIME">Time</option>
                          <option value="ACCESS">Access</option>
                          <option value="SHARING">Sharing</option>
                          <option value="OTHER">Other</option>
                        </select>
                        <label htmlFor={`r-${g.group_id}`}>Note (optional)</label>
                        <input id={`r-${g.group_id}`} name="reason" maxLength={500} />
                        <SubmitButton>Save decision</SubmitButton>
                      </form>
                    ))}
                {open && <DemoHelper proposalId={p.id} what="ACCEPT" label="Simulate the other organisers accepting" />}
              </div>
            )}

            {open && myGroups.length > 0 && (
              <div className="act" aria-labelledby="seat-h" role="group">
                <h3 id="seat-h">Your place</h3>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>
                  {mySeat
                    ? `You hold one place with ${p.group_summaries.find((g) => g.group_id === mySeat.group_id)?.name}.`
                    : canReserve
                      ? "Your group has accepted these terms. Commit a place to count toward the minimum."
                      : "Your group organiser has not accepted these terms yet, so seats cannot be reserved."}
                </p>
                {(mySeat || canReserve) && (
                  <Link href={`/demo/proposals/${p.id}/reserve`} className="link-under" style={{ alignSelf: "flex-start" }}>
                    {mySeat ? "View your place" : "Commit a place"}
                  </Link>
                )}
                <DemoHelper proposalId={p.id} what="RESERVE" label="Simulate other members reserving up to the threshold" />
              </div>
            )}

            {(v.is_venue_manager || v.is_operator) && (
              <div className="act" aria-labelledby="venue-h" role="group">
                <h3 id="venue-h">{v.is_venue_manager ? "Venue actions" : "Operator actions"}</h3>
                {v.is_venue_manager && p.state === "DRAFT" && (
                  <form action={publishProposal} className="stack-sm">
                    <p className="note" style={{ margin: 0 }}>
                      Publishing freezes these terms as version {p.version}. Hard requirements are checked again before
                      it is published.
                    </p>
                    <input type="hidden" name="proposal_id" value={p.id} />
                    <IdemInput />
                    <label htmlFor="deadline">Reservation deadline (Edinburgh time)</label>
                    <input id="deadline" name="deadline" type="datetime-local" defaultValue={defaultDeadline} required />
                    <SubmitButton>Publish terms</SubmitButton>
                  </form>
                )}
                {v.is_venue_manager && open && (
                  <form action={confirmBooking} className="stack-sm">
                    <input type="hidden" name="proposal_id" value={p.id} />
                    <input type="hidden" name="version" value={p.version} />
                    <IdemInput />
                    <p className="note" style={{ margin: 0 }}>
                      Confirmation re-checks every organiser acceptance, the reserved seats, capacity, the deadline and
                      the current quote. Payment is not collected.
                    </p>
                    <SubmitButton>Confirm reservation booking</SubmitButton>
                  </form>
                )}
                {v.is_venue_manager && open && (
                  <details>
                    <summary>Revise the price</summary>
                    <form action={reviseProposal} className="stack-sm details-body">
                      <p className="note" style={{ margin: 0 }}>
                        A revision publishes a new version. Earlier organiser decisions and every reserved seat are
                        released.
                      </p>
                      <input type="hidden" name="proposal_id" value={p.id} />
                      <IdemInput />
                      <label htmlFor="ticket">New all-in price per person (£)</label>
                      <input id="ticket" name="ticket" inputMode="decimal" defaultValue={(p.ticket_pence / 100).toFixed(2)} required />
                      <label htmlFor="rdeadline">Reservation deadline (Edinburgh time)</label>
                      <input id="rdeadline" name="deadline" type="datetime-local" defaultValue={defaultDeadline} required />
                      <SubmitButton variant="secondary">Publish revised terms</SubmitButton>
                    </form>
                  </details>
                )}
                {v.is_venue_manager && p.state === "CONFIRMED" && (
                  <form action={completeProposal}>
                    <input type="hidden" name="proposal_id" value={p.id} />
                    <IdemInput />
                    <SubmitButton variant="secondary">Record that the session was delivered</SubmitButton>
                  </form>
                )}
                {["DRAFT", "OPEN", "READY", "CONFIRMED"].includes(p.state) && (
                  <details>
                    <summary>Cancel this proposal</summary>
                    <form action={cancelProposal} className="stack-sm details-body">
                      <input type="hidden" name="proposal_id" value={p.id} />
                      <IdemInput />
                      <label htmlFor="cancel-reason">Reason (recorded in the audit trail)</label>
                      <input id="cancel-reason" name="reason" minLength={3} maxLength={500} required />
                      <p className="note" style={{ margin: 0 }}>There is no automatic refund because no payment is collected.</p>
                      <SubmitButton variant="destructive">Cancel proposal</SubmitButton>
                    </form>
                  </details>
                )}
                {open && v.is_venue_manager && (
                  <div className="stack-sm">
                    <DemoHelper proposalId={p.id} what="ACCEPT" label="Simulate organisers accepting" />
                    <DemoHelper proposalId={p.id} what="RESERVE" label="Simulate members reserving up to the threshold" />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="wrap section" aria-labelledby="why-h" style={{ ["--accent-on-light" as string]: look.theme.onLight }}>
        <div className="section-head">
          <h2 id="why-h" className="h-xl">
            Why it was <em>suggested</em>
          </h2>
          <p>{p.rationale?.summary ?? `${look.why} (Illustrative: this proposal has no agent rationale attached.)`}</p>
        </div>
        {p.rationale && (
          <>
            <div style={{ paddingTop: 18 }}>
              <SourceBadge mode={p.source_mode} />
            </div>
            <ul className="reasons">
              {p.rationale.reasons.map((reason, i) => (
                <li key={i}>
                  <span className="kind">{REASON_KIND[reason.kind]}</span>
                  <span>{reason.text}</span>
                </li>
              ))}
              <li>
                <span className="kind">Uncertainty</span>
                {p.rationale.uncertainties.map((u) => (
                  <span key={u}>{u}</span>
                ))}
              </li>
            </ul>
            {Object.entries(p.rationale.by_group).length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary>Fit details you are allowed to see</summary>
                <ul className="plain-list stack-sm details-body">
                  {Object.entries(p.rationale.by_group).map(([gid, fit]) => (
                    <li key={gid}>
                      <strong>{p.group_summaries.find((g) => g.group_id === gid)?.name ?? "Group"}:</strong> {fit.note}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        <div className="shared-grid">
          {look.shared.map((s, i) => (
            <figure key={s[0]} className="shared-fig">
              <div className="plate-box" style={{ background: [OX, JADE, INDIGO, OLIVE][i % 4] }}>
                {s[4] ? <img src={img(s[4])} alt="" loading="lazy" style={{ objectPosition: s[5] ?? "50% 50%" }} /> : <span className="word">{s[0]}</span>}
              </div>
              <figcaption>
                <span>{s[0]}</span>
                <span>{s[3]}</span>
                <span>
                  {A ? shortName(A.name) : "Group A"} {s[1]}% · {B ? shortName(B.name) : "Group B"} {s[2]}%
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="fine">
          Percentages are the share of each community’s active members whose saved works, visits and follows include the
          interest. Illustrative figures until Qloo’s taste data is connected.
        </p>
      </section>

      <section className="wrap section two-col">
        <div>
          <h2 className="h-lg">The {unit}</h2>
          <ol className="plan">
            {planTimes(look.plan, p.slot_start_at, p.slot_end_at).map((pl) => (
              <li key={pl.t + pl.d}>
                <span>{pl.t}</span>
                <span>{pl.d}</span>
              </li>
            ))}
          </ol>
          <p className="fine">Illustrative running order; the venue publishes the real one with its programme notes.</p>
        </div>
        <div>
          <h2 className="h-lg">How it becomes real</h2>
          <div className="stages">
            {stages.map((s) => (
              <div key={s.label} style={{ borderTopColor: s.line }}>
                <span aria-hidden="true" className="dot" style={{ background: s.dot, borderColor: s.dotB }} />
                <div className="label">{s.label}</div>
                <div className="sub">{s.sub}</div>
              </div>
            ))}
          </div>
          <ul className="rules">
            {rules.map((t, i) => (
              <li key={t}>
                <span>{["i", "ii", "iii"][i]}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function DemoHelper({ proposalId, what, label }: { proposalId: string; what: "ACCEPT" | "RESERVE"; label: string }) {
  return (
    <form action={simulate} className="demo-helper">
      <input type="hidden" name="proposal_id" value={proposalId} />
      <input type="hidden" name="what" value={what} />
      <button type="submit">Sandbox: {label}</button>
    </form>
  );
}

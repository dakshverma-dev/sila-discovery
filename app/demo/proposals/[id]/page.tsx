import Link from "next/link";
import {
  Flash, IdemInput, ProgressMeter, ReadinessList, SourceBadge, StateBadge, SubmitButton,
} from "@/components/ui";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import type { ProposalDetail } from "@/lib/demo/views";
import { formatGbp } from "@/lib/domain/money";
import { COPY } from "@/lib/ui/copy";
import { formatDateTime, formatSlot, londonInputValue } from "@/lib/ui/format";
import {
  cancelProposal, completeProposal, confirmBooking, decide, publishProposal, requestReview, reserve,
  reviseProposal, simulate, withdraw,
} from "../../actions";

const REASON_KIND = {
  constraint: "Checked requirement",
  observation: "Cultural evidence",
  interpretation: "Our interpretation",
} as const;

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
          <Link href="/demo">Back to dashboard</Link>
        </p>
      </main>
    );
  }
  const p = r.data;
  const v = p.viewer;
  const open = p.state === "OPEN" || p.state === "READY";
  const myGroups = p.group_summaries.filter((g) => v.member_of.includes(g.group_id));
  const accepted = new Set(p.group_summaries.filter((g) => g.decision === "ACCEPT").map((g) => g.group_id));
  const mySeat =
    v.my_reservation?.status === "RESERVED" && v.my_reservation.proposal_version_id === p.proposal_version_id
      ? v.my_reservation
      : null;
  const defaultDeadline = londonInputValue(new Date(Date.parse(p.slot_start_at) - 2 * 86_400_000), 18, 0);

  return (
    <main id="main" className="page stack-lg">
      <p>
        <Link href="/demo">← Dashboard</Link>
      </p>
      <Flash notice={notice} error={error} />

      <header className="stack-sm">
        <div className="card-header">
          <h1>{p.experience_title}</h1>
          <StateBadge state={p.state} />
        </div>
        <p className="muted">
          {p.venue_name} · Version {p.version}
          {p.published_at ? ` · published ${formatDateTime(p.published_at)}` : " · not published"}
        </p>
      </header>

      {p.superseded_versions > 0 && (
        <div className="callout callout-warning" role="note">
          <strong>These terms were revised.</strong> Decisions and seats from earlier versions no longer apply;
          organisers must accept version {p.version} and participants must reserve again.
        </div>
      )}

      <div className="grid-2">
        <section className="surface stack" aria-labelledby="terms-h">
          <h2 id="terms-h">Terms</h2>
          <dl className="terms">
            <dt>Session</dt>
            <dd>{formatSlot(p.slot_start_at, p.slot_end_at)}</dd>
            <dt>All-in price</dt>
            <dd>
              {formatGbp(p.ticket_pence)} per person
              {!p.quote_is_current && <span className="badge state-expired"> Newer venue quote exists</span>}
            </dd>
            <dt>Goes ahead at</dt>
            <dd>{p.required_seats} individual reservations</dd>
            <dt>Capacity</dt>
            <dd>{p.capacity} seats</dd>
            <dt>Reserve by</dt>
            <dd>{p.deadline ? formatDateTime(p.deadline) : "Set when the venue publishes"}</dd>
            <dt>Access support</dt>
            <dd>{p.access_support.join(", ").replaceAll("_", " ") || "None confirmed"}</dd>
            <dt>Payment</dt>
            <dd>Not collected</dd>
          </dl>
          <p className="muted">{p.experience_description}</p>
          <p className="muted">{COPY.paymentBoundary}</p>
        </section>

        <section className="surface stack" aria-labelledby="ready-h">
          <h2 id="ready-h">Reservation status</h2>
          {p.state === "DRAFT" ? (
            <p>
              Draft for venue review.{" "}
              {p.review_requested_at ? "An organiser has sent it to the venue." : "Not yet sent to the venue."}
            </p>
          ) : (
            <ProgressMeter value={p.active_reservations} required={p.required_seats} capacity={p.capacity} />
          )}
          {p.state === "READY" && <p className="callout">{COPY.ready}</p>}
          {p.state === "CONFIRMED" && <p className="callout callout-success">{COPY.confirmed}</p>}
          {p.readiness_blockers && <ReadinessList blockers={p.readiness_blockers} />}
          <h3>Groups</h3>
          <ul className="plain-list stack-sm">
            {p.group_summaries.map((g) => (
              <li key={g.group_id}>
                <strong>{g.name}</strong>{" "}
                <span className="badge">
                  {g.decision === "ACCEPT" ? "Accepted" : g.decision === "DECLINE" ? "Declined" : "No decision yet"}
                </span>
                <br />
                <span className="muted">{g.summary}</span>
              </li>
            ))}
          </ul>
          <p className="muted">Other groups&apos; member lists and private preferences are never shown.</p>
        </section>
      </div>

      {p.rationale && (
        <section className="surface stack" aria-labelledby="why-h">
          <div className="card-header">
            <h2 id="why-h">Why this option</h2>
            <SourceBadge mode={p.source_mode} />
          </div>
          <p>{p.rationale.summary}</p>
          <ul className="plain-list stack-sm">
            {p.rationale.reasons.map((reason, i) => (
              <li key={i}>
                <span className="badge">{REASON_KIND[reason.kind]}</span> {reason.text}
              </li>
            ))}
          </ul>
          {Object.entries(p.rationale.by_group).length > 0 && (
            <details>
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
          <h3>Uncertainty</h3>
          <ul>
            {p.rationale.uncertainties.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Organiser actions */}
      {v.organiser_of.length > 0 && (
        <section className="surface stack" aria-labelledby="org-h">
          <h2 id="org-h">Organiser actions</h2>
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
                  <h3>Decision for {g.name}</h3>
                  <p className="muted">
                    Accepting agrees to version {p.version} and to sharing the session. It does not reserve any
                    seats; each person reserves their own.
                  </p>
                  <input type="hidden" name="proposal_id" value={p.id} />
                  <input type="hidden" name="version_id" value={p.proposal_version_id} />
                  <input type="hidden" name="version" value={p.version} />
                  <input type="hidden" name="group_id" value={g.group_id} />
                  <IdemInput />
                  <fieldset>
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
        </section>
      )}

      {/* Participant actions */}
      {open && myGroups.length > 0 && (
        <section className="surface stack" aria-labelledby="seat-h">
          <h2 id="seat-h">Your seat</h2>
          {mySeat ? (
            <form action={withdraw} className="stack-sm">
              <p>
                You hold one seat with {p.group_summaries.find((g) => g.group_id === mySeat.group_id)?.name}.{" "}
                {p.state === "READY" ? COPY.ready : "The session needs more reservations before the venue can confirm."}
              </p>
              <input type="hidden" name="proposal_id" value={p.id} />
              <input type="hidden" name="reservation_id" value={mySeat.id} />
              <IdemInput />
              <SubmitButton variant="secondary">Withdraw my seat</SubmitButton>
            </form>
          ) : myGroups.some((g) => accepted.has(g.group_id)) ? (
            <form action={reserve} className="stack-sm form-panel">
              <input type="hidden" name="proposal_id" value={p.id} />
              <input type="hidden" name="version_id" value={p.proposal_version_id} />
              <input type="hidden" name="version" value={p.version} />
              <IdemInput />
              {myGroups.filter((g) => accepted.has(g.group_id)).length > 1 ? (
                <>
                  <label htmlFor="group_id">Reserve through</label>
                  <select id="group_id" name="group_id">
                    {myGroups.filter((g) => accepted.has(g.group_id)).map((g) => (
                      <option key={g.group_id} value={g.group_id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <input type="hidden" name="group_id" value={myGroups.find((g) => accepted.has(g.group_id))!.group_id} />
              )}
              <label className="choice">
                <input type="checkbox" name="adult" required /> I confirm I am an adult (18 or over).
              </label>
              <label className="choice">
                <input type="checkbox" name="accept_shared" required /> I understand this session is shared with the
                other groups listed.
              </label>
              <p className="muted">{COPY.paymentBoundary}</p>
              <SubmitButton>{COPY.reserveAction}</SubmitButton>
            </form>
          ) : (
            <p>Your group organiser has not accepted these terms yet, so seats cannot be reserved.</p>
          )}
          <DemoHelper proposalId={p.id} what="RESERVE" label="Simulate other members reserving up to the threshold" />
        </section>
      )}

      {/* Venue actions */}
      {(v.is_venue_manager || v.is_operator) && (
        <section className="surface stack" aria-labelledby="venue-h">
          <h2 id="venue-h">{v.is_venue_manager ? "Venue actions" : "Operator actions"}</h2>
          {v.is_venue_manager && p.state === "DRAFT" && (
            <form action={publishProposal} className="stack-sm form-panel">
              <p>
                Publishing freezes these terms as version {p.version}. Hard requirements are checked again before it
                is published.
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
              <p className="muted">
                Confirmation re-checks every organiser acceptance, the reserved seats, capacity, the deadline and the
                current quote. Payment is not collected.
              </p>
              <SubmitButton>Confirm reservation booking</SubmitButton>
            </form>
          )}
          {v.is_venue_manager && open && (
            <details>
              <summary>Revise the price</summary>
              <form action={reviseProposal} className="stack-sm form-panel details-body">
                <p className="muted">
                  A revision publishes a new version. Earlier organiser decisions and every reserved seat are released.
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
              <form action={cancelProposal} className="stack-sm form-panel details-body">
                <input type="hidden" name="proposal_id" value={p.id} />
                <IdemInput />
                <label htmlFor="cancel-reason">Reason (recorded in the audit trail)</label>
                <input id="cancel-reason" name="reason" minLength={3} maxLength={500} required />
                <p className="muted">There is no automatic refund because no payment is collected.</p>
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
        </section>
      )}
    </main>
  );
}

function DemoHelper({ proposalId, what, label }: { proposalId: string; what: "ACCEPT" | "RESERVE"; label: string }) {
  return (
    <form action={simulate} className="demo-helper">
      <input type="hidden" name="proposal_id" value={proposalId} />
      <input type="hidden" name="what" value={what} />
      <button type="submit" className="button button-secondary">
        Sandbox: {label}
      </button>
    </form>
  );
}

/* eslint-disable @next/next/no-img-element -- plates are pre-sized in public/art */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Glyph } from "@/components/sila/chrome";
import { Marks } from "@/components/sila/interest";
import { Flash, IdemInput } from "@/components/ui";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import type { ProposalDetail } from "@/lib/demo/views";
import { formatGbp } from "@/lib/domain/money";
import { img, lookFor } from "@/lib/ui/sila/art";
import { fd, glyphOf, illustrativeInterest, STATE_LABEL, timeRange, titleLines } from "@/lib/ui/sila/view";
import { COPY } from "@/lib/ui/copy";
import { reserve, withdraw } from "../../../actions";

export const metadata: Metadata = { title: "Commit a place" };

export default async function ReservePage({
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
  const acceptedMine = myGroups.filter((g) => p.group_summaries.find((x) => x.group_id === g.group_id)?.decision === "ACCEPT");
  const mySeat =
    v.my_reservation?.status === "RESERVED" && v.my_reservation.proposal_version_id === p.proposal_version_id
      ? v.my_reservation
      : null;
  const reserved = p.active_reservations;
  const remaining = Math.max(0, p.required_seats - reserved);
  const venue = p.venue_name;
  const when = `${fd(p.slot_start_at)}, ${timeRange(p.slot_start_at, p.slot_end_at)}`;
  const ref = `${look.ref.replace("Nº ", "")}-${p.id.slice(0, 4).toUpperCase()}`;
  const withName = mySeat ? p.group_summaries.find((g) => g.group_id === mySeat.group_id)?.name ?? "Your group" : "";

  const statusNote = confirmed
    ? `Confirmed by ${venue}. ${COPY.confirmed}`
    : p.state === "READY"
      ? `The minimum is reached and the request is with ${venue}. A reservation holds a place; nothing is charged.`
      : `${reserved} of ${p.required_seats} reserved. At ${p.required_seats}, the request goes to ${venue}. Nothing is charged.`;

  return (
    <main id="main">
      <div className="cf">
        <div className="cf-top">
          <Link href={`/demo/proposals/${p.id}`}>
            <ArrowLeft />
            Back to the proposal
          </Link>
          <span>{mySeat ? "Recorded (sandbox)" : "Commitment"}</span>
        </div>
        {(notice || error) && (
          <div className="flash-wrap">
            <Flash notice={notice} error={error} />
          </div>
        )}

        <div className="cf-grid">
          <aside className="cf-aside" aria-label="Proposal summary">
            <div className="cf-id">
              <span className="pic" style={{ background: look.theme.ground }}>
                <img src={img(look.layers[0]!.k)} alt="" />
              </span>
              <span className="ttl">{t.plain}</span>
            </div>
            <dl className="facts">
              <dt>Venue</dt>
              <dd>{venue}</dd>
              <dt>Date</dt>
              <dd>{when}</dd>
              <dt>Per place</dt>
              <dd>{formatGbp(p.ticket_pence)} · not collected</dd>
              <dt>Reserved</dt>
              <dd>
                {reserved} of {p.required_seats} minimum
              </dd>
            </dl>
            <div className="status-box">
              <Glyph bg={glyphOf(p.state)} />
              <span>
                <strong>{STATE_LABEL[p.state]}</strong>
                <span>{statusNote}</span>
              </span>
            </div>
          </aside>

          {mySeat ? (
            <div className="done">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="done-kicker">Reservation recorded · sandbox</span>
                <h1>
                  Place {reserved} of {confirmed ? p.capacity : p.required_seats} is yours.
                </h1>
              </div>
              <div className="ticket-wrap">
                <div aria-hidden="true" className="ticket-bar" />
                <div className="ticket" data-print="">
                  <div className="ticket-stub">
                    <img src={img(look.layers[0]!.k)} alt="" />
                    <span>{ref}</span>
                  </div>
                  <div className="ticket-body">
                    <span>sila · admit one · {look.ref}</span>
                    <span className="ttl">{t.plain}</span>
                    <div className="receipt">
                      <span>Date</span>
                      <span>{when}</span>
                      <span>Venue</span>
                      <span>{venue}</span>
                      <span>Places</span>
                      <span>1</span>
                      <span>With</span>
                      <span>{withName}</span>
                      <span>Charged</span>
                      <span>Nothing. No payment is collected here.</span>
                    </div>
                    <div className="stamp" data-stamp="" aria-label="Sandbox: no payment collected">
                      Sandbox
                      <br />
                      <span>no payment collected</span>
                    </div>
                  </div>
                </div>
              </div>
              <Marks
                id={p.id}
                small
                capacity={p.capacity}
                required={p.required_seats}
                others={reserved - 1}
                mine={1}
                interested={open ? illustrativeInterest(p.id, p.capacity, reserved) : 0}
              />
              <div className="next">
                <span>What happens next</span>
                {(confirmed
                  ? [
                      "The venue has confirmed. Organisers from both communities can see how many are coming from each group.",
                      "In the real service, access notes would be sent before the day.",
                      "No payment is collected here.",
                    ]
                  : [
                      p.state === "READY"
                        ? `${venue} reviews the request and confirms the date.`
                        : `At ${p.required_seats} reservations, sila sends the request to ${venue}. ${remaining} to go.`,
                      "If the venue confirms, you’ll see it here. No payment is collected.",
                      "If it doesn’t, the reservation lapses and nothing is charged.",
                    ]
                ).map((nx, i) => (
                  <div key={nx}>
                    <span className="next-n">{["i", "ii", "iii"][i]}</span>
                    <span>{nx}</span>
                  </div>
                ))}
              </div>
              <div className="done-actions">
                <Link href={`/demo/proposals/${p.id}`} className="btn-ink">
                  Return to the proposal
                </Link>
                <Link href="/demo" className="btn-line">
                  All experiences
                </Link>
                {open && (
                  <form action={withdraw}>
                    <input type="hidden" name="proposal_id" value={p.id} />
                    <input type="hidden" name="reservation_id" value={mySeat.id} />
                    <IdemInput />
                    <button type="submit" className="link-under" style={{ fontSize: 13 }}>
                      Withdraw my commitment
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : open && acceptedMine.length > 0 ? (
            <form action={reserve} className="cf-form">
              <h1 className="cf-h1">Commit to a place</h1>
              <input type="hidden" name="proposal_id" value={p.id} />
              <input type="hidden" name="version_id" value={p.proposal_version_id} />
              <input type="hidden" name="version" value={p.version} />
              <IdemInput />
              <fieldset>
                <legend>1 · Date</legend>
                <label className="radio cf-date">
                  <span>
                    <span className="box">
                      <input type="radio" name="cdate" defaultChecked readOnly />
                      <span className="dot" />
                    </span>
                    <strong>{fd(p.slot_start_at)}</strong>
                  </span>
                  <span>{timeRange(p.slot_start_at, p.slot_end_at)}</span>
                </label>
              </fieldset>
              <fieldset className="wrap-row">
                <legend>2 · Place and community</legend>
                <div className="field">
                  <span className="field-label">Places</span>
                  <div className="seg">
                    <label className="seg-opt">
                      <input type="radio" name="places" defaultChecked readOnly />1 place
                    </label>
                  </div>
                </div>
                <div className="field">
                  <span className="field-label">Coming with</span>
                  <div className="seg">
                    {acceptedMine.map((g, i) => (
                      <label key={g.group_id} className="seg-opt">
                        <input type="radio" name="group_id" value={g.group_id} defaultChecked={i === 0} />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </div>
                <p className="note" style={{ flexBasis: "100%", margin: 0 }}>
                  Each person reserves their own place; only individual reservations count toward the minimum.
                </p>
              </fieldset>
              <fieldset className="stack">
                <legend>3 · Your confirmation</legend>
                <label className="radio agree">
                  <span className="box">
                    <input type="checkbox" name="adult" required />
                    <span className="dot" />
                  </span>
                  <span>I confirm I am an adult (18 or over).</span>
                </label>
                <label className="radio agree">
                  <span className="box">
                    <input type="checkbox" name="accept_shared" required />
                    <span className="dot" />
                  </span>
                  <span>I understand this session is shared with the other groups listed.</span>
                </label>
              </fieldset>
              <div className="submit-row">
                <button type="submit" className="btn-ink lg">
                  Commit my place
                </button>
                <span>£0 today · {formatGbp(p.ticket_pence)} all-in price, not collected here</span>
              </div>
              <span className="note">{COPY.paymentBoundary}</span>
            </form>
          ) : (
            <div className="done">
              <h1 className="cf-h1">Not open for your group</h1>
              <p className="lede">
                {!open
                  ? "This proposal is not open for reservations."
                  : myGroups.length === 0
                    ? "Only members of the groups in this proposal can reserve a place."
                    : "Your group organiser has not accepted these terms yet, so seats cannot be reserved."}
              </p>
              <Link href={`/demo/proposals/${p.id}`} className="btn-ink" style={{ alignSelf: "flex-start" }}>
                Return to the proposal
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

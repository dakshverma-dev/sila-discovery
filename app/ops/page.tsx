import { WorkspaceShell } from "@/components/sila/application/primitives";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountBar } from "@/components/sila/account-bar";
import { SiteHeader } from "@/components/sila/chrome";
import { CommandForm } from "@/components/sila/venue/command-form";
import { requireSilaActor } from "@/lib/sila/auth";
import { listVenueSessions } from "@/lib/sila/commands/sessions";
import { callSila } from "@/lib/sila/db";
import { formatLondon } from "@/lib/sila/forms";
import { createVenueAction, inviteVenueMemberAction, opsIntakeAction, prepareSessionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Operator tools" };

interface OperatorContext {
  is_operator: boolean;
  venues: Array<{ id: string; name: string; roles: string[] }>;
}

function VenueChoice({ venues, id }: { venues: OperatorContext["venues"]; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>Venue</label>
      <select id={id} name="venue_id" required defaultValue={venues[0]?.id}>
        {venues.map((venue) => <option value={venue.id} key={venue.id}>{venue.name}</option>)}
      </select>
    </div>
  );
}

/** Operator preparation and incident controls only (§19, §24, §28; P0 02 UI). */
export default async function OperatorPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireSilaActor("/ops");
  const result = await callSila<OperatorContext>("get_my_context", [actor.personId]);
  if (!result.ok || !result.data.is_operator) notFound();
  const venues = result.data.venues;
  const notice = (await searchParams).notice;
  const notices: Record<string, string> = {
    venue_created: "Venue created. You can now invite staff and prepare a draft.",
    staff_invited: "Staff invitation saved. The role is available when they sign in with this email.",
    intake_paused: "New intake paused. The reason has been recorded.",
    intake_resumed: "New intake resumed. The reason has been recorded.",
  };
  const venueSessions = await Promise.all(venues.map(async (venue) => {
    const sessions = await listVenueSessions(actor, venue.id);
    if (!sessions.ok) {
      if (sessions.error.code === "NOT_FOUND") return null;
      throw new Error(`list_venue_sessions failed: ${sessions.error.code}`);
    }
    return { venue, sessions: sessions.data.sessions };
  }));

  return (
    <>
      <SiteHeader nav={[{ num: "", label: "Venue sessions", href: "/venue" },
        { num: "", label: "Operator tools", href: "/ops", current: true }]} />
      <main id="main"><WorkspaceShell organisation={"Sila operations"} role="Operations" nav={[{label:"Overview",href:"/ops",current:true},{label:"Venue sessions",href:"/venue"},{label:"My account",href:"/account"}]}><div className="sa-authenticated stack-lg">
        <header className="stack-sm">
          <p className="kicker">Sila operations</p>
          <h1 className="page-title">Operator tools</h1>
          <p className="dek">Prepare the session. Keep the venue in control.</p>
          <p className="pn-box">Operator tools cannot commit for a club, verify a venue payment or confirm a session.</p>
        </header>
        <AccountBar email={actor.email} />
        {typeof notice === "string" && notices[notice] ? <p className="flash flash-notice" role="status">{notices[notice]}</p> : null}

        <section className="stack-sm sa-panel" aria-labelledby="create-venue-heading">
          <h2 id="create-venue-heading" className="pn-h2">Create a venue</h2>
          <p className="muted">Record approved venue facts. Personal access arrangements go directly to the venue.</p>
          <CommandForm action={createVenueAction} idempotencyKey={randomUUID()}>
            <div className="field"><label htmlFor="venue-name">Venue name</label>
              <input id="venue-name" name="name" required minLength={2} maxLength={120} autoComplete="organization" /></div>
            <div className="field"><label htmlFor="venue-address">Address</label>
              <textarea id="venue-address" name="address" required maxLength={1000} rows={2} autoComplete="street-address" /></div>
            <div className="field"><label htmlFor="venue-access">Public access facts</label>
              <textarea id="venue-access" name="access_facts" maxLength={2000} rows={3} aria-describedby="access-guidance" />
              <span id="access-guidance" className="muted">Facts about the venue, such as step-free entry. Do not include anyone&apos;s personal arrangements or medical information.</span></div>
            <div className="grid-2">
              <div className="field"><label htmlFor="venue-email">Direct venue email</label>
                <input id="venue-email" name="contact_email" type="email" maxLength={254} autoComplete="email" /></div>
              <div className="field"><label htmlFor="venue-phone">Direct venue phone</label>
                <input id="venue-phone" name="contact_phone" type="tel" maxLength={80} autoComplete="tel" /></div>
            </div>
            <p className="muted">Provide an email or phone so people can discuss access directly.</p>
            <button className="button button-primary" type="submit">Create venue</button>
          </CommandForm>
        </section>

        {venues.length ? <>
          <section className="stack-sm sa-panel" aria-labelledby="invite-heading">
            <h2 id="invite-heading" className="pn-h2">Invite venue staff</h2>
            <p className="muted">The role becomes available when this person signs in with the invited email. Share the sign-in link with them.</p>
            <CommandForm action={inviteVenueMemberAction} idempotencyKey={randomUUID()}>
              <VenueChoice venues={venues} id="invite-venue" />
              <div className="field"><label htmlFor="staff-email">Staff email</label>
                <input id="staff-email" name="email" type="email" required maxLength={254} autoComplete="email" /></div>
              <div className="field"><label htmlFor="staff-role">Role</label>
                <select id="staff-role" name="role" required defaultValue="coordinator">
                  <option value="coordinator">Coordinator</option><option value="finance">Finance</option>
                </select></div>
              <p className="muted">Coordinators review and publish sessions, approve places and confirm bookings. Finance staff record receipts.</p>
              <button type="submit" className="button button-primary">Save staff invitation</button>
            </CommandForm>
            <Link href="/sign-in" className="link-button">Open sign-in page</Link>
          </section>

          <section className="stack-sm sa-panel" aria-labelledby="draft-heading">
            <h2 id="draft-heading" className="pn-h2">Prepare a draft session</h2>
            <p className="muted">Start with the proposed date, price and places. Complete the terms, hold and coverage on the review page. Only the venue can publish.</p>
            <CommandForm action={prepareSessionAction} idempotencyKey={randomUUID()}>
              <VenueChoice venues={venues} id="draft-venue" />
              <div className="field"><label htmlFor="draft-title">Activity title</label>
                <input id="draft-title" name="title" required minLength={3} maxLength={100} /></div>
              <p className="muted">All dates and times below are London time, including clock changes.</p>
              <div className="grid-2">
                <div className="field"><label htmlFor="draft-start">Session starts (London)</label>
                  <input id="draft-start" name="starts_at" type="datetime-local" required /></div>
                <div className="field"><label htmlFor="draft-end">Session ends (London)</label>
                  <input id="draft-end" name="ends_at" type="datetime-local" required /></div>
                <div className="field"><label htmlFor="draft-price">Price per person (GBP)</label>
                  <input id="draft-price" name="price" required inputMode="decimal" placeholder="35.00" /></div>
                <div className="field"><label htmlFor="draft-minimum">Minimum places</label>
                  <input id="draft-minimum" name="minimum" type="number" min={1} max={1000} required /></div>
                <div className="field"><label htmlFor="draft-capacity">Capacity</label>
                  <input id="draft-capacity" name="capacity" type="number" min={1} max={1000} required /></div>
                <div className="field"><label htmlFor="draft-fill">Fill by (London)</label>
                  <input id="draft-fill" name="fill_by" type="datetime-local" required /></div>
                <div className="field"><label htmlFor="draft-decision">Final decision (London)</label>
                  <input id="draft-decision" name="decision_by" type="datetime-local" required /></div>
                <div className="field"><label htmlFor="draft-balance">Balance due (London)</label>
                  <input id="draft-balance" name="balance_due_at" type="datetime-local" required /></div>
              </div>
              <button className="button button-primary" type="submit">Save draft and review</button>
            </CommandForm>
          </section>
        </> : <p className="pn-box">Create a venue above to invite staff and prepare its first draft session.</p>}

        <section className="stack-sm sa-panel" aria-labelledby="intake-heading">
          <h2 id="intake-heading" className="pn-h2">Session intake</h2>
          <p className="muted">Pause new requests, invitations, commitments and further deposit requests during an incident. Existing agreements and actual receipts stay available. Record a reason for pausing or resuming.</p>
          {venueSessions.filter((item) => item !== null).map(({ venue, sessions }) => (
            <section key={venue.id} className="stack-sm sa-panel" aria-labelledby={`venue-${venue.id}`}>
              <h3 id={`venue-${venue.id}`}>{venue.name}</h3>
              {sessions.length ? sessions.map((session) => (
                <article key={session.id} className="pn-box">
                  <h4><Link href={`/venue/sessions/${session.id}`}>{session.title}</Link></h4>
                  <p>{formatLondon(new Date(session.starts_at))}</p>
                  <p>{session.phase === "draft" ? "Draft — awaiting venue review" : session.phase === "published"
                    ? session.intake_paused ? "New intake paused" : "Published — new intake is not paused"
                    : session.phase === "confirmed" ? "Confirmed by venue" : "Session closed"}</p>
                  {session.phase === "published" ? <CommandForm action={opsIntakeAction} idempotencyKey={randomUUID()}>
                    <input type="hidden" name="session_id" value={session.id} />
                    <input type="hidden" name="expected_version" value={session.version} />
                    <input type="hidden" name="paused" value={session.intake_paused ? "false" : "true"} />
                    <div className="field"><label htmlFor={`reason-${session.id}`}>{session.intake_paused ? "Reason for resuming" : "Reason for pausing"}</label>
                      <textarea id={`reason-${session.id}`} name="reason" required maxLength={500} rows={2} /></div>
                    <button type="submit" className="button button-secondary">{session.intake_paused ? "Resume new intake" : "Pause new intake"}</button>
                  </CommandForm> : null}
                </article>
              )) : <p className="muted">No sessions yet. Prepare the first draft above.</p>}
            </section>
          ))}
        </section>
      </div></WorkspaceShell></main>
    </>
  );
}

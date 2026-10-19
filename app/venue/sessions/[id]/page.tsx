import { WorkspaceShell } from "@/components/sila/application/primitives";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AccountBar } from "@/components/sila/account-bar";
import { SiteHeader } from "@/components/sila/chrome";
import { CopyButton } from "@/components/sila/plan/copy-button";
import { PUBLICATION_COPY } from "@/components/sila/venue/blocker-copy";
import { CommandForm } from "@/components/sila/venue/command-form";
import { DraftEditor } from "@/components/sila/venue/draft-editor";
import { VenueReceipts } from "@/components/sila/venue/receipts";
import { VenueRequests } from "@/components/sila/venue/requests";
import { VenueRefunds } from "@/components/sila/venue/refunds";
import { requireSilaActor } from "@/lib/sila/auth";
import { scottishVenueCalendar } from "@/lib/sila/calendar";
import { listSessionRequests } from "@/lib/sila/commands/plans";
import { getVenueSession } from "@/lib/sila/commands/sessions";
import { formatLondon, toSessionDraft } from "@/lib/sila/forms";
import { formatGBP } from "@/lib/sila/money";
import { checkPublication } from "@/lib/sila/session";
import { intakeAction, publishAction } from "./actions";

export const metadata: Metadata = { title: "Venue session" };
export const dynamic = "force-dynamic";
const NOTICES: Record<string, string> = {
  saved: "Draft saved. Review the publication checks below.",
  published: "Session published. Copy the link to invite venue-approved clubs.",
  approved: "Places approved. The organiser can now review the terms and commit conditionally.",
  declined: "Request declined. The organiser can see the reason.",
  intake: "New intake updated. Existing booking details remain available.",
  confirmed: "The venue has confirmed this booking.",
  message: "Question sent in the club conversation.",
  closed: "Session closed. Existing payments are preserved and full refunds are tracked.",
  refund: "Refund verified. The recorded return is in the financial history.",
};

export default async function VenueSessionPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const actor = await requireSilaActor(`/venue/sessions/${id}`);
  const [loaded, requests] = await Promise.all([getVenueSession(actor, id), listSessionRequests(actor, id)]);
  if (!loaded.ok || !requests.ok) {
    if ((!loaded.ok && loaded.error.code === "NOT_FOUND") || (!requests.ok && requests.error.code === "NOT_FOUND")) notFound();
    throw new Error("This session could not be loaded.");
  }
  const view = loaded.data;
  const s = view.session;
  const coordinator = view.roles.includes("coordinator");
  const operator = view.roles.includes("operator");
  const finance = view.roles.includes("finance");
  const editable = s.phase === "draft" && (coordinator || operator);
  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const check = s.phase === "draft" ? checkPublication(toSessionDraft(s), scottishVenueCalendar()) : null;
  const publicPath = `/s/${id}`;
  const publicLink = `${(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}${publicPath}`;
  return <>
    <SiteHeader />
    <main id="main"><WorkspaceShell organisation={view.venue.name} role="Venue workspace" nav={[{label:"Overview",href:"/venue"},{label:"Sessions",href:"/venue",current:true},{label:"My account",href:"/account"}]}><div className="sa-authenticated stack-lg">
      <p className="crumbs"><Link href="/venue">All venue sessions</Link>{operator ? <> · <Link href="/ops">Operator tools</Link></> : null}</p>
      <header className="stack-sm">
        <p className="kicker">{view.venue.name} · {s.phase === "draft" ? "Prepared draft" : s.phase === "confirmed" ? "Venue-confirmed booking" : "Session overview"}</p>
        <h1>{s.phase === "draft" ? "Review your session" : s.title}</h1>
        <p>{formatLondon(new Date(s.starts_at))} · {formatGBP(s.price_minor)} per person · All in</p>
      </header>
      {notice ? <p role="status" className="flash flash-notice">{notice}</p> : null}
      {view.booking ? <p><a className="link-button" href={`/api/v1/sila/sessions/${s.id}/summary`}>Download practical details</a></p> : null}
      {s.phase === "cancelled" || s.phase === "closed" ? <p className="callout">{s.phase === "cancelled" ? "Booking cancelled." : "Session not proceeding."} {s.closed_reason} Original terms and payment history remain available.</p>
        : view.booking ? <p className="callout">Confirmed booking {view.booking.booking_ref} · Venue confirmed {formatLondon(new Date(view.booking.confirmed_at))}</p> : s.phase !== "draft" ? <p className="callout">This session is conditional until the venue confirms. Requests and invitations reserve no places.</p> : null}
      <dl className="terms">
        <dt>Conditional places</dt><dd>{requests.data.committed_places} conditionally committed · Minimum {s.minimum} · Capacity {s.capacity} · At most {s.max_clubs} clubs</dd>
        <dt>Fill by</dt><dd>{formatLondon(new Date(s.fill_by))}</dd>
        <dt>Final decision</dt><dd>{formatLondon(new Date(s.decision_by))}</dd>
        <dt>Payment window</dt><dd>{s.payment_window_days} calendar days after actual opening, then separate venue verification</dd>
        <dt>Balance due</dt><dd>{formatLondon(new Date(s.balance_due_at))}</dd>
      </dl>
      {view.allocations.filter((a) => a.status === "live").map((a) => <p key={a.allocation_id}>{a.club_name}: {a.places} conditionally committed</p>)}
      {s.payment_scheduled_for && !s.payment_opened_at ? <p className="callout">Payment scheduled for {formatLondon(new Date(s.payment_scheduled_for))}. Nothing is due yet.</p> : null}
      {s.payment_opening_blocked_reason ? <p className="callout">Payment opening delayed. Nothing is due yet. Contact your named coordinator for the reason and next update.</p> : null}
      {s.phase === "draft" ? <>
        {editable ? <DraftEditor session={s} /> : <p>Only a venue coordinator or scoped operator can prepare a draft.</p>}
        <section className="stack surface" aria-labelledby="publish-title">
          <h2 id="publish-title">Ready to publish</h2>
          <p>Latest feasible fill-by: {check?.latestFillBy ? formatLondon(check.latestFillBy) : "Approve a feasible schedule and staffed coverage first."}</p>
          {check?.blockers.length ? <ul>{check.blockers.map((code) => <li key={code}>{PUBLICATION_COPY[code]}</li>)}</ul> : <p>Publication schedule checks pass. The venue must approve actual terms, the hold and staffed coverage.</p>}
          {coordinator ? <CommandForm action={publishAction} idempotencyKey={randomUUID()}>
            <input type="hidden" name="session_id" value={id} />
            <input type="hidden" name="expected_version" value={s.version} />
            <label className="choice"><input type="checkbox" name="resource_coverage_approved" required />Resource hold and coverage approved</label>
            <button type="submit" className="button button-primary">Publish and copy link</button>
          </CommandForm> : <p>A venue coordinator must review and publish. Operator and finance access cannot publish.</p>}
        </section>
        <details><summary>Preview public details</summary><div className="stack">
          <h2>{s.title}</h2><p>{s.description}</p><p>{s.inclusions}</p><p>{s.meeting_point}</p>
          <p>{view.venue.access_facts}</p><p>Personal access arrangements go directly to the venue: {view.venue.contact_email ?? view.venue.contact_phone ?? "Ask the coordinator to add a contact before invitations."}</p>
        </div></details>
      </> : <>
        <section id="session-link" className="stack surface" aria-labelledby="link-title">
          <h2 id="link-title">Session link</h2>
          <p className="vn-message"><Link href={publicPath}>View public session</Link></p>
          <CopyButton text={publicLink} label="Copy session link" />
        </section>
        <VenueRequests session={s} plans={requests.data.plans} coordinator={coordinator} />
        {(s.payment_opened_at || s.phase === "closed" || s.phase === "cancelled") && (coordinator || finance) ? <VenueReceipts view={view} coordinator={coordinator} /> : null}
        <VenueRefunds view={view} />
        {s.phase === "published" && (coordinator || operator) ? <section className="stack surface" aria-labelledby="intake-title">
          <h2 id="intake-title">{s.intake_paused ? "New intake paused" : "New intake open"}</h2>
          {s.intake_paused_reason ? <p>{s.intake_paused_reason}</p> : null}
          <p>Existing commitments and booking details remain accessible.</p>
          <CommandForm action={intakeAction} idempotencyKey={randomUUID()}>
            <input type="hidden" name="session_id" value={id} />
            <input type="hidden" name="expected_version" value={s.version} />
            <input type="hidden" name="paused" value={s.intake_paused ? "false" : "true"} />
            <label className="stack-sm">Reason for intake change<textarea name="reason" required maxLength={500} /></label>
            <button type="submit" className="button button-secondary">{s.intake_paused ? "Resume new intake" : "Pause new intake"}</button>
          </CommandForm>
        </section> : null}
      </>}
      <AccountBar email={actor.email} />
    </div></WorkspaceShell></main>
  </>;
}

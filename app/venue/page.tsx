import { Metrics, PageTitle, Status, WorkspaceShell } from "@/components/sila/application/primitives";
import type { Metadata } from "next";
import Link from "next/link";
import { AccountBar } from "@/components/sila/account-bar";
import { SiteHeader } from "@/components/sila/chrome";
import { requireSilaActor } from "@/lib/sila/auth";
import { listVenueSessions } from "@/lib/sila/commands/sessions";
import { callSila } from "@/lib/sila/db";
import { formatLondon } from "@/lib/sila/forms";
import { formatGBP } from "@/lib/sila/money";

export const metadata: Metadata = { title: "Venue sessions" };
export const dynamic = "force-dynamic";

export default async function VenuePage() {
  const actor = await requireSilaActor("/venue");
  const context = await callSila<{ is_operator: boolean; venues: { id: string; name: string; roles: string[] }[] }>("get_my_context", [actor.personId]);
  if (!context.ok) throw new Error("Your venue access could not be loaded.");
  const venues = await Promise.all(context.data.venues.map(async (venue) => {
    const result = await listVenueSessions(actor, venue.id);
    if (!result.ok) throw new Error("Your venue sessions could not be loaded.");
    return { ...venue, sessions: result.data.sessions };
  }));
  const sessions = venues.flatMap(v=>v.sessions);
  return <><SiteHeader /><main id="main"><WorkspaceShell organisation={venues[0]?.name ?? "Your venue"} role="Venue workspace"
    nav={[{label:"Overview",href:"/venue",current:true},{label:"My account",href:"/account"},...(context.data.is_operator?[{label:"Operator tools",href:"/ops"}]:[])]}>
    <PageTitle kicker="Venue workspace" title="Your dated sessions" description="Review your sessions, handle club requests and record payments made directly to your venue."/>
    <Metrics items={[{label:"Published sessions",value:sessions.filter(s=>s.phase==="published").length,detail:"Conditional until venue confirmation"},{label:"Confirmed bookings",value:sessions.filter(s=>s.phase==="confirmed").length,detail:"Checked and confirmed by the venue"},{label:"Drafts",value:sessions.filter(s=>s.phase==="draft").length,detail:"Venue review before publication"}]}/>
    {venues.length===0?<section className="sa-panel"><h2>Your venue access</h2><p>No venue invitation is linked to this email. Ask your Sila trial lead to check the invited address.</p></section>:null}
    {venues.map(venue=><section key={venue.id} className="sa-panel" aria-labelledby={`venue-${venue.id}`}><header className="sa-panel-head"><h2 id={`venue-${venue.id}`}>{venue.name}</h2></header>
      {venue.sessions.length===0?<p>No prepared session yet. Your Sila trial lead can prepare the first draft with you.</p>:null}
      {venue.sessions.map(session=><article key={session.id} className="sa-live-session-row"><div><Status tone={session.phase==="confirmed"?"positive":"neutral"}>{session.phase==="draft"?"Prepared draft":session.phase==="confirmed"?"Confirmed by venue":session.phase==="published"?"Conditional session":"Closed"}</Status><h3><Link href={`/venue/sessions/${session.id}`}>{session.title}</Link></h3><p>{formatLondon(new Date(session.starts_at))}</p></div><div><strong>{formatGBP(session.price_minor)}</strong><p>per person · minimum {session.minimum} · capacity {session.capacity}</p>{session.intake_paused?<p>New intake paused</p>:null}</div><Link className="sa-button sa-button-light" href={`/venue/sessions/${session.id}`}>{session.phase==="draft"?"Review your draft":"Open session"}</Link></article>)}
    </section>)}<AccountBar email={actor.email}/>
  </WorkspaceShell></main></>;
}

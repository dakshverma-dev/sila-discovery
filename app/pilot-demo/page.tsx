import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/sila/chrome";
import { DEMO_SESSION_ID, localDemoEnabled } from "@/lib/sila/demo";
import { requestSignInLink } from "@/app/sign-in/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Local pilot demo" };

const ROLES = [
  { name: "Venue coordinator", email: "coordinator@demo.sila.example", next: `/venue/sessions/${DEMO_SESSION_ID}`,
    detail: "Review the prepared workshop, publish it, approve club places and confirm after checking receipts and the diary." },
  { name: "Club organiser", email: "organiser@demo.sila.example", next: `/s/${DEMO_SESSION_ID}`,
    detail: "After the venue publishes, request 16 places, review the approval and commit conditionally. Try 7 places with a second club requesting 9 for a shared session." },
  { name: "Second club organiser", email: "second-club@demo.sila.example", next: `/s/${DEMO_SESSION_ID}`,
    detail: "Use a separate browser profile for the second club. Its contact, invoice and messages remain private." },
  { name: "Venue finance", email: "finance@demo.sila.example", next: `/venue/sessions/${DEMO_SESSION_ID}`,
    detail: "Record simulated venue receipts. Finance cannot approve a club or confirm a session." },
  { name: "Sila operator", email: "ops@demo.sila.example", next: "/ops",
    detail: "Prepare drafts and pause commercial intake. Operators cannot commit for clubs, verify money or confirm." },
];

export default function PilotDemoPage() {
  if (!localDemoEnabled()) notFound();
  return <>
    <SiteHeader nav={[{ num: "i", label: "Pilot demo", href: "/pilot-demo", current: true },
      { num: "ii", label: "Your club plans", href: "/plans" }, { num: "iii", label: "Venue", href: "/venue" }]} />
    <main id="main" className="page stack-lg">
      <header className="stack-sm">
        <p className="kicker">Edinburgh · fictional local rehearsal</p>
        <h1 className="page-title">Try a shared session.</h1>
        <p className="dek">A printmaking evening. £35 per person. Minimum 16, capacity 20, at most two clubs.</p>
      </header>
      <p className="callout">All people, venue facts, terms, coverage and payment details here are synthetic. No real venue approval, booking or transfer exists. Do not send money.</p>
      <section className="stack surface" aria-labelledby="demo-start">
        <h2 id="demo-start">Start with the venue</h2>
        <p>Sign in as the coordinator, review the prepared draft and publish it. Then use the organiser role to request places. Switch roles by signing out, or use separate browser profiles.</p>
        <p>Each button sends a real local Supabase sign-in link to the demo inbox. Open the matching email in <a href="http://127.0.0.1:56324" target="_blank" rel="noreferrer">the local email inbox</a>, and follow its link in the same browser profile.</p>
        <p>The payment clock uses the pilot rules. The automated browser rehearsal tests payment opening with an explicitly advanced synthetic clock; the demo does not weaken release checks.</p>
        <Link href={`/s/${DEMO_SESSION_ID}`} className="link-button">View the workshop after publication</Link>
      </section>
      <div className="grid-2">
        {ROLES.map((role) => <section key={role.email} className="stack surface" aria-labelledby={`role-${role.name.replaceAll(" ", "-")}`}>
          <h2 id={`role-${role.name.replaceAll(" ", "-")}`}>{role.name}</h2>
          <p>{role.detail}</p>
          <p className="pn-pre">{role.email}</p>
          <form action={requestSignInLink} className="stack-sm">
            <input type="hidden" name="email" value={role.email} />
            <input type="hidden" name="next" value={role.next} />
            <button className="button button-primary" type="submit">Email {role.name.toLowerCase()} sign-in</button>
          </form>
        </section>)}
      </div>
    </main>
  </>;
}

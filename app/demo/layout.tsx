import type { Metadata } from "next";
import Link from "next/link";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import type { Persona } from "@/lib/demo/views";
import { COPY } from "@/lib/ui/copy";
import { endSandbox, switchPersona } from "./actions";

export const metadata: Metadata = { title: "Judge sandbox · Shared Cultural Bookings" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Persona["role"], string> = {
  VENUE_MANAGER: "Venue",
  ORGANISER: "Organisers",
  PARTICIPANT: "Participants",
  OPERATOR: "Operator",
};

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  const session = await requireDemoSession();
  const personas = await callApi<{ personas: Persona[] }>("list_demo_personas", [session.workspaceId]);
  const list = personas.ok ? personas.data.personas : [];
  const me = list.find((p) => p.user_id === session.actorId);
  const groups = (Object.keys(ROLE_LABEL) as Persona["role"][]).map((role) => ({
    role,
    people: list.filter((p) => p.role === role),
  }));
  const expires = new Date(session.expiresAt * 1000).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });

  return (
    <>
      <div className="demo-banner" role="note">
        {COPY.demoBanner} Expires {expires}.
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/demo" className="brand">
            Shared Cultural Bookings
          </Link>
          <form action={switchPersona} className="persona-switcher">
            <label htmlFor="persona">Acting as</label>
            <select id="persona" name="persona" defaultValue={session.actorId}>
              {groups.map(({ role, people }) =>
                people.length ? (
                  <optgroup key={role} label={ROLE_LABEL[role]}>
                    {people.map((p) => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.display_name}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
            <input type="hidden" name="return_to" value="/demo" />
            <button type="submit" className="button button-secondary">
              Switch
            </button>
          </form>
          <form action={endSandbox}>
            <button type="submit" className="link-button">
              End sandbox
            </button>
          </form>
        </div>
        {me && (
          <p className="persona-line">
            You are <strong>{me.display_name}</strong>
            {me.organisation ? <> · {me.organisation}</> : null}
          </p>
        )}
      </header>
      {children}
    </>
  );
}

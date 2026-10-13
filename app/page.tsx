import Link from "next/link";
import { Flash, SubmitButton } from "@/components/ui";
import { startSandbox } from "./demo/actions";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { notice, error } = await searchParams;
  return (
    <main id="main" className="page stack-lg">
      <Flash notice={notice} error={error} />
      <header className="hero stack">
        <p className="eyebrow">Qloo Agentic Hackathon · Edinburgh</p>
        <h1>Book a cultural experience together that no single group could fill alone.</h1>
        <p className="lede">
          Small communities pool interest and attendance to reserve a venue-approved session. An agent finds
          groups that fit the same time, price and access needs, explains why the programme suits them, and the
          venue confirms once enough people have each reserved their own seat. No payment is collected.
        </p>
      </header>

      <div className="grid-2">
        <section className="surface stack" aria-labelledby="sandbox-h">
          <h2 id="sandbox-h">Try the judge sandbox</h2>
          <p>
            Creates a private, isolated workspace with a fictional venue, five programmes and five community
            groups. Switch between venue manager, organisers and participants to run the whole workflow. It
            expires within 24 hours.
          </p>
          <form action={startSandbox}>
            <SubmitButton>Start a sandbox</SubmitButton>
          </form>
        </section>
        <section className="surface stack" aria-labelledby="how-h">
          <h2 id="how-h">How it works</h2>
          <ol className="stack-sm">
            <li>Organisers describe their group: size, budget, exact availability, access needs and sharing choice.</li>
            <li>The agent checks hard requirements first, then uses cultural evidence to order feasible coalitions.</li>
            <li>The venue reviews and publishes immutable terms; each organiser accepts for their group.</li>
            <li>Participants reserve one seat each. The venue confirms when the threshold is met.</li>
          </ol>
          <p className="muted">
            Looking for the matching rules alone? Open the <Link href="/sandbox">matching explorer</Link>.
          </p>
        </section>
      </div>

      <section className="surface stack" aria-labelledby="status-h">
        <h2 id="status-h">Build status</h2>
        <p>
          Early hackathon build. The sandbox uses synthetic cultural evidence because its groups and programmes are
          fictional. Live Qloo evidence is implemented behind a server-side adapter but has not yet been verified
          with an issued key.
        </p>
      </section>
    </main>
  );
}

import Link from "next/link";
import { z } from "zod";
import { visitor } from "@/lib/discovery/identity";
import { getRun } from "@/lib/discovery/store";
import { money } from "@/lib/discovery/catalog";
import { SessionCard } from "@/components/discovery/card";
export const dynamic = "force-dynamic";
export default async function Results({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run: id } = await searchParams;
  const owner = await visitor(false);
  const run =
    owner && z.uuid().safeParse(id).success ? await getRun(owner, id!) : null;
  if (!run)
    return (
      <section className="sd-page">
        <p className="sd-kicker">A fresh start</p>
        <h1>Your shortlist belongs to your browser.</h1>
        <p>
          This discovery is unavailable, private to another visitor, or more
          than 24 hours old.
        </p>
        <Link className="sd-text-link" href="/discover">
          Find an experience ↗
        </Link>
      </section>
    );
  const { result, input } = run;
  return (
    <section className="sd-page">
      <Link className="sd-back" href="/discover">
        ← Change your search
      </Link>
      <div className="sd-page-title">
        <div>
          <p className="sd-kicker">For {input.clubName}</p>
          <h1>
            {result.recommendations.length
              ? "Your next shared possibility."
              : "A little more room to explore."}
          </h1>
        </div>
        <span className="sd-live">● Live Qloo result</span>
      </div>
      <p className="sd-lede">
        {input.places} places · up to {money(input.maxPricePence)} per person ·{" "}
        {input.startDate} to {input.endDate}
      </p>
      <p className="sd-tastes">
        Inspired by {result.interests.map((i) => i.name).join(" / ")}
      </p>
      <div className="sd-result-note">
        <strong>Fictional sessions. Real venue intelligence.</strong> Ranked
        within five verified Edinburgh venues, then filtered against your needs.
        An affinity order is not a probability, endorsement or explanation of
        your individual tastes.
      </div>
      {result.recommendations.length ? (
        <div className="sd-cards">
          {result.recommendations.map((session, i) => (
            <SessionCard
              key={session.id}
              session={session}
              runId={run.id}
              ordinal={i + 1}
            />
          ))}
        </div>
      ) : (
        <div className="sd-empty">
          <h2>No sample sessions fit this search.</h2>
          <p>
            Try a higher budget, fewer places, the 19–22 November date window,
            or different interests. We won’t fill your shortlist with unsuitable
            sessions.
          </p>
          <Link className="sd-text-link" href="/discover">
            Adjust your search ↗
          </Link>
        </div>
      )}
      <details className="sd-evidence">
        <summary>See what Qloo returned & what Sila checked</summary>
        <p>
          Source: live · fetched {result.provider.fetched_at} · HTTP attempts:{" "}
          {result.callsUsed}
        </p>
        <p>
          Query fingerprint: <code>{result.provider.query_fingerprint}</code>
        </p>
        <p>{result.assistant.detail}</p>
        <ol>
          {result.trace.map((step, i) => (
            <li key={i}>
              <strong>{step.tool}</strong> — {step.outcome}
            </li>
          ))}
        </ol>
        <h2>Provider venue IDs, in order</h2>
        <ol>
          {result.returnedVenueIds.map((id) => (
            <li key={id}>
              <code>{id}</code>
            </li>
          ))}
        </ol>
        <h2>Excluded sample sessions</h2>
        <ul>
          {result.exclusions.map((e) => (
            <li key={e.sessionId}>
              {e.sessionId}: {e.reasons.join("; ")}
            </li>
          ))}
        </ul>
      </details>
      <p className="sd-help">
        Shortlists expire after 24 hours. Requests remain private to this
        browser’s signed visitor cookie.{" "}
        <Link href="/discover/about">Privacy & demo boundaries</Link>
      </p>
    </section>
  );
}

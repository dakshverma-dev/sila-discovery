import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  sessions,
  venueFor,
  money,
  sessionDate,
} from "@/lib/discovery/catalog";
import { getRun } from "@/lib/discovery/store";
import { visitor } from "@/lib/discovery/identity";
import { RequestButton } from "@/components/discovery/request-button";
export const dynamic = "force-dynamic";
export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { id } = await params;
  const { run: runId } = await searchParams;
  const sample = sessions.find((s) => s.id === id);
  if (!sample) notFound();
  const owner = await visitor(false);
  const run =
    owner && z.uuid().safeParse(runId).success
      ? await getRun(owner, runId!)
      : null;
  const session =
    run?.result.recommendations.find((s) => s.id === id) ?? sample;
  const venue = venueFor(session)!;
  const eligible = run?.result.recommendations.some((s) => s.id === id);
  return (
    <section className="sd-page">
      <Link
        className="sd-back"
        href={run ? `/discover/results?run=${run.id}` : "/discover/catalogue"}
      >
        ← Back to {run ? "your shortlist" : "the collection"}
      </Link>
      <div className="sd-detail">
        <div>
          <p className="sd-kicker">{venue.name} / Edinburgh</p>
          <h1>{session.title}</h1>
          <div className={`sd-detail-art sd-art-${venue.id}`}>
            <Image
              src={`/art/${venue.art}`}
              alt="Decorative historical artwork from Sila’s collection"
              fill
              sizes="(max-width: 800px) 100vw, 55vw"
            />
          </div>
          <p className="sd-lede">
            A fictional club outing, inspired by a real Edinburgh cultural
            venue. Time to look closely, share a conversation and enjoy
            something together.
          </p>
          <p>
            Venue address: {venue.address}. The artwork is decorative and does
            not depict the venue or a real event.
          </p>
          <details className="sd-evidence">
            <summary>Venue mapping & source</summary>
            <p>
              Qloo /search · name and Edinburgh address checked 25 October 2026
            </p>
            <code>{venue.qlooId}</code>
            <p>
              A verified venue identity is not evidence of a partnership,
              offered session or available places.
            </p>
          </details>
        </div>
        <aside className="sd-ticket">
          <p className="sd-kicker">Fictional session / conditional request</p>
          <h2>
            There’s room
            <br />
            for your club.
          </h2>
          <dl className="sd-ticket-facts">
            <div>
              <dt>When</dt>
              <dd>
                {sessionDate(session.startsAt)}
                <small>Europe/London</small>
              </dd>
            </div>
            <div>
              <dt>Price per person</dt>
              <dd>{money(session.pricePence)}</dd>
            </div>
            <div>
              <dt>Sample places left</dt>
              <dd>{session.remaining}</dd>
            </div>
            <div>
              <dt>Session minimum</dt>
              <dd>{session.minimum} people across clubs</dd>
            </div>
            {eligible && run && (
              <>
                <div>
                  <dt>Your club</dt>
                  <dd>{run.input.places} places</dd>
                </div>
                <div>
                  <dt>Your indicative total</dt>
                  <dd>{money(run.input.places * session.pricePence)}</dd>
                </div>
              </>
            )}
          </dl>
          <p className="sd-help">
            Minimum headcount and venue approval would still be required. A
            sample request reserves no places, changes no capacity, sends no
            message and takes no payment.
          </p>
          {eligible && run ? (
            <RequestButton
              runId={run.id}
              sessionId={session.id}
              places={run.input.places}
              pricePence={session.pricePence}
              version={session.version}
            />
          ) : (
            <Link className="sd-primary" href="/discover">
              Find a fit for your club ↗
            </Link>
          )}
        </aside>
      </div>
    </section>
  );
}

import Link from "next/link";
import Image from "next/image";
import {
  money,
  sessionDate,
  venueFor,
  type Session,
} from "@/lib/discovery/catalog";
export function SessionCard({
  session,
  runId,
  ordinal,
}: {
  session: Session & { providerRank?: number };
  runId?: string;
  ordinal?: number;
}) {
  const venue = venueFor(session);
  return (
    <article className="sd-card">
      <div className={`sd-card-art sd-art-${venue?.id}`}>
        <Image
          src={`/art/${venue?.art || "bewick.jpg"}`}
          alt=""
          fill
          sizes="(max-width: 700px) 100vw, 33vw"
        />
        <span>
          {ordinal ? `0${ordinal} / Your shortlist` : "The sample collection"}
        </span>
        <span className="sd-stamp">Fictional session</span>
      </div>
      <div className="sd-card-copy">
        <p className="sd-kicker">{venue?.name}</p>
        <h2>{session.title}</h2>
        <p>{sessionDate(session.startsAt)} · London time</p>
        <dl className="sd-facts">
          <div>
            <dt>Per person</dt>
            <dd>{money(session.pricePence)}</dd>
          </div>
          <div>
            <dt>Sample places left</dt>
            <dd>{session.remaining}</dd>
          </div>
          <div>
            <dt>Session minimum</dt>
            <dd>{session.minimum}</dd>
          </div>
        </dl>
        {session.providerRank && (
          <p className="sd-why">
            Suggested from your selected tastes. Qloo venue order #
            {session.providerRank}; your dates, budget and places checked.
          </p>
        )}
        <Link
          className="sd-text-link"
          href={`/discover/sessions/${session.id}${runId ? `?run=${encodeURIComponent(runId)}` : ""}`}
        >
          Explore this experience <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}

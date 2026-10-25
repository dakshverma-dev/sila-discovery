import Link from "next/link";
export default function About() {
  return (
    <article className="sd-page sd-about">
      <p className="sd-kicker">A transparent discovery experiment</p>
      <h1>
        Real connections.
        <br />
        Clear boundaries.
      </h1>
      <h2>What is live?</h2>
      <p>
        Interest searches and venue affinity orders come from Qloo’s hackathon
        API. Five venue identities were checked using Qloo search names and
        Edinburgh addresses on 25 October 2026. Each shortlist shows the actual
        returned venue order, exclusions, fetch time and query fingerprint.
        Affinity is not a personal probability or an endorsement.
      </p>
      <h2>What is fictional?</h2>
      <p>
        Every session, date, price, headcount and capacity in this discovery
        collection is sample data. The venues have not approved or offered these
        sessions. Historical artwork is decorative. A request is a private
        demonstration record: it reserves nothing, contacts nobody and takes no
        payment.
      </p>
      <h2>What does Claude do?</h2>
      <p>
        The optional bounded assistant can call discover_sessions and
        get_session, with three tool calls and a 30-second total deadline. The
        server checks its final session IDs and order. It cannot write requests
        or change facts. Without a configured Anthropic key, direct live Qloo
        discovery still works and is labelled accordingly. Invalid model output
        falls back to verified Qloo results, with that failure shown.
      </p>
      <h2>Your data</h2>
      <p>
        A random, signed, HttpOnly visitor cookie controls access to your
        shortlists and requests. Records are stored in the separate discovery
        PostgreSQL database with row-level ownership policies. Cookies last
        seven days; shortlists can be used for 24 hours. Clearing the cookie
        removes access. This is an anonymous demo, not an account recovery
        service. Use a fictional club name and do not enter personal or
        sensitive information.
      </p>
      <p>
        Only selected cultural entity IDs are sent to Qloo. If you enable
        Claude, the structured constraints and tool results also go to
        Anthropic. API keys stay on the server. The local setup stores records
        in a Docker volume until the local database owner deletes it; hosted
        retention and deletion need to be configured before a public release.
      </p>
      <h2>Picture credits</h2>
      <p>
        Ernst Haeckel, Actiniae, 1904; Thomas Bewick, A History of British
        Birds, 1797; Albrecht Dürer, Young Hare, 1502 — public-domain works.
        Dürer’s Melencolia I, 1514, and the Asante kente cloth detail — The
        Metropolitan Museum of Art, Open Access / CC0. Credits follow Sila’s
        existing artwork catalogue. These decorative plates do not depict the
        venues.
      </p>
      <h2>The Sila pilot remains separate</h2>
      <p>
        The pilot uses manual introductions, venue approval and guarded booking
        rules. This hackathon discovery experiment makes no decisions for live
        clubs or sessions.
      </p>
      <Link className="sd-text-link" href="/discover">
        Find a shared experience ↗
      </Link>
    </article>
  );
}

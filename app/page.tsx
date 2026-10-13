import Link from "next/link";

export default function HomePage() {
  return (
    <main id="main" className="page stack">
      <h1>Shared Cultural Bookings</h1>
      <p>
        Small Edinburgh communities can pool interest and attendance to reserve a venue-approved
        cultural experience together. Each person reserves their own seat, and the venue confirms
        the booking. No payment is collected.
      </p>
      <section className="surface stack" aria-labelledby="status-heading">
        <h2 id="status-heading">Build status</h2>
        <p>
          This is an early build for the Qloo Agentic Hackathon. The deterministic matching rules
          and the Qloo adapter exist with automated tests. Accounts, reservations, venue
          confirmation and live Qloo evidence are not yet available.
        </p>
        <p>
          <Link href="/sandbox">Open the synthetic judge sandbox</Link>
        </p>
      </section>
    </main>
  );
}

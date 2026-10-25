import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DiscoveryShell } from "@/components/discovery/shell";
import { visitor } from "@/lib/discovery/identity";
import { getPlaceRequest } from "@/lib/discovery/store";
import { money, sessionDate, venueFor } from "@/lib/discovery/catalog";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your conditional sample request",
  robots: { index: false, follow: false },
};
export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await visitor(false);
  const request =
    owner && z.uuid().safeParse(id).success
      ? await getPlaceRequest(owner, id)
      : null;
  if (!request) notFound();
  return (
    <DiscoveryShell>
      <section className="sd-page sd-receipt">
        <p className="sd-kicker">
          Saved privately in this browser’s visitor account
        </p>
        <span className="sd-pill">Conditional · sample request</span>
        <h1>
          A possibility,
          <br />
          <em>put on paper.</em>
        </h1>
        <p className="sd-lede">
          {request.clubName}, your request for {request.places} fictional places
          has been saved.
        </p>
        <div className="sd-receipt-card">
          <h2>{request.session.title}</h2>
          <p>{venueFor(request.session)?.name}</p>
          <dl className="sd-ticket-facts">
            <div>
              <dt>Date</dt>
              <dd>{sessionDate(request.session.startsAt)} · London time</dd>
            </div>
            <div>
              <dt>Requested</dt>
              <dd>{request.places} sample places</dd>
            </div>
            <div>
              <dt>Price per person</dt>
              <dd>{money(request.session.pricePence)}</dd>
            </div>
            <div>
              <dt>Indicative total</dt>
              <dd>{money(request.totalPence)}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd className="sd-reference">{request.id}</dd>
            </div>
          </dl>
        </div>
        <h2>What would happen next?</h2>
        <ol className="sd-next">
          <li>
            <strong>The venue reviews your club.</strong> No venue has received
            this sample request.
          </li>
          <li>
            <strong>Enough people commit conditionally.</strong> The sample
            session minimum is {request.session.minimum}; your request alone
            does not establish that it has been reached.
          </li>
          <li>
            <strong>The venue confirms the arrangements.</strong> No booking,
            payment or place reservation happens in this demo.
          </li>
        </ol>
        <aside className="sd-notice">
          This is a persisted fictional request, private to the current signed
          visitor cookie. Clearing cookies removes your access. Keep the same
          browser to revisit this reference. Do not send money or travel based
          on this page.
        </aside>
        <Link className="sd-text-link" href="/discover">
          Explore another shared possibility ↗
        </Link>
      </section>
    </DiscoveryShell>
  );
}

import type { ReactNode } from "react";
import type { PublicSession } from "@/lib/sila/commands/sessions";

/** Small presentational pieces shared by the public session page and the plan panels. Server components. */

export function KeyFacts({ items }: { items: { label: string; value: ReactNode; note?: ReactNode }[] }) {
  return (
    <dl className="pn-key">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.note ? <dd className="pn-key-note">{item.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** A bordered statement of where the plan stands, with an optional heading line. */
export function Box({ children, tone }: { children: ReactNode; tone?: "warning" | "success" }) {
  return <div className={`pn-box${tone ? ` pn-box-${tone}` : ""}`}>{children}</div>;
}

export function FactList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="facts">
      {rows.map((r) => (
        <div key={r.label} className="pn-fact-row">
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The venue's public contact route: direct email and phone, never a form for medical or access notes. */
export function venueContactHref(venue: PublicSession["venue"]): string {
  if (venue.contact_email) return `mailto:${venue.contact_email}`;
  if (venue.contact_phone) return `tel:${venue.contact_phone.replace(/[^\d+]/g, "")}`;
  return "#venue";
}

export function VenueContact({ venue }: { venue: PublicSession["venue"] }) {
  return (
    <section id="venue" className="stack-sm" aria-labelledby="venue-heading">
      <h2 id="venue-heading" className="pn-h2">
        {venue.name}
      </h2>
      <p>{venue.address}</p>
      {venue.access_facts ? (
        <p>
          <strong>Access:</strong> {venue.access_facts}
        </p>
      ) : null}
      <p className="muted">
        For access or personal arrangements, contact the venue directly.
        {venue.contact_email ? (
          <>
            {" "}
            <a href={`mailto:${venue.contact_email}`}>{venue.contact_email}</a>
          </>
        ) : null}
        {venue.contact_phone ? (
          <>
            {" "}
            <a href={`tel:${venue.contact_phone.replace(/[^\d+]/g, "")}`}>{venue.contact_phone}</a>
          </>
        ) : null}
      </p>
    </section>
  );
}

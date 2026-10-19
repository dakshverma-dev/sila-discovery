import { randomUUID } from "node:crypto";
import { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AccountBar } from "@/components/sila/account-bar";
import { SiteHeader } from "@/components/sila/chrome";
import { KeyFacts, VenueContact, venueContactHref } from "@/components/sila/plan/parts";
import { RequestForm } from "@/components/sila/plan/request-form";
import { getSilaActor } from "@/lib/sila/auth";
import { PLAN_SOURCES, type PlanSource } from "@/lib/sila/commands/plans";
import { getPublicSession } from "@/lib/sila/commands/sessions";
import { formatLondonDay, formatLondonRange } from "@/lib/sila/forms";
import { formatGBP } from "@/lib/sila/money";
import { london, planErrorMessage, requestClosedMessage } from "@/lib/sila/plan-copy";
import { DRAFT_COOKIE, openRequestDraft } from "@/lib/sila/request-draft";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loadSession = cache((id: string) => getPublicSession(id));

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Session" };
  const session = await loadSession(id);
  return { title: session.ok ? session.data.title : "Session" };
}

/** The dated session as a club organiser first meets it (§05): the facts first, then the request form. */
export default async function PublicSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;

  const loaded = await loadSession(id);
  if (!loaded.ok) {
    if (loaded.error.code === "NOT_FOUND") notFound();
    throw new Error(`get_public_session failed: ${loaded.error.code}`);
  }
  const s = loaded.data;
  const now = new Date();
  const closed = requestClosedMessage(s, now);

  const actor = await getSilaActor();
  const draft = openRequestDraft((await cookies()).get(DRAFT_COOKIE)?.value);
  const mine = draft && draft.sessionId === id ? draft : null;
  const sourceParam = one(sp.source);
  const source: PlanSource =
    mine?.source ?? ((PLAN_SOURCES as readonly string[]).includes(sourceParam ?? "") ? (sourceParam as PlanSource) : "unknown");

  const reviewing = one(sp.review) === "1" && mine && actor && actor.email.toLowerCase() !== mine.email.toLowerCase();
  const resumeError = one(sp.resume_error);

  const start = new Date(s.starts_at);
  const needed = Math.max(s.minimum - s.committed_places, 0);

  return (
    <>
      <SiteHeader />
      <main id="main" className="page stack-lg">
        <header className="stack-sm">
          <p className="kicker">{s.venue.name}</p>
          <h1 className="page-title">{s.title}</h1>
          <p className="dek">
            {formatLondonDay(start)} · {formatLondonRange(start, new Date(s.ends_at))} London time
          </p>
        </header>

        <KeyFacts
          items={[
            { label: "Price per person", value: formatGBP(s.price_minor) },
            { label: "Minimum", value: `${s.minimum} places` },
            { label: "Capacity", value: `${s.capacity} places` },
            {
              label: "Conditional places",
              value: s.committed_places,
              note: needed > 0 ? `${needed} more needed to reach ${s.minimum}` : "Minimum reached",
            },
            { label: "Fill by", value: london(s.fill_by) },
            { label: "Final decision", value: london(s.decision_by) },
          ]}
        />
        <p className="muted">
          Places are conditional. The session goes ahead only if it reaches {s.minimum} places by the fill-by time, and
          no payment is taken before that.
        </p>

        {reviewing ? (
          <p className="flash flash-notice" role="status">
            You are signed in as {actor?.email}, but this request was saved for {mine?.email}. Check the details below
            and send it again with the email you want to use.
          </p>
        ) : null}
        {resumeError ? (
          <p className="flash flash-error" role="alert">
            {planErrorMessage(resumeError)}
            {mine ? " Your details are kept below." : ""}
          </p>
        ) : null}

        <div className="grid-2">
          <div className="stack">
            {closed ? (
              <section className="stack" aria-labelledby="closed-heading">
                <h2 id="closed-heading">Request group places</h2>
                <p className="callout callout-warning" role="status">
                  {closed}
                </p>
                <p>
                  <a href={venueContactHref(s.venue)}>Ask the venue about another session</a>
                </p>
              </section>
            ) : (
              <RequestForm
                sessionId={id}
                idempotencyKey={randomUUID()}
                source={source}
                priceMinor={s.price_minor}
                depositBp={s.deposit_bp}
                capacity={s.capacity}
                defaults={{
                  clubName: mine?.clubName ?? "",
                  places: mine ? String(mine.places) : "",
                  email: mine?.email ?? actor?.email ?? "",
                }}
                accessHref={venueContactHref(s.venue)}
              />
            )}
            <p className="muted">
              <a href={venueContactHref(s.venue)}>Ask about another date</a> · On request
            </p>
          </div>

          <div className="stack">
            <VenueContact venue={s.venue} />
            {s.meeting_point ? (
              <section className="stack-sm">
                <h2 className="pn-h2">Meeting point</h2>
                <p>{s.meeting_point}</p>
              </section>
            ) : null}
          </div>
        </div>

        {s.description || s.inclusions ? (
          <section className="stack" aria-labelledby="about-heading">
            <h2 id="about-heading">About this session</h2>
            {s.description ? <p className="pn-pre lede-serif">{s.description}</p> : null}
            {s.inclusions ? (
              <div className="stack-sm">
                <h3>What is included</h3>
                <p className="pn-pre">{s.inclusions}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {actor ? <AccountBar email={actor.email} /> : null}
      </main>
    </>
  );
}

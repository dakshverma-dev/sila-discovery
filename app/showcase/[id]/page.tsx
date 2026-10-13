/* eslint-disable @next/next/no-img-element -- plates are pre-sized in public/art */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtLayers } from "@/components/sila/art-layers";
import { themeVars } from "@/components/sila/band";
import { ArrowLeft, ArrowRight, Glyph, RevealLines } from "@/components/sila/chrome";
import { ShowcaseLive } from "@/components/sila/showcase-live";
import { CIN, credit, img, INDIGO, INK, JADE, OLIVE, OX } from "@/lib/ui/sila/art";
import { capFirst, DEMO_EXPS, DEMO_STATUS, demoById, demoLines, demoLook } from "@/lib/ui/sila/showcase";

export function generateStaticParams() {
  return DEMO_EXPS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const e = demoById((await params).id);
  return { title: e ? e.title : "Demo experience" };
}

export default async function ShowcaseProposal({ params }: { params: Promise<{ id: string }> }) {
  const e = demoById((await params).id);
  if (!e) notFound();
  const look = demoLook(e);
  const S = DEMO_STATUS[e.status];
  const confirmed = e.status === "confirmed";
  const order = ["proposed", "awaiting", "confirmed"] as const;
  const cur = order.indexOf(e.status);

  const statusSub = confirmed
    ? e.subs[2]
    : e.status === "awaiting"
      ? `${e.subs[1]}. ${e.subs[2]}.`
      : `Commitments open until ${e.deadline}. ${e.subs[1]}.`;

  const rules = confirmed
    ? [
        "This experience is confirmed. Booking takes payment now.",
        "Cancel free of charge until 48 hours before.",
        "Interest beyond capacity is passed to the venue in case it adds a second date.",
      ]
    : [
        `Registering interest is free and holds no place. It shows ${e.venueShort} the ${e.unit} is wanted.`,
        `Committing holds a place. Only commitments count toward the minimum of ${e.needed}.`,
        e.status === "awaiting"
          ? `If ${e.venueShort} doesn’t confirm by ${e.subs[2].replace("Decision expected by ", "")}, every commitment lapses and nothing is charged.`
          : `If the minimum isn’t reached by ${e.deadline}, the proposal closes and nothing is charged.`,
      ];

  return (
    <main id="main">
      <section aria-label={e.title} className="p-hero" style={themeVars(look)}>
        <div className="p-art">
          <div className="p-art-inner">
            <ArtLayers look={look} mode="p" />
          </div>
          <span className="plates-abs">{[...new Set(look.layers.map((l) => l.k))].map(credit).join(" · ")}</span>
        </div>

        <div className="p-panel">
          <div className="crumbs">
            <Link href="/#index">
              <ArrowLeft />
              All experiences
            </Link>
            <span className="op7">
              {e.cat} · {e.city} · {e.ref}
            </span>
          </div>
          <h1 className="p-title">
            <RevealLines lines={demoLines(e)} />
          </h1>
          <span className="tag-illus">Demo data</span>
          <div className="chip-row">
            <span className="chip">
              <Glyph bg={S.glyph} />
              {S.short}
            </span>
            <span className="op75">{statusSub}</span>
          </div>
          <Link href={`/showcase/${e.id}/affinity`} className="pair-link">
            <span className="avatars">
              <span>
                <img src={img(e.A.img)} alt="" />
              </span>
              <span>
                <img src={img(e.B.img)} alt="" />
              </span>
            </span>
            <span className="names">
              <span>
                {e.A.name} + {e.B.name}
              </span>
              <span>
                {e.shared.length} shared interests: {e.shared.map((s) => s[0]).join(", ")}
              </span>
            </span>
            <span className="go">
              Affinity
              <ArrowRight />
            </span>
          </Link>
          <p className="p-short">{e.short}</p>
          <ShowcaseLive e={e} />
        </div>
      </section>

      <section className="wrap section" style={{ ["--accent-on-light" as string]: look.theme.onLight }}>
        <div className="section-head">
          <h2 className="h-xl">
            Why it was <em>suggested</em>
          </h2>
          <p>{e.why}</p>
        </div>
        <div className="shared-grid">
          {e.shared.map((s, i) => (
            <figure key={s[0]} className="shared-fig">
              <div className="plate-box" style={{ background: [OX, JADE, INDIGO, OLIVE][i % 4] }}>
                {s[4] ? <img src={img(s[4])} alt="" loading="lazy" style={{ objectPosition: s[5] ?? "50% 50%" }} /> : <span className="word">{s[0]}</span>}
              </div>
              <figcaption>
                <span>{s[0]}</span>
                <span>{s[3]}</span>
                <span>
                  {capFirst(e.A.short)} {s[1]}% · {capFirst(e.B.short)} {s[2]}%
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="fine">
          Percentages are the share of each community’s active members whose saved works, visits and follows include the
          interest. Illustrative figures until Qloo’s taste data is connected.
        </p>
      </section>

      <section className="wrap section two-col">
        <div>
          <h2 className="h-lg">The {e.unit}</h2>
          <ol className="plan">
            {e.plan.map(([t, d]) => (
              <li key={t + d}>
                <span>{t}</span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="h-lg">How it becomes real</h2>
          <div className="stages">
            {["Proposed", "Awaiting venue", "Confirmed"].map((label, i) => (
              <div key={label} style={{ borderTopColor: i <= cur ? (i === cur ? CIN : INK) : "oklch(0.22 0.02 50 / .15)" }}>
                <span
                  aria-hidden="true"
                  className="dot"
                  style={{
                    background: i < cur ? INK : i === cur ? CIN : "transparent",
                    borderColor: i <= cur ? (i === cur ? CIN : INK) : "oklch(0.22 0.02 50 / .35)",
                  }}
                />
                <div className="label">{label}</div>
                <div className="sub">{e.subs[i]}</div>
              </div>
            ))}
          </div>
          <ul className="rules">
            {rules.map((t, i) => (
              <li key={t}>
                <span>{["i", "ii", "iii"][i]}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

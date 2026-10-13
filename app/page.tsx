import Link from "next/link";
import { ArrowDown, ArrowRight, Glyph, SiteFooter, SiteHeader } from "@/components/sila/chrome";
import { DemoBands, demoInCat } from "@/components/sila/demo-bands";
import { HeroFans } from "@/components/sila/hero-fans";
import { Flash } from "@/components/ui";
import { CATS, CIN, JADE, OCHRE, OX } from "@/lib/ui/sila/art";
import { DEMO_EXPS, DEMO_STATUS } from "@/lib/ui/sila/showcase";
import { startSandbox } from "./demo/actions";

const STEPS = [
  { t: "Shared taste found", deg: "45deg", color: OCHRE },
  { t: "An experience proposed", deg: "90deg", color: JADE },
  { t: "Enough people commit", deg: "135deg", color: CIN },
  { t: "The venue says yes", deg: "180deg", color: OX },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; cat?: string }>;
}) {
  const { notice, error, cat } = await searchParams;
  const filter = CATS.includes(cat as (typeof CATS)[number]) ? cat! : "All";
  const list = demoInCat(filter);
  return (
    <>
      <SiteHeader
        nav={[
          { num: "i", label: "Discover", href: "/", current: true },
          { num: "ii", label: "Affinity", href: null },
          { num: "iii", label: "Proposal", href: null },
        ]}
      />
      <main id="main">
        {(notice || error) && (
          <div className="wrap flash-wrap">
            <Flash notice={notice} error={error} />
          </div>
        )}
        <section aria-label="sila, issue seven" className="hero">
          <div className="wrap hero-inner">
            <div className="issue-line">
              <span>Nº 07 · Autumn 2026</span>
              <span>Qloo Agentic Hackathon · Edinburgh</span>
            </div>
            <div className="hero-grid">
              <HeroFans />
              <div className="hero-copy">
                <div className="mast">
                  <h1 aria-label="sila">
                    <span aria-hidden="true"><span data-reveal="line">s</span></span>
                    <span aria-hidden="true" className="i"><span data-reveal="line" data-delay="70">i</span></span>
                    <span aria-hidden="true"><span data-reveal="line" data-delay="140">l</span></span>
                    <span aria-hidden="true"><span data-reveal="line" data-delay="210">a</span></span>
                  </h1>
                  <div className="gloss">
                    <span lang="ar" dir="rtl">صِلَة</span>
                    <span className="serif">ṣila, n.</span>
                    <small>Arabic: a tie or connection; that which joins one thing to another.</small>
                  </div>
                </div>
                <p className="tagline">
                  Cultural experiences that happen <em>when enough of us ask for them.</em>
                </p>
                <ol aria-label="How sila works" className="steps">
                  {STEPS.map((s) => (
                    <li key={s.t}>
                      <span
                        aria-hidden="true"
                        className="arc"
                        style={{
                          background: `conic-gradient(from 270deg at 50% 100%, ${s.color} 0deg ${s.deg}, oklch(0.22 0.02 50 / .12) ${s.deg} 180deg, transparent 180deg)`,
                        }}
                      />
                      <span>{s.t}</span>
                    </li>
                  ))}
                </ol>
                <p className="hero-note">
                  sila finds communities whose tastes overlap, proposes something both would want, and gathers
                  reservations until a venue can say yes. Nothing is charged: no payment is collected.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <a href="#index" className="btn-ink">
                    See what’s forming
                    <ArrowDown />
                  </a>
                  <form action={startSandbox}>
                    <button type="submit" className="btn-line">
                      Start a sandbox
                      <ArrowRight />
                    </button>
                  </form>
                </div>
                <p className="note" style={{ margin: 0, maxWidth: "44ch" }}>
                  A private, isolated workspace with a fictional venue, five programmes and five community groups. Switch
                  between venue manager, organisers and participants; it expires within 24 hours.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="index" aria-label="Experiences forming" className="index">
          <div className="wrap index-head">
            <div className="count">
              <span>{String(list.length).padStart(2, "0")}</span>
              <span>
                experiences
                <br />
                now forming
              </span>
            </div>
            <div className="index-tools">
              <nav aria-label="Filter by discipline" className="cats">
                {CATS.map((c) => (
                  <Link key={c} href={c === "All" ? "/#index" : `/?cat=${encodeURIComponent(c)}#index`} aria-current={filter === c ? "true" : undefined} scroll={false}>
                    {c}
                    <sup>{c === "All" ? DEMO_EXPS.length : DEMO_EXPS.filter((e) => e.cat === c).length}</sup>
                  </Link>
                ))}
              </nav>
              <div className="legend">
                {(["proposed", "awaiting", "confirmed"] as const).map((k) => (
                  <span key={k}>
                    <Glyph bg={DEMO_STATUS[k].glyph} />
                    <strong>{DEMO_STATUS[k].short}</strong>
                    <span className="op72">
                      {k === "proposed" ? "gathering commitments; nothing booked" : k === "awaiting" ? "minimum reached; places held, not charged" : "venue said yes; places charged (demonstration)"}
                    </span>
                  </span>
                ))}
              </div>
              <p className="note" style={{ margin: 0 }}>
                Demo data from the sila design. Start a sandbox to work with real, fictional-venue proposals.
              </p>
            </div>
          </div>
          <DemoBands list={list} />
        </section>

        <section className="index" aria-labelledby="how-h">
          <div className="wrap section two-col" style={{ paddingTop: "clamp(36px,5vw,72px)" }}>
            <div>
              <h2 id="how-h" className="h-lg">
                How it becomes real
              </h2>
              <ul className="rules">
                {[
                  "Organisers describe their group: size, budget, exact availability, access needs and sharing choice.",
                  "The agent checks hard requirements first, then uses cultural evidence to order feasible coalitions.",
                  "The venue reviews and publishes immutable terms; each organiser accepts for their group.",
                  "Participants reserve one seat each. The venue confirms when the threshold is met.",
                ].map((t, i) => (
                  <li key={t}>
                    <span>{["i", "ii", "iii", "iv"][i]}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="note" style={{ marginTop: 18 }}>
                Looking for the matching rules alone? Open the <Link href="/sandbox">matching explorer</Link>.
              </p>
            </div>
            <div>
              <h2 id="status-h" className="h-lg">
                Build <em className="it" style={{ color: "var(--ox)" }}>status</em>
              </h2>
              <p className="lede">
                Early hackathon build. The sandbox uses synthetic cultural evidence because its groups and programmes are
                fictional. Live Qloo evidence is implemented behind a server-side adapter but has not yet been verified
                with an issued key.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

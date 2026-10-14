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

const PATHS = [
  {
    kicker: "Demo data · read-only",
    title: "Browse the showcase",
    body: "Seven illustrative experiences, listed below. Open one to see why two communities were paired and how close it is to going ahead. Picking a date, committing or registering interest is kept in your browser only; nothing is stored or charged.",
    cta: "See the experiences",
    href: "#index",
    color: OCHRE,
  },
  {
    kicker: "Sandbox · fictional venue, real rules",
    title: "Run the whole workflow",
    body: "Get a private workspace for 24 hours with one fictional venue, five programmes and five groups. Switch between venue manager, organisers and participants, and take a proposal from suggestion to confirmed booking. Every step goes through the real booking rules; no payment is taken.",
    cta: "sandbox",
    href: null,
    color: CIN,
  },
  {
    kicker: "Matching explorer",
    title: "Inspect the matching rules",
    body: "One programme, its interested groups and a few preset scenarios on a single page. See which groups the matching rules exclude on budget, time, access or consent, and how the remaining combinations are ordered. Synthetic data, computed instantly; nothing is reserved.",
    cta: "Open the matching explorer",
    href: "/sandbox",
    color: JADE,
  },
];

const FLOW = [
  { t: "Groups describe themselves", d: "Organisers set group size, per-person budget, exact availability, access needs and whether they will share a session." },
  { t: "The agent proposes", d: "Hard requirements are checked first; cultural evidence then orders the feasible pairings. An organiser sends the best option to the venue." },
  { t: "Terms are published", d: "The venue publishes fixed terms (price, date, minimum, deadline) and each organiser accepts for their group." },
  { t: "People commit, venue confirms", d: "Participants reserve one seat each. Once the minimum is reached, the venue confirms the booking." },
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
                <div className="hero-actions">
                  <a href="#guide" className="btn-ink">
                    How it works
                    <ArrowDown />
                  </a>
                  <form action={startSandbox}>
                    <button type="submit" className="btn-line">
                      Start a sandbox
                      <ArrowRight />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="guide" aria-labelledby="guide-h" className="guide">
          <div className="wrap">
            <div className="section-head">
              <h2 id="guide-h" className="h-xl">
                What you’re <em>looking at</em>
              </h2>
              <p>
                sila is a hackathon prototype. It pairs community groups whose cultural tastes overlap, proposes one
                session they would both enjoy, and only books it once enough people commit and the venue agrees. There
                are three ways to explore it.
              </p>
            </div>
            <ol className="paths">
              {PATHS.map((p, i) => (
                <li key={p.title} className="path" style={{ borderTopColor: p.color }}>
                  <span className="kicker">
                    {["i", "ii", "iii"][i]} · {p.kicker}
                  </span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                  <div className="path-cta">
                    {p.cta === "sandbox" ? (
                      <form action={startSandbox}>
                        <button type="submit" className="btn-ink">
                          Start a sandbox
                          <ArrowRight />
                        </button>
                      </form>
                    ) : (
                      <Link href={p.href!} className="link-under">
                        {p.cta}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <h3 className="flow-h">How a shared booking becomes real</h3>
            <ol className="flow">
              {FLOW.map((f, i) => (
                <li key={f.t}>
                  <span className="flow-n">{["i", "ii", "iii", "iv"][i]}</span>
                  <strong>{f.t}</strong>
                  <span>{f.d}</span>
                </li>
              ))}
            </ol>
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

        <section className="index" aria-labelledby="status-h">
          <div className="wrap section" style={{ paddingTop: "clamp(48px,6vw,88px)" }}>
            <h2 id="status-h" className="h-lg">
              Build <em className="it" style={{ color: "var(--ox)" }}>status</em>
            </h2>
            <p className="lede">
              Early hackathon build. The sandbox uses synthetic cultural evidence because its groups and programmes are
              fictional. Live Qloo evidence is implemented behind a server-side adapter but has not yet been verified
              with an issued key.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

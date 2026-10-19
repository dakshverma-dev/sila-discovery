"use client";

import Image from "next/image";
import { useState } from "react";
import type { WorkspaceSession } from "@/lib/sila/sample-workspace";
import { useWorkspace } from "./workspace-provider";
import type { ApplicationNavigation } from "./navigation";
import { CIN, IVORY, JADE, OCHRE, ROSE, STATUS_FILTERS, compositionIn, dayMonth, leadLayer, duration, pounds, publicSessions, sessionView, shortDay, timeRange, titleLines, platesLine } from "./compositions";
import { ArrowDown, ArrowRight, Bar, Glyph, Plates, artKey, thumbRadius } from "./plates";
import styles from "./discover.module.css";

/*
 * The discovery screen of the v5 prototype (Sila prototype launch, Sila v5.dc.html):
 * hero, how it works, the filterable index and one illustrated band per session,
 * then the audience sections. Booking copy follows guide §07, §13, §15–18; the
 * prototype's matching and public-participant assumptions are not used.
 */
export function LandingPage({ nav }: { nav: ApplicationNavigation }) {
  const { data, account, switchAccount } = useWorkspace();
  const featured = data.sessions.find(s => s.id === "print-room" && s.phase !== "draft") ?? publicSessions(data)[0];
  function openWorkspace(role: "organiser" | "venue") {
    if (role === "venue") { switchAccount("venue"); nav.navigate("/venue"); }
    else { if (account !== "meadows" && account !== "leith") switchAccount("meadows"); nav.navigate("/plans"); }
  }
  return <div className={styles.discover}>
    {featured ? <Hero s={featured} nav={nav} /> : null}
    <HowItWorks />
    <Experiences nav={nav} />
    <Audience id="organisers" icon="arch" title={<>For club <em>organisers</em></>}
      lede="For reading groups, arts societies and curious clubs. Find a dated session worth getting everyone together for. A second club can share it, so a smaller group can still fill the room."
      items={[["One offer to consider", "See the date, price, minimum, inclusions and venue terms before you request exact places."], ["Your club, your decision", "The venue approves your places. You review the conditions and decide whether to commit."], ["A clear next step", "Follow your request, conditional places, payment deadlines and venue confirmation in one plan."], ["Practical details to share", "Once confirmed, download your club’s booking summary. You manage your members directly."]]}
      note="No member accounts or rosters. Personal access arrangements go directly to the venue.">
      <button type="button" className={styles.btnInk} onClick={() => openWorkspace("organiser")}>Open organiser workspace <ArrowRight /></button>
      <a href="#overview" className={styles.textBtn}>Find a session</a>
    </Audience>
    <Audience id="venues" icon="fan" title={<>For cultural <em>venues</em></>}
      lede="A small enquiry can become a shared session. You set the date, price and minimum, approve each club, and make the final booking decision."
      items={[["A dated offer", "A clear resource hold, fill-by date and final decision deadline."], ["Exact places in view", "Each club’s requested quantity and conditional commitment, side by side."], ["Payments direct to you", "Deposits and balances go to the venue, with receipts and returns on record."], ["Your decision, last", "Nothing is confirmed until you verify receipts and check your diary."]]}
      note={`${count(data.sessions.filter(s => s.phase === "published").length, "published session")} and ${count(data.plans.filter(p => p.status === "requested").length, "club request")} in the sample venue workspace.`}>
      <button type="button" className={styles.btnInk} onClick={() => openWorkspace("venue")}>Open venue workspace <ArrowRight /></button>
    </Audience>
  </div>;
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Hero({ s, nav }: { s: WorkspaceSession; nav: ApplicationNavigation }) {
  const { data, account } = useWorkspace();
  const c = compositionIn(data, s), v = sessionView(data, s, account);
  const layers = c.layers.filter(l => l.h).length ? c.layers.filter(l => l.h) : c.layers;
  const stageNames = ["Commitments", "Deposits", "Venue confirmation"];
  const rule = v.closed ? "Places are released. Payment and refund history stay available."
    : v.confirmed ? "The venue has confirmed. Each club keeps its own agreement and payment history."
    : "Conditional until the venue verifies deposits, checks its diary and confirms. Nobody pays before payment opens.";
  return <section className={styles.hero} aria-labelledby="hero-h">
    <div className={styles.heroCopy}>
      <p className={styles.gloss}><span lang="ar" dir="rtl">صِلَة</span><span><em>ṣila</em>, from the Arabic: a tie or connection</span></p>
      <h1 id="hero-h" className={styles.heroTitle}>
        <span className={styles.line}><span data-reveal="line">Some doors only open</span></span>
        <span className={styles.line}><em data-reveal="line" data-delay="80">to a group.</em></span>
      </h1>
      <p className={styles.heroLede}>Explore a print room after hours or make a small edition by hand. Sila brings smaller cultural clubs together, gathering enough places to make a venue’s session possible.</p>
      <div className={styles.heroActions}>
        <a href="#overview" className={styles.btnInk}>Explore experiences <ArrowDown /></a>
        <a href="#how" className={styles.textBtn}>How it works</a>
      </div>
      <p className={styles.heroNote}><strong>A place for your club.</strong> Up to two clubs can share one dated session. Your organiser agrees the places; the venue makes the final decision. <a href="#organisers">Run a group of your own?</a></p>
    </div>
    <div className={styles.heroSide}>
      <div className={styles.heroArt} role="group" aria-label="Printmaking artwork collage">
        <div aria-hidden="true" data-unfold="fan" className={styles.heroFan} />
        <div aria-hidden="true" className={styles.heroOrbit} />
        <Plates sessionId={s.id} layers={layers} mode="h" priority />
      </div>
      <article className={styles.featured} aria-label={`Featured session: ${s.title}`}>
        <span className={styles.kicker}>Featured · sample session</span>
        <h2>{s.title}</h2>
        <span className={styles.meta}>{data.venue.name}, Edinburgh · {duration(s)} · {pounds(s.priceMinor)} per person</span>
        <div className={styles.cardProgress}>
          <span><strong>{v.confirmed ? `${v.held} of ${s.capacity} places booked` : `${v.held} of ${s.minimum} places committed`}</strong> <span className={styles.dim}>for {shortDay(s.startsAt)}</span></span>
          <Bar bar={v.bar()} />
          <span className={styles.cardNext}>{v.next}</span>
        </div>
        <ol aria-label="Booking stages" className={styles.stages}>
          {stageNames.map((label, i) => {
            const cur = !v.closed && i === v.stage;
            return <li key={label} aria-current={cur ? "step" : undefined} style={{ borderTopColor: i < v.stage && !v.closed ? "var(--d-ink)" : cur ? CIN : "oklch(0.22 0.02 50 / .15)", fontWeight: cur ? 600 : 400, opacity: i <= v.stage ? 1 : 0.7 }}>{label}</li>;
          })}
        </ol>
        <span className={styles.rule}>{rule}</span>
        <div className={styles.pair}>
          <span className={styles.avatars} aria-hidden="true"><Image src="/art/printer.jpg" alt="" width={38} height={38} unoptimized /><Image src="/art/hare.jpg" alt="" width={38} height={38} unoptimized /></span>
          <span>Two clubs, one shared session. Separate agreements and payments.</span>
        </div>
        <a href={nav.href(`/s/${s.id}`)} className={styles.btnLine}>View experience <ArrowRight /></a>
      </article>
    </div>
  </section>;
}

const STEPS = [
  { n: "i.", t: "A venue sets the session", d: "One date, a fixed price, a minimum and clear terms. The venue approves each club and its places.", deg: "45deg", color: OCHRE },
  { n: "ii.", t: "Clubs commit conditionally", d: "Each organiser agrees exact places. Invitations reserve nothing, and no deposit is due yet.", deg: "90deg", color: JADE },
  { n: "iii.", t: "The minimum is reached", d: "Payment opens at a staffed deadline. Each club pays its own deposit directly to the venue.", deg: "135deg", color: CIN },
  { n: "iv.", t: "The venue confirms", d: "The venue verifies receipts and checks its diary. Only then is the booking confirmed.", deg: "180deg", color: ROSE },
];
const COMPARE = [
  { t: "Request places", dot: "oklch(0.97 0.015 85 / .5)", items: ["Your club name and exact places, sent to the venue", "Nothing committed and nothing payable", "The venue approves your quantity before you decide"] },
  { t: "Commit conditionally", dot: CIN, items: ["Counts toward the session’s minimum", "Deposit due only once payment opens, paid to the venue", "Free to withdraw before payment opens; only the venue confirms"] },
];

function HowItWorks() {
  return <section id="how" aria-labelledby="how-h" className={styles.how}>
    <div className={styles.howInner}>
      <h2 id="how-h" className={styles.sectionTitle}>How it works</h2>
      <ol className={styles.steps}>
        {STEPS.map(s => <li key={s.n}>
          <span aria-hidden="true" className={styles.arc} style={{ background: `conic-gradient(from 270deg at 50% 100%, ${s.color} 0deg ${s.deg}, oklch(0.97 0.015 85 / .16) ${s.deg} 180deg, transparent 180deg)` }} />
          <h3><em>{s.n}</em> {s.t}</h3>
          <p>{s.d}</p>
        </li>)}
      </ol>
      <div className={styles.compare}>
        {COMPARE.map(c => <div key={c.t}>
          <h3>{c.t}</h3>
          <ul>{c.items.map(it => <li key={it}><span aria-hidden="true" style={{ background: c.dot }} /><span>{it}</span></li>)}</ul>
        </div>)}
      </div>
    </div>
  </section>;
}

const MONTH = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "numeric" }).format(new Date(iso));
const WHENS: [string, (iso: string) => boolean][] = [["Any time", () => true], ["November", iso => MONTH(iso) === "11"], ["December", iso => MONTH(iso) === "12"]];

export function ExperiencesPage({ nav }: { nav: ApplicationNavigation }) {
  return <div className={styles.discover}><Experiences nav={nav} standalone /></div>;
}

/** The prototype's overview: filters, a dense index and the illustrated bands, all from one filtered list. */
export function Experiences({ nav, standalone = false }: { nav: ApplicationNavigation; standalone?: boolean }) {
  const { data, account } = useWorkspace();
  const [cat, setCat] = useState("All"), [status, setStatus] = useState("All"), [when, setWhen] = useState("Any time");
  const all = publicSessions(data);
  const keys = STATUS_FILTERS.find(f => f[0] === status)?.[1] ?? null;
  const list = all.filter(s => (cat === "All" || s.category === cat) && (!keys || keys.includes(sessionView(data, s, account).key)) && (WHENS.find(w => w[0] === when)?.[1] ?? (() => true))(s.startsAt));
  const groups: [string, string[], string, (v: string) => void][] = [
    ["Category", ["All", ...new Set(all.map(s => s.category))], cat, setCat],
    ["Status", STATUS_FILTERS.map(f => f[0]), status, setStatus],
    ["Dates", WHENS.map(w => w[0]), when, setWhen],
  ];
  const Heading = standalone ? "h1" : "h2";
  return <>
    <section id="overview" aria-labelledby="ov-h" className={styles.overview}>
      <div className={styles.ovHead}>
        <Heading id="ov-h" className={styles.sectionTitle}>Help make <em>these happen</em></Heading>
        <span aria-live="polite">{list.length === all.length ? `${all.length} sessions` : `${list.length} of ${all.length} sessions`}</span>
      </div>
      <div className={styles.filters}>
        {groups.map(([label, opts, value, set]) => <div key={label} role="group" aria-label={label}>
          <span className={styles.filterLabel}>{label}</span>
          <div>{opts.map(o => <button key={o} type="button" aria-pressed={value === o} onClick={() => set(o)}>{o}</button>)}</div>
        </div>)}
      </div>
      <div aria-hidden="true" className={styles.rowHead}><span /><span>Experience</span><span>Category · venue</span><span>Date</span><span>Length · price</span><span>Status · places</span></div>
      {list.map(s => {
        const c = compositionIn(data, s), v = sessionView(data, s, account), l0 = leadLayer(c, s);
        return <a key={s.id} href={nav.href(`/s/${s.id}`)} className={styles.row} aria-label={`${s.title}, ${data.venue.name}, Edinburgh. ${v.status}. ${v.count}`}>
          <span data-art-key={artKey(s.id, l0)} className={styles.thumb} style={{ borderRadius: thumbRadius(l0) }}>
            <Image src={`/art/${l0.k}.jpg`} alt="" fill unoptimized sizes="72px" style={{ objectFit: "cover", objectPosition: l0.pos ?? "50% 50%" }} />
          </span>
          <span className={styles.rowTitle}><span>{s.title}</span><span>{(s.description.split(". ")[0] ?? s.description).replace(/\.$/, "")}.</span></span>
          <span className={styles.cell}>{s.category}<span className={styles.dim}> · {data.venue.name}, Edinburgh</span></span>
          <span className={styles.cell}><span className={styles.dim}>Date </span><strong>{shortDay(s.startsAt)}</strong></span>
          <span className={styles.cell}>{duration(s)} · <strong>{pounds(s.priceMinor)} pp</strong></span>
          <span className={`${styles.cell} ${styles.rowStatus}`}>
            <span className={styles.statusLine}><Glyph fill={v.glyph} size={10} />{v.status}</span>
            <Bar bar={v.bar()} height={5} max={240} />
            <span>{v.confirmed ? `${v.held} of ${s.capacity} booked` : `${v.held} of ${s.minimum} on ${dayMonth(s.startsAt)}${v.more && !v.closed ? ` · ${v.more} to go` : ""}`}</span>
          </span>
        </a>;
      })}
      {!list.length ? <div className={styles.noRows}><span>Nothing matches those filters.</span><button type="button" onClick={() => { setCat("All"); setStatus("All"); setWhen("Any time"); }}>Clear filters</button></div> : null}
    </section>
    <section aria-label="Experiences in detail" className={styles.bands}>
      {list.map(s => <Band key={s.id} s={s} index={all.indexOf(s)} nav={nav} />)}
    </section>
  </>;
}

function Band({ s, index, nav }: { s: WorkspaceSession; index: number; nav: ApplicationNavigation }) {
  const { data, account } = useWorkspace();
  const c = compositionIn(data, s), v = sessionView(data, s, account), th = c.theme, dark = th.ink === IVORY, lines = titleLines(s, c);
  const facts: [string, string][] = [["Venue", data.venue.name], ["Date", `${shortDay(s.startsAt)} · ${timeRange(s)}`], ["Duration", duration(s)], ["Price", `${pounds(s.priceMinor)} per person`]];
  return <article aria-labelledby={`band-${s.id}`} className={styles.band} data-layout={c.layout}
    style={{ "--b-ground": th.ground, "--b-ink": th.ink, "--b-accent": th.accent, "--b-rule": dark ? "oklch(0.97 0.015 85 / .28)" : "oklch(0.22 0.02 50 / .22)" } as React.CSSProperties}>
    <div className={styles.bandGrid}>
      <div className={styles.bandArt}><Plates sessionId={s.id} layers={c.layers} mode="d" /></div>
      <div className={styles.bandText}>
        <div className={styles.bandNo}><span>{String(index + 1).padStart(2, "0")}</span><span>{s.category}<br /><span>{data.venue.name}, Edinburgh</span></span></div>
        <h3 id={`band-${s.id}`} className={styles.bandTitle} data-long={lines.length > 2 || undefined}>
          <a href={nav.href(`/s/${s.id}`)}>{lines.map(ln => <span key={ln.t} className={styles.line}><span data-reveal="line" style={{ fontStyle: ln.italic ? "italic" : "normal" }}>{ln.t}</span></span>)}</a>
        </h3>
        <p className={styles.bandLede}>{s.description}</p>
        <dl className={styles.bandFacts}>{facts.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>
        <div className={styles.bandStatus}>
          <span className={styles.statusLine}><Glyph fill={v.glyph} />{v.status}</span>
          <Bar bar={v.bar(dark)} inherit />
          <span><strong>{v.count}</strong> {v.next}</span>
        </div>
        <div className={styles.bandActions}>
          <a href={nav.href(`/s/${s.id}`)} className={styles.btnSolid}>View experience <ArrowRight /></a>
          <a href={nav.href(`/s/${s.id}/clubs`)} className={styles.textBtn}>Who’s sharing this session?</a>
        </div>
        <span className={styles.plates}>{platesLine(c)}</span>
      </div>
    </div>
  </article>;
}

function Audience({ id, icon, title, lede, items, note, children }: { id: string; icon: "arch" | "fan"; title: React.ReactNode; lede: string; items: [string, string][]; note: string; children: React.ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-h`} className={styles.audience}>
    <div className={styles.audienceHead}>
      <span aria-hidden="true" className={icon === "arch" ? styles.arch : styles.archFill} data-unfold={icon === "fan" ? "fan" : undefined} />
      <h2 id={`${id}-h`} className={styles.audienceTitle}>{title}</h2>
    </div>
    <div className={styles.audienceBody}>
      <p className={styles.audienceLede}>{lede}</p>
      <ul className={styles.audienceList}>{items.map(([t, d]) => <li key={t}><span>{t}</span><span>{d}</span></li>)}</ul>
      <div className={styles.audienceActions}>{children}</div>
      <p className={styles.small}>{note}</p>
    </div>
  </section>;
}

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { SAMPLE_ACCOUNTS, amountsFor, livePlans, money, planState, type WorkspacePlan, type WorkspaceSession } from "@/lib/sila/sample-workspace";
import { useWorkspace } from "./workspace-provider";
import type { ApplicationNavigation } from "./navigation";
import { Empty, day, when } from "./primitives";
import { IVORY, INDIGO, JADE, OLIVE, OX, compositionIn, duration, platesCredit, pounds, sessionView, shortDay, timeRange, titleLines } from "./compositions";
import { ArrowLeft, ArrowRight, Bar, Glyph, Plates } from "./plates";
import styles from "./discover.module.css";

/*
 * The proposal, "why these communities" and commitment screens of the v5
 * prototype, carrying the product's booking model: one dated session, up to two
 * clubs, venue approval, conditional commitment and venue confirmation
 * (guide §07, §13, §15–18). Other clubs appear only as the session aggregate
 * (§506, §931): no club names, contacts or invoices.
 */
function useSession(id: string) {
  const { data, account } = useWorkspace();
  const s = data.sessions.find(x => x.id === id && x.phase !== "draft");
  return { data, account, s };
}
function Missing({ nav }: { nav: ApplicationNavigation }) {
  return <div className="sa-public"><Empty title="Session not found"><a href={nav.href("/#overview")}>Explore experiences</a></Empty></div>;
}
function Lines({ s, tag: Tag = "h1", className }: { s: WorkspaceSession; tag?: "h1" | "h2"; className?: string }) {
  const { data } = useWorkspace();
  return <Tag className={className}>{titleLines(s, compositionIn(data, s)).map(ln => <span key={ln.t} className={styles.line}><span data-reveal="line" style={{ fontStyle: ln.italic ? "italic" : "normal" }}>{ln.t}</span></span>)}</Tag>;
}

export function SessionPage({ id, nav }: { id: string; nav: ApplicationNavigation }) {
  const { data, account, s } = useSession(id);
  if (!s) return <Missing nav={nav} />;
  const c = compositionIn(data, s), v = sessionView(data, s, account), person = SAMPLE_ACCOUNTS[account];
  const committed = livePlans(data, s.id).length;
  const primary = person.role !== "organiser"
    ? { href: nav.href("/venue"), label: "Open venue workspace", sub: "Only a club organiser can request or commit places. Venue staff review and approve requests in the workspace." }
    : v.own ? { href: nav.href(`/plans/${v.own.id}`), label: "Open your plan", sub: `${v.own.club} · ${planState(data, v.own)}` }
    : v.open ? { href: nav.href(`/s/${s.id}/request`), label: "Request places for your club", sub: "Nothing is committed or payable when you request. The venue approves your exact places first." }
    : { href: "/#overview", label: "Explore other sessions", sub: v.closed ? "This session is not going ahead." : "This session is not accepting new requests." };
  const facts: [string, string][] = [
    ["Venue", `${data.venue.name}, Edinburgh`], ["Date", `${day(s.startsAt)} · ${timeRange(s)} London`], ["Duration", duration(s)],
    ["Price", `${pounds(s.priceMinor)} per person · all compulsory charges included`], ["Places", `Runs at ${s.minimum} · capacity ${s.capacity} · at most two clubs`],
    ["Included", s.inclusions], ...(v.confirmed || v.closed ? [] : [["Fill by", when(s.fillBy)], ["Final decision", `By ${when(s.decisionBy)}`]] as [string, string][]),
  ];
  const deposit = s.depositBasisPoints / 100;
  const rules = [
    "Request exact places for your club. Nothing is committed or payable when you request.",
    "The venue approves your quantity. You then review the conditions and decide whether to commit.",
    `Up to two clubs share the session. It runs only if committed places reach ${s.minimum} by ${when(s.fillBy)}.`,
    `When the minimum is reached, payment opens at a staffed midday deadline, with at least five calendar days to pay. Each club pays its own ${deposit}% deposit directly to the venue.`,
    `The venue verifies receipts and checks its diary, then decides by ${when(s.decisionBy)}. Until then, nothing is confirmed.`,
    "Withdrawal is free before payment opens. If the session fails before confirmation, all received payments are returned.",
    `The balance is due by ${when(s.balanceDueAt)}, after the venue confirms.`,
  ];
  const tiles = [
    { t: `${deposit}% deposit`, ref: "Paid by each club to the venue once payment opens", bg: OX },
    { t: "Balance", ref: `Due ${when(s.balanceDueAt)}, after confirmation`, bg: JADE },
    { t: "Final decision", ref: `The venue confirms or closes by ${when(s.decisionBy)}`, bg: INDIGO },
    { t: "Access", ref: "Personal arrangements go directly to the venue, never into a club plan", bg: OLIVE },
  ];
  return <div className={styles.discover}>
    <section aria-label={s.title} className={styles.proposal}>
      <div className={styles.pArt} data-session-art="" style={{ background: c.theme.ground, color: c.theme.ink }}>
        <div className={styles.pArtBox}><Plates sessionId={s.id} layers={c.layers} mode="p" priority /></div>
        <span className={styles.pPlates}>{platesCredit(c)} · Illustrative artwork, not a venue collection</span>
      </div>
      <div className={styles.pPanel}>
        <div className={styles.crumbs}><a href={nav.href("/#overview")}><ArrowLeft />Explore experiences</a><span>{s.category} · {data.venue.name} · sample records</span></div>
        <div className={styles.pHead}>
          <Lines s={s} className={styles.pTitle} />
          <p className={styles.pLede}>{s.description}</p>
        </div>
        <div className={styles.pStatus}><span><Glyph fill={v.glyph} />{v.status}</span><span>{v.confirmed ? `Booking ${s.bookingRef ?? ""}`.trim() + "." : v.closed ? "Not going ahead." : `Requests close ${when(s.fillBy)}.`}</span></div>
        <dl className={styles.pFacts}>{facts.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>
        <div className={styles.pRows}>
          <div className={styles.pRowsHead}><span>{v.confirmed ? "Bookings" : "Places by date"}</span><span>{v.confirmed ? "" : "One dated session · places from up to two clubs"}</span></div>
          <div className={styles.pRow}>
            <span><strong>{shortDay(s.startsAt)}</strong><br /><span>{timeRange(s)}</span></span>
            <span><Bar bar={v.bar()} /><span><strong>{v.confirmed ? `${v.held} of ${s.capacity} booked` : v.closed ? "Places released" : `${v.held} of ${s.minimum}`}</strong> {v.closed || v.confirmed ? "" : v.more ? `· ${v.more} more needed` : "· minimum reached"}{v.mine ? " · includes your club" : ""}</span></span>
          </div>
          <div className={styles.legend}><span><i style={{ background: "var(--d-ink)" }} />Committed</span><span><i style={{ background: "var(--d-cin)" }} />Your club</span><span><i className={styles.legendMin} />Venue minimum</span><span>{committed} {committed === 1 ? "club" : "clubs"} committed</span></div>
        </div>
        <div className={styles.pActions}>
          <div><a href={primary.href} className={styles.btnBlock}>{primary.label}</a><span>{primary.sub}</span></div>
          <div><a href={`mailto:${data.venue.email}?subject=${encodeURIComponent(s.title)}`} className={styles.btnBlockLine}>Ask the venue a question</a><span>Other dates and access arrangements go directly to {data.venue.name}.</span></div>
        </div>
        <p className={styles.nextBox}><strong>What happens next.</strong> {v.next}</p>
        <a href={nav.href(`/s/${s.id}/clubs`)} className={styles.pairLink}>
          <span className={styles.avatars} aria-hidden="true"><Image src="/art/printer.jpg" alt="" width={42} height={42} unoptimized /><Image src="/art/hare.jpg" alt="" width={42} height={42} unoptimized /></span>
          <span><strong>Who’s sharing this session?</strong><span>{committed} of 2 club places taken · club details stay private</span></span>
          <ArrowRight size={16} />
        </a>
      </div>
    </section>

    <section className={styles.twoCol}>
      <div>
        <h2 className={styles.subTitle}>The session</h2>
        <ol className={styles.plan}>
          {([[clockOf(s.startsAt, -15), s.meetingPoint], [timeRange(s), s.resource], ["Included", s.inclusions], ["Access", data.venue.access], ["Where", data.venue.address]] as [string, string][]).map(([t, d]) => <li key={t}><span>{t}</span><span>{d}</span></li>)}
        </ol>
      </div>
      <div>
        <h2 className={styles.subTitle}>How commitment works</h2>
        <ol className={styles.rules}>{rules.map((r, i) => <li key={r}><span>{["i", "ii", "iii", "iv", "v", "vi", "vii"][i]}</span><span>{r}</span></li>)}</ol>
      </div>
    </section>

    <section className={styles.terms}>
      <div className={styles.termsHead}><h2 className={styles.subTitle}>The venue’s <em style={{ color: c.theme.onLight }}>terms</em></h2><p>{s.venueTerms}</p></div>
      <div className={styles.tiles}>
        {tiles.map(t => <figure key={t.t}><div style={{ background: t.bg }}><span>{t.t}</span></div><figcaption><span>{t.t}</span><span>{t.ref}</span></figcaption></figure>)}
      </div>
      <div className={styles.termsFoot}><a href={nav.href(`/s/${s.id}/clubs`)} className={styles.btnLine}>Who’s sharing this session?</a><span>Sample records · no real booking or payment is made.</span></div>
    </section>
  </div>;
}
function clockOf(iso: string, minutes: number) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(Date.parse(iso) + minutes * 60000));
}

const SPRING = (x: number) => 1 - Math.exp(-6.5 * x) * Math.cos(10 * x);
/** The prototype's convergence: tile halves spring together once, after the page opens. */
function useConverge() {
  const [conv, setConv] = useState(1);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden) return;
    let raf = 0; const t0 = performance.now() + 350;
    const step = (now: number) => { const p = Math.min(1, Math.max(0, (now - t0) / 1700)); setConv(p >= 1 ? 1 : SPRING(p)); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(now => { setConv(0); step(now); });
    return () => cancelAnimationFrame(raf);
  }, []);
  return Math.max(0, Math.min(1.06, conv));
}

export function SessionClubs({ id, nav }: { id: string; nav: ApplicationNavigation }) {
  const { data, account, s } = useSession(id);
  const conv = useConverge();
  if (!s) return <Missing nav={nav} />;
  const c = compositionIn(data, s), v = sessionView(data, s, account), th = c.theme, dark = th.ink === IVORY;
  const plans = livePlans(data, s.id);
  const slots: (WorkspacePlan | undefined)[] = [plans[0], plans[1]];
  const avatars = ["printer", "hare"];
  const tiles = [
    { t: "One date", ref: `${shortDay(s.startsAt)} · ${timeRange(s)}, London`, img: c.layers[0]?.k, pos: c.layers[0]?.pos },
    { t: "One price", ref: `${pounds(s.priceMinor)} per person, all compulsory charges included`, img: c.layers[1]?.k, pos: c.layers[1]?.pos },
    { t: "One minimum", ref: `Runs at ${s.minimum} places across both clubs; capacity ${s.capacity}`, img: null, pos: undefined },
    { t: "One decision", ref: `${data.venue.name} confirms or closes by ${when(s.decisionBy)}`, img: null, pos: undefined },
  ];
  const separate: [string, string, string][] = [
    ["Agreement", "Each club accepts the session terms for its own places.", c.layers[0]?.k ?? "printer"],
    ["Deposit and balance", "Each club pays its own amounts directly to the venue.", "caslon"],
    ["Messages", "Each organiser’s conversation with the venue stays private.", "bewick"],
    ["Members", "Clubs manage their own members. Sila keeps no rosters or health notes.", "hare"],
  ];
  const track = dark ? "oklch(0.97 0.015 85 / .18)" : "oklch(0.22 0.02 50 / .12)";
  return <div className={`${styles.discover} ${styles.clubs}`} style={{ "--b-ground": th.ground, "--b-ink": th.ink, "--b-accent": th.accent, "--b-rule": dark ? "oklch(0.97 0.015 85 / .3)" : "oklch(0.22 0.02 50 / .3)" } as React.CSSProperties}>
    <div className={styles.clubsInner}>
      <div className={styles.crumbs}><a href={nav.href(`/s/${s.id}`)}><ArrowLeft />Back to {s.title}</a><span>Session aggregate · club details stay private</span></div>
      <div className={styles.clubsHead}>
        <div>
          <span className={styles.kickerPlain}>Who’s sharing this session?</span>
          <h1 className={styles.clubsTitle}>
            <span className={styles.line}><span data-reveal="line">Two clubs,</span></span>
            <span className={styles.line}><span data-reveal="line" data-delay="90" className={styles.indent}><em>one</em> shared session.</span></span>
          </h1>
        </div>
        <p>Up to two clubs can share a session. Each organiser agrees exact places with the venue, and each club keeps its own agreement, payments and messages. Other clubs see only the combined count, never your invoice, contacts or members.</p>
      </div>
    </div>

    <section aria-label="The clubs" className={styles.clubCards}>
      {slots.map((p, i) => {
        const own = p && p.organiser === account;
        return <div key={i}>
          <span className={styles.clubAvatar}><Image src={`/art/${avatars[i]}.jpg`} alt="" fill unoptimized sizes="84px" style={{ objectFit: "cover" }} /></span>
          <span className={styles.clubText}>
            <strong>{own ? `Your club · ${p.club}` : p ? `${i ? "Second" : "First"} club` : "Room for a second club"}</strong>
            <span>{own ? `${p.approved ?? 0} places committed conditionally` : p ? "Places committed conditionally · counted in the session total" : v.open ? `Another club can request places until ${when(s.fillBy)}.` : "No second club joined this session."}</span>
            {own ? <span role="img" aria-label={`${p.approved ?? 0} of the ${s.minimum}-place minimum`} className={styles.clubBar} style={{ background: track }}><i style={{ width: `${Math.min(100, ((p.approved ?? 0) / s.minimum) * 100)}%`, background: "currentColor" }} /></span> : null}
            <span className={styles.dimSmall}>{p ? "Its own agreement, deposit and messages with the venue." : "Organiser details are shared only with permission."}</span>
          </span>
        </div>;
      })}
    </section>

    <section aria-labelledby="clubs-shared" className={styles.clubsShared}>
      <h2 id="clubs-shared" className={styles.subTitle}>What the clubs share</h2>
      <p className={styles.dimNote}>One session, one set of terms. {v.closed ? "This session closed and its places were released." : `${v.held} of ${s.minimum} places are committed so far, counted together toward one minimum.`}</p>
      <div className={styles.convTiles}>
        {tiles.map(t => <div key={t.t}>
          <span aria-hidden="true" className={styles.convArt}>
            {[0, 1].map(half => <span key={half} style={{ clipPath: half ? "inset(0 0 0 50%)" : "inset(0 50% 0 0)", translate: `${((half ? 1 : -1) * (1 - conv) * 60).toFixed(1)}px 0`, opacity: (0.4 + 0.6 * Math.min(1, conv)).toFixed(3) }}>
              <span style={{ background: [OX, JADE, INDIGO, OLIVE][tiles.indexOf(t)] }}>
                {t.img ? <Image src={`/art/${t.img}.jpg`} alt="" fill unoptimized sizes="25vw" style={{ objectFit: "cover", objectPosition: t.pos ?? "50% 50%" }} /> : <em>{t.t}</em>}
              </span>
            </span>)}
          </span>
          <span className={styles.convTitle}>{t.t}</span>
          <span className={styles.dimSmall}>{t.ref}</span>
        </div>)}
      </div>
    </section>

    <section className={styles.clubsFoot}>
      <div>
        <span className={styles.kickerPlain}>The session</span>
        <a href={nav.href(`/s/${s.id}`)} className={styles.sessionCard}>
          <span><Image src={`/art/${c.layers[0]?.k ?? s.image}.jpg`} alt="" fill unoptimized sizes="110px" style={{ objectFit: "cover" }} /></span>
          <span><span className={styles.sessionCardTitle}>{s.title}</span><span>{data.venue.name} · {v.status} · {v.count}</span><strong>View experience <ArrowRight size={14} /></strong></span>
        </a>
      </div>
      <div>
        <span className={styles.kickerPlain}>Kept separate for each club</span>
        <span className={styles.dimSmall}>Sila records each club’s booking separately. A venue sees both; another club never does.</span>
        {separate.map(([t, d, img]) => <div key={t} className={styles.sepRow}>
          <span><Image src={`/art/${img}.jpg`} alt="" fill unoptimized sizes="44px" style={{ objectFit: "cover" }} /></span>
          <span><strong>{t}</strong><span>{d}</span></span>
        </div>)}
      </div>
    </section>
  </div>;
}

export function SessionRequest({ id, nav }: { id: string; nav: ApplicationNavigation }) {
  const { data, account, s } = useSession(id);
  const { command } = useWorkspace();
  const person = SAMPLE_ACCOUNTS[account];
  const [places, setPlaces] = useState(9), [club, setClub] = useState(person.organisation), [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null), [done, setDone] = useState<string | null>(null);
  if (!s) return <Missing nav={nav} />;
  const c = compositionIn(data, s), v = sessionView(data, s, account);
  const total = amountsFor(s, { requested: places, approved: null } as WorkspacePlan);
  const validPlaces = Number.isInteger(places) && places >= 1 && places <= s.capacity;
  const canSubmit = agreed && validPlaces && club.trim().length >= 2 && !pending;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!canSubmit || !s) return;
    setPending(true); setError(null);
    try { const r = await command({ type: "request", sessionId: s.id, expectedVersion: s.version, values: { places: String(places), club: club.trim(), source: "Session page" } }); if (r.ok) setDone(r.resultId); else setError(r.error); }
    catch { setError("Your request could not be saved. Check the details and try again."); }
    finally { setPending(false); }
  }
  const plan = done ? data.plans.find(p => p.id === done) : undefined;
  let body: React.ReactNode;
  if (done && plan) body = <div className={styles.done}>
    <div>
      <span className={styles.kickerOx}>Requested · sample records</span>
      <h1 className={styles.doneTitle}>Your request for {plan.requested} places is with the venue.</h1>
      <span>{data.venue.name} reviews your exact places. Nothing is committed or payable yet.</span>
    </div>
    <div className={styles.ticketWrap}>
      <div aria-hidden="true" className={styles.ticketSlot} />
      <div data-print="" className={styles.ticket}>
        <div className={styles.ticketStub}><Image src={`/art/${c.layers[0]?.k ?? s.image}.jpg`} alt="" fill unoptimized sizes="130px" style={{ objectFit: "cover" }} /><span>{plan.ref}</span></div>
        <div className={styles.ticketBody}>
          <span className={styles.ticketMeta}>sila · club request · {plan.ref}</span>
          <span className={styles.ticketTitle}>{s.title}</span>
          <div className={styles.receipt}>{([["Date", `${shortDay(s.startsAt)}, ${timeRange(s)}`], ["Venue", data.venue.name], ["Places", String(plan.requested)], ["Club", plan.club], ["Charged", "Nothing yet"]] as [string, string][]).map(([k, val]) => <span key={k}><span>{k}</span><span>{val}</span></span>)}</div>
          <div data-stamp="" className={styles.stamp} aria-label="Sample records only">Sample records<br /><span>no payment · not confirmed</span></div>
        </div>
      </div>
    </div>
    <div className={styles.nextList}>
      <span className={styles.kickerPlain}>What happens next</span>
      {[`${data.venue.name} reviews and approves your exact places.`, "You then review the conditions and decide whether to commit. Withdrawal is free before payment opens.", `If the session reaches ${s.minimum} places by ${when(s.fillBy)}, payment opens and your club pays its own deposit to the venue. The venue confirms by ${when(s.decisionBy)}.`].map((t, i) => <div key={t}><span>{["i", "ii", "iii"][i]}</span><span>{t}</span></div>)}
    </div>
    <div className={styles.doneActions}>
      <a href={nav.href(`/plans/${plan.id}`)} className={styles.btnInk}>Open your plan</a>
      <a href={nav.href(`/s/${s.id}`)} className={styles.btnLine}>Back to the experience</a>
      <a href={nav.href("/#overview")} className={styles.textBtn}>Explore experiences</a>
    </div>
  </div>;
  else if (person.role !== "organiser") body = <Notice title="Organiser request">Only a club organiser can request or commit places. Your venue workspace handles review and approval. <a href={nav.href("/venue")}>Open venue workspace</a></Notice>;
  else if (v.own) body = <Notice title="Your club already has a plan">{v.own.club} · {planState(data, v.own)}. <a href={nav.href(`/plans/${v.own.id}`)}>Open your plan</a></Notice>;
  else if (!v.open) body = <Notice title={v.closed ? "This session is not going ahead" : "This session is not accepting new requests"}>{s.closedReason ?? "The contributing clubs are already set or the request window has closed. Contact the venue about another dated session."}</Notice>;
  else body = <form onSubmit={submit} aria-label="Request club places" className={styles.reqForm}>
    <h1 className={styles.reqTitle}>Request places for your club</h1>
    {error ? <p role="alert" className={styles.formError}>{error}</p> : null}
    <fieldset>
      <legend>1 · Date</legend>
      <span className={styles.help}>This session has one date. The venue sets it; the minimum applies to that date alone.</span>
      <label className={styles.dateRow}><input type="checkbox" checked readOnly disabled /><span><strong>{shortDay(s.startsAt)}</strong><span className={styles.dim}> · {timeRange(s)}</span></span><span>{v.held} of {s.minimum}{v.more ? ` · ${v.more} more needed` : " · minimum reached"}</span></label>
    </fieldset>
    <fieldset className={styles.reqPair}>
      <legend>2 · Places and club</legend>
      <label className={styles.field}><span>Places requested</span><input type="number" name="places" min={1} max={s.capacity} value={Number.isNaN(places) ? "" : places} onChange={e => setPlaces(e.target.valueAsNumber)} required /><small>Between 1 and {s.capacity}. The venue approves the exact number.</small></label>
      <label className={styles.field}><span>Club name</span><input name="club" value={club} onChange={e => setClub(e.target.value)} maxLength={120} required autoComplete="organization" /><small>Seen by the venue. Other clubs see only the combined count.</small></label>
    </fieldset>
    <fieldset className={styles.reqPair}>
      <legend>3 · Organiser</legend>
      <span className={styles.help}>From the sample account. No member list is needed.</span>
      <label className={styles.field}><span>Name</span><input value={person.name} readOnly /></label>
      <label className={styles.field}><span>Email</span><input value={person.email} readOnly /></label>
    </fieldset>
    <div className={styles.agree}>
      <strong>What you’re agreeing to</strong>
      <ul>{[
        `A request for ${validPlaces ? places : "your"} places at ${pounds(s.priceMinor)} per person${validPlaces ? `: ${money(total.totalMinor)} group total` : ""}.`,
        "Nothing is committed or payable now. The venue reviews and approves your exact places.",
        `After approval you review the conditions and decide whether to commit. A ${s.depositBasisPoints / 100}% deposit${validPlaces ? ` (${money(total.depositMinor)})` : ""} is due only if payment opens.`,
        `The session runs only if it reaches ${s.minimum} places by ${when(s.fillBy)}; the venue makes the final decision by ${when(s.decisionBy)}.`,
      ].map(t => <li key={t}><span aria-hidden="true" /><span>{t}</span></li>)}</ul>
      <label className={styles.check}><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} required /><span>I manage this club enquiry and have reviewed the date and price.</span></label>
    </div>
    <div className={styles.submitRow}>
      <button type="submit" className={styles.btnInk} disabled={!canSubmit}>{pending ? "Saving…" : validPlaces ? `Request ${places} places` : "Request places"}</button>
      <span>{!validPlaces ? `Enter between 1 and ${s.capacity} places` : agreed ? `£0 today · ${money(total.totalMinor)} group total if confirmed` : "Tick the agreement to continue"}</span>
    </div>
    <span className={styles.dimSmall}>Sample records: your request is saved in this browser only. No booking, email or payment is made.</span>
  </form>;
  return <div className={`${styles.discover} ${styles.confirm}`}>
    <div className={styles.crumbs}><a href={nav.href(`/s/${s.id}`)}><ArrowLeft />Back to the experience</a><span className={styles.stepLabel}>{done ? "Recorded · sample records" : "Club request"}</span></div>
    <div className={styles.confirmGrid}>
      <aside className={styles.confirmAside}>
        <div className={styles.asideHead}><span><Image src={`/art/${c.layers[0]?.k ?? s.image}.jpg`} alt="" fill unoptimized sizes="84px" style={{ objectFit: "cover" }} /></span><span>{s.title}</span></div>
        <dl className={styles.pFacts}>{([["Venue", data.venue.name], ["Date", `${shortDay(s.startsAt)} · ${timeRange(s)}`], ["Price", `${pounds(s.priceMinor)} per person`], ["Minimum", `${s.minimum} places · capacity ${s.capacity}`]] as [string, string][]).map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>
        <div className={styles.asideStatus}><Glyph fill={v.glyph} size={12} /><span><strong>{v.status}</strong><span>{v.next}</span></span></div>
      </aside>
      {body}
    </div>
  </div>;
}
function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className={styles.notice}><h1 className={styles.reqTitle}>{title}</h1><p>{children}</p></div>;
}

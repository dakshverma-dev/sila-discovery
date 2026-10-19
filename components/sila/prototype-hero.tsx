import Image from "next/image";
import styles from "./prototype-hero.module.css";

function Arrow({ down = false }: { down?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {down ? <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></> : <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>}
  </svg>;
}

/** Visual reference: Sila prototype launch.zip, v5. Product rules: guide §07, §13, §18, §30. */
export function PrototypeHeader({ homeHref = "#main", experienceHref = "#demo-session", howHref = "#how-it-works", organiserHref = "#for-organisers" }: {
  homeHref?: string; experienceHref?: string; howHref?: string; organiserHref?: string;
}) {
  return <header className={styles.header}>
    <div className={styles.headerInner}>
      <a className={styles.wordmark} href={homeHref} aria-label="sila home">sila</a>
      <nav aria-label="Main" className={styles.nav}>
        <a href={experienceHref}>Experience</a><a href={howHref}>How it works</a><a href={organiserHref}>For organisers</a>
      </nav>
      <span className={styles.demoTag}><span className={styles.demoPrefix}>Product </span>demo</span>
    </div>
  </header>;
}

export function PrototypeHero({ places = 7, paymentOpened = false, depositsVerified = false, confirmed = false, closed = false, refunded = false, productInterface = false,
  experienceHref = "#demo-session", howHref = "#how-it-works", organiserHref = "#for-organisers" }: {
  places?: number; paymentOpened?: boolean; depositsVerified?: boolean; confirmed?: boolean; closed?: boolean; refunded?: boolean; productInterface?: boolean;
  experienceHref?: string; howHref?: string; organiserHref?: string;
}) {
  const stage = confirmed ? 3 : depositsVerified ? 2 : paymentOpened ? 1 : places >= 16 ? 1 : 0;
  const next = closed ? refunded ? "The venue has verified the return of received payments." : "The session is closed. Received payments are due back."
    : confirmed ? "The venue has checked the receipts and diary, and confirmed."
    : paymentOpened ? "Each club pays its own deposit directly to the venue."
    : places >= 16 ? "Minimum reached. Await the staffed payment opening."
    : `${16 - places} more places needed. Nothing is due yet.`;
  return <section className={styles.hero} aria-labelledby="prototype-hero-heading">
    <div className={styles.copy}>
      <p className={styles.gloss}><span lang="ar" dir="rtl">صِلَة</span><span><em>ṣila</em>, from the Arabic: a tie or connection</span></p>
      <h1 id="prototype-hero-heading"><span className={styles.line}><span data-reveal="line">Some doors only open</span></span><span className={styles.line}><em data-reveal="line" data-delay="80">to a group.</em></span></h1>
      <p className={styles.description}>Explore a print room after hours or make a small edition by hand. Sila brings smaller cultural clubs together, gathering enough places to make a venue&apos;s session possible.</p>
      <div className={styles.actions}>
        <a className={styles.primary} href={experienceHref}>Explore the experience <Arrow down /></a>
        <a className={styles.textLink} href={howHref}>How it works</a>
      </div>
      <p className={styles.organiserNote}><strong>A place for your club.</strong> Up to two clubs can share one dated session. Your organiser agrees the places; the venue makes the final decision. <a href={organiserHref}>Run a group of your own?</a></p>
      <p className={styles.disclosure}>{productInterface?"Venue-set sessions · up to two clubs · payments direct to the venue.":"Product preview · fictional Edinburgh venue and clubs. No real booking or payment is made."}</p>
    </div>
    <div className={styles.composition}>
      <div className={styles.art} role="group" aria-label="Printmaking artwork collage">
        <div className={styles.orbit} aria-hidden="true" /><div className={styles.fan} data-unfold="fan" aria-hidden="true" />
        <figure className={styles.printer} data-depth="5" data-art-key="printer"><div className={styles.plateReveal} data-unfold="wipe"><Image src="/art/printer.jpg" alt="Jost Amman's woodcut of a printer, 1568" width={535} height={800} unoptimized priority /></div></figure>
        <figure className={styles.caslon} data-depth="15" data-art-key="caslon"><div className={styles.plateReveal} data-unfold="wipe"><Image src="/art/caslon.jpg" alt="William Caslon's eighteenth-century type specimen" width={400} height={650} unoptimized /></div></figure>
        <figure className={styles.rhino} data-depth="20" data-art-key="rhino"><div className={styles.plateReveal} data-unfold="circle"><Image src="/art/rhino.jpg" alt="Detail of Albrecht Dürer's Rhinoceros woodcut, 1515" width={500} height={500} unoptimized /></div></figure>
      </div>
      <article className={styles.featured} data-reveal="rise" data-delay="240" aria-label={productInterface?"Featured session":"Featured fictional session"}>
        <p className={styles.eyebrow}>{productInterface?"Featured session":"Featured · fictional session"}</p>
        <h2>An evening in the print room</h2>
        <p className={styles.meta}>Edinburgh · 19 November 2026<br />18:00–20:00 London · £35 per person</p>
        <div className={styles.progressBlock}>
          <p><strong>{places} of 16 places {confirmed ? "confirmed" : "conditionally committed"}</strong></p>
          <div className={styles.track} role="img" aria-label={`${places} ${confirmed ? "confirmed" : "conditional"} places; minimum 16, capacity 20`}>
            <span className={styles.clubA} style={{ width: `${Math.min(places, 7) / 20 * 100}%` }} />
            <span className={styles.clubB} style={{ width: `${Math.max(0, places - 7) / 20 * 100}%` }} />
            <span className={styles.minimum} />
          </div>
          <p className={styles.next}>{next}</p>
        </div>
        <ol className={styles.stages} aria-label="Booking stages">
          {["Commitments", "Deposits", "Venue confirmation"].map((label, i) => <li key={label} aria-current={!closed && stage === i ? "step" : undefined} data-complete={!closed && stage > i}>{label}</li>)}
        </ol>
        <p className={styles.rule}>{closed ? "Places are released. Payment and refund history stay available." : confirmed ? "The venue has confirmed. Each club keeps its own agreement and payment history." : "Conditional until the venue verifies deposits, checks its diary and confirms."}</p>
        <div className={styles.pair}>
          <span className={styles.portraits} aria-hidden="true"><Image src="/art/printer.jpg" alt="" width={38} height={38} unoptimized /><Image src="/art/hare.jpg" alt="" width={38} height={38} unoptimized /></span>
          <p>Two clubs, one shared session.<br />Separate agreements and payments.</p>
        </div>
        <a className={styles.view} href={experienceHref}>{productInterface?"View experience":"View demo session"} <Arrow /></a>
      </article>
    </div>
  </section>;
}

const STEPS = [
  { title: "A venue sets the session", body: "One date, a fixed price, a minimum and clear terms. The venue approves each club and its places." },
  { title: "Clubs commit conditionally", body: "Each organiser agrees exact places. Invitations reserve nothing, and no deposit is due yet." },
  { title: "The minimum is reached", body: "Payment opens at a staffed deadline. Each club pays its own deposit directly to the venue." },
  { title: "The venue confirms", body: "The venue verifies receipts and checks its diary. Only then is the booking confirmed." },
];

export function PrototypeHowItWorks() {
  return <section id="how-it-works" className={styles.how} aria-labelledby="prototype-how-heading">
    <div className={styles.howInner}>
      <header><p className={styles.eyebrow}>How it works</p><h2 id="prototype-how-heading">A shared session.<br /><em>A clear decision.</em></h2><p>From a smaller club&apos;s first request to a booking the venue can confidently confirm.</p></header>
      <ol>{STEPS.map((step, i) => <li key={step.title}>
        <span className={styles.stepArc} data-step={i} data-unfold="fan" aria-hidden="true" /><span className={styles.stepNumber}>{["i.", "ii.", "iii.", "iv."][i]}</span>
        <h3>{step.title}</h3><p>{step.body}</p>
      </li>)}</ol>
    </div>
  </section>;
}

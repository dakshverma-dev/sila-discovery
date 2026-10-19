"use client";

import { useState } from "react";
import { PrototypeHeader, PrototypeHero, PrototypeHowItWorks } from "@/components/sila/prototype-hero";
import { advanceTour, initialTour, tourStep, type TourActor, type TourState } from "@/lib/sila/tour";
import "./product-tour.css";

const ACTORS: Record<Exclude<TourActor, "clock">, string> = {
  venue: "Venue workspace", "club-a": "Club A · organiser", "club-b": "Club B · organiser",
};
const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** A customer-facing, fully isolated product tour; no network writes or personal-data form. */
export function ProductTour() {
  const [state, setState] = useState<TourState>(initialTour);
  const [copied, setCopied] = useState(false);
  const step = tourStep(state);
  const refund = state.scenario === "refund" && state.step >= 11;
  const refunded = refund && state.step === 12;
  const confirmed = state.scenario === "booking" && state.step === 13;
  const aCommitted = state.step >= 4;
  const bCommitted = state.step >= 7;
  const count = refund ? 0 : bCommitted ? 16 : aCommitted ? 7 : 0;
  const aVerified = state.step >= 10;
  const bVerified = state.scenario === "booking" && state.step >= 12;
  const opened = state.step >= 8;
  const total = state.scenario === "refund" ? 12 : 13;
  const status = refund && state.actor === "club-b" ? "Not proceeding · no payment received" : refunded ? "Refund verified" : refund ? "Not proceeding · refund due" : confirmed ? "Confirmed by the venue"
    : bVerified ? "Waiting for venue confirmation" : opened ? "Deposits due · not confirmed"
    : bCommitted ? "Payment scheduled · not confirmed" : aCommitted ? "Waiting for more places" : "No places committed";
  const isVenue = state.actor === "venue";
  const clubB = state.actor === "club-b";
  const ownPlaces = clubB ? 9 : 7;
  const ownDeposit = clubB ? 7875 : 6125;
  const ownVerified = clubB ? bVerified : aVerified;
  const active = step.actor === "clock" || step.actor === state.actor;
  const ownName = clubB ? "Leith Arts Club" : "Meadows Book Circle";

  async function copySummary() {
    const text = `Sila product demo — fictional session. Printmaking, 19 November, 18:00–20:00 London. ${status}. ${count} ${confirmed ? "confirmed" : "conditional"} places; minimum 16. Clubs pay the venue directly. No real booking or payment exists.`;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  }

  return <div className="tour-root">
    <PrototypeHeader />
    <main id="main">
      <PrototypeHero places={count} paymentOpened={opened} depositsVerified={bVerified} confirmed={confirmed} closed={refund} refunded={refunded} />
      <PrototypeHowItWorks />
      <div className="tour-main">
      <section id="demo-session" className="tour-entry" aria-labelledby="demo-session-heading">
        <div><p className="tour-eyebrow">An interactive product preview</p><h2 id="demo-session-heading">Take a seat.<br /><em>See how it comes together.</em></h2></div>
        <div><p>Try the venue and organiser views of one £35-per-person workshop. Follow exact places, a 25% deposit and the venue&apos;s final decision.</p><p className="tour-disclosure">Fictional venue and clubs. All actions, dates and payments are simulated. No real booking is made.</p></div>
      </section>

      <section className="tour-controls" aria-label="Choose a demo scenario">
        <div className="tour-scenarios"><button aria-pressed={state.scenario === "booking"} onClick={() => setState(initialTour("booking"))}>A booking goes ahead</button>
          <button aria-pressed={state.scenario === "refund"} onClick={() => setState(initialTour("refund"))}>If it cannot go ahead</button></div>
        <button className="tour-reset" onClick={() => { setState(initialTour(state.scenario)); setCopied(false); }}>Restart tour ↺</button>
      </section>

      <div className="tour-workspace">
        <aside className="tour-guide" aria-label="Guided booking journey">
          <p className="tour-eyebrow">The journey · {state.step + 1} of {total + 1}</p>
          <div className="tour-progress" role="progressbar" aria-label="Demo progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={state.step}><span style={{ width: `${state.step / total * 100}%` }} /></div>
          <div aria-live="polite" aria-atomic="true"><p className="tour-date">{step.date}</p><h2>{step.title}</h2><p>{step.explanation}</p></div>
          {step.actor === "clock" ? <p className="tour-clock-note">Demo time jump: real payment openings and deadlines follow staffed London business dates.</p> : null}
          {active ? <button className="tour-primary" onClick={() => { setState(advanceTour(state)); setCopied(false); }}>{step.action} <span aria-hidden="true">→</span></button>
            : <button className="tour-primary" onClick={() => setState({ ...state, actor: step.actor as TourState["actor"] })}>Continue as {ACTORS[step.actor as TourState["actor"]]} →</button>}
          <p className="tour-hint">Every action stays in this browser. Restart whenever you like.</p>
        </aside>

        <section className="tour-screen" aria-label="Product preview">
          <div className="tour-roles" role="group" aria-label="View as">
            {(Object.entries(ACTORS) as [TourState["actor"], string][]).map(([actor, label]) => <button key={actor} aria-pressed={actor === state.actor} onClick={() => setState({ ...state, actor })}>{label}</button>)}
          </div>
          <div className="tour-screen-body">
            <div className={`tour-status ${confirmed || refunded ? "tour-status-positive" : ""}`}><span aria-hidden="true">●</span> {status}</div>
            <p className="tour-eyebrow">{isVenue ? "Your session overview" : `Your club plan · ${ownName}`}</p>
            <h2>{confirmed ? "Your booking is confirmed" : refund ? isVenue ? refunded ? "Venue refund verified" : "Refund due to Club A" : clubB ? "No payment to return" : refunded ? "Your refund is verified" : "Your deposit is due back" : "An evening in the print room"}</h2>
            <p className="tour-screen-sub">19 November · 18:00–20:00 · Edinburgh</p>

            <div className="tour-seat-summary"><strong>{count}<small> / 16</small></strong><div><b>{confirmed ? "Places confirmed by the venue" : refund ? "No live places" : "Places conditionally committed"}</b><span>{confirmed ? "The venue has completed its checks." : refund ? "All 16 conditional places are released. The original records stay available." : count === 16 ? "Minimum reached. Venue confirmation is still required." : `${16 - count} more needed to run · 20 maximum`}</span></div></div>
            <div className="tour-seats" role="img" aria-label={`${count} of 16 minimum places ${confirmed ? "confirmed" : "conditionally committed"}`}>
              {Array.from({ length: 20 }, (_, i) => <span key={i} className={i < count ? i < 7 ? "tour-seat-a" : "tour-seat-b" : i >= 16 ? "tour-seat-spare" : ""} />)}
            </div>
            <p className="tour-seat-legend"><span><i className="tour-key-a" />Club A · 7 places</span><span><i className="tour-key-b" />Club B · 9 places</span><span>4 spare places remain unsold</span></p>

            {refund ? <div className="tour-money-box"><p>{refunded ? "Verified venue return" : "Full refund due"}</p><strong>{isVenue || state.actor === "club-a" ? "£61.25" : "£0.00"}</strong><span>{state.actor === "club-b" ? "No verified payment was received from this club." : refunded ? "The venue has recorded the return of Club A's deposit." : "The venue returns Club A's deposit. Target: 19 November at 12:00 London."}</span></div>
              : isVenue ? <div className="tour-clubs">
                <div className="tour-club-row"><div><b>Meadows Book Circle</b><span>7 places · £245.00 total · £61.25 deposit</span></div><span>{aVerified ? "Receipt verified" : state.step >= 9 ? "Payment reported" : aCommitted ? "Conditionally committed" : state.step >= 3 ? "Approved · not committed" : state.step >= 2 ? "Request received" : "No request yet"}</span></div>
                <div className="tour-club-row"><div><b>Leith Arts Club</b><span>9 places · £315.00 total · £78.75 deposit</span></div><span>{bVerified ? "Receipt verified" : state.step >= 11 ? "Payment reported" : bCommitted ? "Conditionally committed" : state.step >= 6 ? "Approved · not committed" : state.step >= 5 ? "Request received" : "No request yet"}</span></div>
              </div> : <div className="tour-money-box"><p>{confirmed ? "Your remaining balance" : ownVerified ? "Your deposit verified" : opened ? "Your deposit due to the venue" : "Your deposit if the minimum is reached"}</p>
                <strong>{money(confirmed ? ownPlaces * 3500 - ownDeposit : ownDeposit)}</strong><span>{ownPlaces} places · {money(ownPlaces * 3500)} group total · {confirmed ? "Balance due 13 November at noon London" : opened ? "Pay by 10 November at noon London" : "Nothing is due now. This session is not confirmed."}</span></div>}

            <dl className="tour-deadlines"><div><dt>Fill by</dt><dd>4 November · noon London</dd></div><div><dt>Final decision</dt><dd>12 November · noon London</dd></div><div><dt>{confirmed ? "Booking reference" : opened ? "Venue verifies by" : "Before payment opens"}</dt><dd>{confirmed ? "DEMO-SL1042" : opened ? "11 November · noon London" : "Withdrawal without charge"}</dd></div></dl>
            <p className="tour-permission">{isVenue ? "Only the venue approves clubs and confirms the booking. Check your external diary before confirmation." : "You manage this club booking. Other clubs cannot see your invoice, contact or messages. Personal access arrangements go directly to the venue."}</p>
            {confirmed ? <div className="tour-practical"><h3>Your practical details</h3><p>Meet at the fictional studio&apos;s front desk at 17:45. Materials are included. This is an example, not an address or event to attend.</p><button onClick={copySummary}>Copy demo booking summary</button>{copied ? <span role="status">Copied</span> : null}</div> : null}
          </div>
        </section>
      </div>
      <section id="for-organisers" className="tour-value" aria-label="What stays in your hands"><div><p className="tour-eyebrow">For organisers and venues</p><h2>Your club.<br />A shared possibility.</h2><p>An organiser agrees exact places for their club and sees what is conditional, what is owed and what happens next. The venue sets the offer, approves the clubs and receives payments directly.</p></div><div><h3>Built for a considered pilot</h3><p>This tour demonstrates the intended Sila workflow using fictional data. Live bookings require approved venue terms, privacy arrangements, resource holds and staffed coverage. No venue partnership is implied.</p><p className="tour-credit">Artwork: Jost Amman, <i>The Printer</i>, 1568; William Caslon, type specimen, c. 1734; Albrecht Dürer, <i>The Rhinoceros</i>, 1515 (The Met, CC0), and <i>Young Hare</i>, 1502. Other plates public domain. Not a venue collection.</p></div></section>
      </div>
    </main>
    <footer className="tour-footer"><span className="tour-logo">sila</span><span>Making cultural sessions possible, together.</span><span>Product demo · no real bookings or payments</span></footer>
  </div>;
}

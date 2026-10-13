"use client";
/* eslint-disable @next/next/no-img-element -- plates are pre-sized in public/art */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { capFirst, DEMO_STATUS, fdDay, type DemoExp } from "@/lib/ui/sila/showcase";
import { ArrowLeft, Glyph } from "./chrome";
import { InterestToggle, Marks, useInterest } from "./interest";

/*
 * Demo showcase state, as in sila v2: a preferred date and a demonstration
 * commitment, kept only in this browser. Nothing is sent to the server.
 */

const EVT = "sila-demo";

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function useStored<T>(key: string): [T | null, (v: T | null) => void] {
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null);
  const value = useMemo(() => {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [raw]);
  const set = useCallback(
    (v: T | null) => {
      try {
        if (v === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
      window.dispatchEvent(new Event(EVT));
    },
    [key],
  );
  return [value, set];
}

interface Commit {
  places: number;
  date: number;
  with: number;
  email: string;
}

const useCommit = (id: string) => useStored<Commit>(`sila:demo-commit:${id}`);
const useDate = (id: string) => useStored<number>(`sila:demo-date:${id}`);
const demoId = (e: DemoExp) => `demo:${e.id}`;

/** The live half of a showcase proposal panel: count, marks, preferred date and actions (v2). */
export function ShowcaseLive({ e }: { e: DemoExp }) {
  const [me] = useCommit(e.id);
  const [dSel, setDate] = useDate(e.id);
  const [interested] = useInterest(demoId(e));
  const confirmed = e.status === "confirmed";
  const myPlaces = me?.places ?? 0;
  const committed = e.committed + myPlaces;
  const remaining = Math.max(0, e.needed - committed);
  const sel = dSel ?? me?.date ?? 0;
  const datesLabel = confirmed ? "Date" : "Choose a preferred date";
  const myInt = interested && !me;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="head-num">
          <span>{confirmed ? String(e.capacity - committed) : `${committed}/${e.needed}`}</span>
          <span>
            {confirmed
              ? `places left. Confirmed by ${e.venueShort}.`
              : remaining > 0
                ? `committed. ${remaining} more and the request goes to ${e.venueShort}.`
                : `committed. Minimum reached; ${e.venueShort} is reviewing.`}
          </span>
        </div>
        <Marks id={demoId(e)} capacity={e.capacity} required={e.needed} others={e.committed} mine={myPlaces} interested={e.interested} />
        <div className="marks-key">
          <span><i style={{ background: "var(--ink)" }} />Committed</span>
          <span><i style={{ border: "1.5px solid var(--ink)" }} />Interested (not counted)</span>
          <span><i style={{ border: "1.5px dotted oklch(0.22 0.02 50 / .5)" }} />Open</span>
          <span><i style={{ background: "var(--cin)" }} />You</span>
          <span><i style={{ width: 2, height: 15, background: "var(--ox)" }} />Venue minimum</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="kicker op7">{datesLabel}</span>
        <div role="radiogroup" aria-label={datesLabel} className="dates">
          {e.dates.map(([iso, t, n], i) => (
            <button key={iso} type="button" role="radio" aria-checked={sel === i} className="date-opt" onClick={() => setDate(i)}>
              <span>{fdDay(iso)}</span>
              <span>
                {t} · {n} {confirmed ? "booked" : "prefer"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-actions">
        <div className="row">
          <Link href={`/showcase/${e.id}/confirm`} className="btn-ink lg">
            {me ? `You hold ${me.places > 1 ? `${me.places} places` : "a place"} · view` : confirmed ? `Book a place · £${e.price}` : `Commit a place · £${e.price}`}
          </Link>
          {!me && !confirmed && <InterestToggle id={demoId(e)} variant="proposal" />}
        </div>
        <span className="note">
          {me
            ? "Your commitment is the red mark above."
            : confirmed
              ? `£${e.price} is charged when you book. Free cancellation until 48 hours before. (Demonstration: nothing is charged.)`
              : `Interest is free and holds nothing. A commitment holds a place; £${e.price} is charged only if the venue confirms. (Demonstration: nothing is charged.)`}
          {myInt ? " Your interest is the red outline above." : ""}
        </span>
      </div>
    </>
  );
}

/** v2's confirm screen for a showcase experience: a demonstration form, then the printed ticket. */
export function ShowcaseConfirm({ e, src }: { e: DemoExp; src: string }) {
  const router = useRouter();
  const [me, setCommit] = useCommit(e.id);
  const [dSel, setDate] = useDate(e.id);
  const [form, setForm] = useState({ places: 1, with: 0, name: "Maya Okafor", email: "maya.okafor@example.org", agree: false });
  const confirmed = e.status === "confirmed";
  const myPlaces = me?.places ?? 0;
  const committed = e.committed + myPlaces;
  const cDate = dSel ?? me?.date ?? 0;
  const placesN = me ? me.places : form.places;
  const first = e.committed + 1;
  const canSubmit = form.name.trim().length > 1 && /.+@.+\..+/.test(form.email) && form.agree;
  const withNames = [e.A.name, e.B.name, "Neither"];
  const [dIso, dTime] = e.dates[Math.min(cDate, e.dates.length - 1)]!;
  const when = `${fdDay(dIso)}, ${dTime}`;
  const S = DEMO_STATUS[e.status];

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!canSubmit) return;
    setCommit({ places: form.places, date: cDate, with: form.with, email: form.email });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const statusNote = confirmed
    ? `Confirmed by ${e.venueShort}. Booking would charge £${e.price} per place.`
    : e.status === "awaiting"
      ? `The minimum is reached and the request is with ${e.venueShort}. A commitment holds a place; nothing is charged unless it confirms.`
      : `${committed} of ${e.needed} committed. At ${e.needed}, the request goes to ${e.venueShort}. Nothing is charged unless it confirms.`;

  return (
    <div className="cf">
      <div className="cf-top">
        <Link href={`/showcase/${e.id}`}>
          <ArrowLeft />
          Back to the proposal
        </Link>
        <span>{me ? "Recorded (demonstration)" : confirmed ? "Booking" : "Commitment"}</span>
      </div>
      <div className="cf-grid">
        <aside className="cf-aside" aria-label="Proposal summary">
          <div className="cf-id">
            <span className="pic">
              <img src={src} alt="" />
            </span>
            <span className="ttl">{e.title}</span>
          </div>
          <dl className="facts">
            <dt>Venue</dt>
            <dd>{e.venue}</dd>
            <dt>Date</dt>
            <dd>{when}</dd>
            <dt>Per place</dt>
            <dd>£{e.price}</dd>
            <dt>Commitments</dt>
            <dd>
              {committed} of {e.needed} minimum
            </dd>
          </dl>
          <div className="status-box">
            <Glyph bg={S.glyph} />
            <span>
              <strong>{S.short}</strong>
              <span>{statusNote}</span>
            </span>
          </div>
        </aside>

        {me ? (
          <div className="done">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="done-kicker">{confirmed ? "Booked · demonstration" : "Commitment recorded · demonstration"}</span>
              <h1>
                {placesN > 1 ? `Places ${first}–${first + placesN - 1}` : `Place ${first}`} of {confirmed ? e.capacity : e.needed} is yours.
              </h1>
            </div>
            <div className="ticket-wrap">
              <div aria-hidden="true" className="ticket-bar" />
              <div className="ticket" data-print="">
                <div className="ticket-stub">
                  <img src={src} alt="" />
                  <span>
                    {e.ref.replace("Nº ", "")}-{String(first).padStart(3, "0")}
                  </span>
                </div>
                <div className="ticket-body">
                  <span>
                    sila · admit {["one", "two", "three"][placesN - 1]} · {e.ref}
                  </span>
                  <span className="ttl">{e.title}</span>
                  <div className="receipt">
                    <span>Date</span>
                    <span>{when}</span>
                    <span>Venue</span>
                    <span>{e.venue}</span>
                    <span>Places</span>
                    <span>{placesN}</span>
                    <span>With</span>
                    <span>{withNames[me.with]}</span>
                    <span>Charged</span>
                    <span>{confirmed ? `£${e.price * placesN} (demo)` : `Nothing. £${e.price * placesN} only if confirmed`}</span>
                  </div>
                  <div className="stamp" data-stamp="" aria-label="Demonstration only">
                    Demonstration
                    <br />
                    <span>no payment · no reservation</span>
                  </div>
                </div>
              </div>
            </div>
            <Marks id={demoId(e)} small capacity={e.capacity} required={e.needed} others={e.committed} mine={myPlaces} interested={e.interested} />
            <div className="next">
              <span>What happens next</span>
              {(confirmed
                ? [
                    `In the real service, a confirmation and access notes would go to ${me.email}.`,
                    "Organisers from both communities can see who is coming from each group.",
                    "Cancel free of charge until 48 hours before.",
                  ]
                : [
                    e.status === "awaiting"
                      ? `${capFirst(e.venueShort)} reviews the request; ${e.subs[2].toLowerCase()}.`
                      : `At ${e.needed} commitments, sila sends the request to ${e.venueShort}. ${Math.max(0, e.needed - committed)} to go.`,
                    `If the venue confirms, you’d be emailed and £${e.price * placesN} charged then.`,
                    "If it doesn’t, the commitment lapses and nothing is charged.",
                  ]
              ).map((t, i) => (
                <div key={t}>
                  <span className="next-n">{["i", "ii", "iii"][i]}</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <div className="done-actions">
              <Link href={`/showcase/${e.id}`} className="btn-ink">
                Return to the proposal
              </Link>
              <Link href="/#index" className="btn-line">
                All experiences
              </Link>
              <button
                type="button"
                className="link-under"
                style={{ fontSize: 13 }}
                onClick={() => {
                  setCommit(null);
                  router.push(`/showcase/${e.id}`);
                }}
              >
                Withdraw my commitment
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="cf-form">
            <h1 className="cf-h1">{confirmed ? "Book your place" : "Commit to a place"}</h1>
            <fieldset>
              <legend>1 · Date</legend>
              {e.dates.map(([iso, t], i) => (
                <label key={iso} className="radio cf-date">
                  <span>
                    <span className="box">
                      <input type="radio" name="cdate" checked={cDate === i} onChange={() => setDate(i)} />
                      <span className="dot" />
                    </span>
                    <strong>{fdDay(iso)}</strong>
                  </span>
                  <span>{t}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="wrap-row">
              <legend>2 · Places and community</legend>
              <div className="field">
                <span className="field-label">Places</span>
                <div className="seg">
                  {[1, 2, 3].map((k) => (
                    <label key={k} className="seg-opt">
                      <input type="radio" name="places" checked={form.places === k} onChange={() => setForm((f) => ({ ...f, places: k }))} />
                      {k === 1 ? "1 place" : `${k} places`}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="field-label">Coming with</span>
                <div className="seg">
                  {[e.A.short, e.B.short, "Neither"].map((lab, i) => (
                    <label key={lab} className="seg-opt">
                      <input type="radio" name="with" checked={form.with === i} onChange={() => setForm((f) => ({ ...f, with: i }))} />
                      {capFirst(lab)}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>
            <fieldset className="wrap-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "14px 22px" }}>
              <legend>3 · Your details</legend>
              <div className="field">
                <label htmlFor="cf-name">Name</label>
                <input id="cf-name" className="input" value={form.name} onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))} autoComplete="name" style={{ fontSize: 15, minHeight: 42 }} />
              </div>
              <div className="field">
                <label htmlFor="cf-email">Email</label>
                <input id="cf-email" className="input" type="email" value={form.email} onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))} autoComplete="email" style={{ fontSize: 15, minHeight: 42 }} />
              </div>
            </fieldset>
            <label className="radio agree">
              <span className="box">
                <input type="checkbox" checked={form.agree} onChange={() => setForm((f) => ({ ...f, agree: !f.agree }))} />
                <span className="dot" />
              </span>
              <span>
                {confirmed
                  ? `I understand £${e.price * form.places} would be charged now, with free cancellation until 48 hours before.`
                  : `I understand this holds ${form.places > 1 ? `${form.places} places` : "a place"}, and £${e.price * form.places} is charged only if the venue confirms. Otherwise the commitment lapses.`}
              </span>
            </label>
            <div className="submit-row">
              <button type="submit" disabled={!canSubmit} className="btn-ink lg" style={{ opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? "pointer" : "not-allowed" }}>
                {confirmed ? `Book · £${e.price * form.places}` : `Commit ${form.places > 1 ? `${form.places} places` : "my place"}`}
              </button>
              <span>
                {canSubmit
                  ? confirmed
                    ? `£${e.price * form.places} today`
                    : `£0 today · £${e.price * form.places} if confirmed`
                  : "Complete your details and tick the box to continue"}
              </span>
            </div>
            <span className="note">Demonstration: submitting records nothing outside this page and takes no payment.</span>
          </form>
        )}
      </div>
    </div>
  );
}


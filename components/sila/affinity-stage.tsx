"use client";
/* eslint-disable @next/next/no-img-element -- plates are pre-sized in public/art */

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight } from "./chrome";

export interface AffinityGroup {
  name: string;
  short: string;
  src: string;
  credit: string;
  members: number;
  place: string;
  only: string[];
}

export interface AffinityTile {
  t: string;
  a: number;
  b: number;
  ref: string;
  src: string | null;
  pos: string;
  bg: string;
}

const SPRING = (x: number) => 1 - Math.exp(-6.5 * x) * Math.cos(10 * x);
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** v2's affinity reading: two halves of each shared interest converge; the slider pulls them apart. */
export function AffinityStage({
  A,
  B,
  tiles,
  accent,
  expTitle,
  expSrc,
  expMeta,
  proposalHref,
  compat,
}: {
  A: AffinityGroup;
  B: AffinityGroup;
  tiles: AffinityTile[];
  accent: string;
  expTitle: string;
  expSrc: string;
  expMeta: string;
  proposalHref: string;
  compat: Array<{ name: string; strength: string; why: string; src: string }>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1000);
  const [wide, setWide] = useState(true);
  const [conv, setConv] = useState(1);
  const [sel, setSel] = useState(0);
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const raf = useRef(0);

  useIso(() => {
    const measure = () => {
      setWide(window.innerWidth >= 900);
      if (stageRef.current) setW(stageRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Intro: the halves spring together (skipped with reduced motion).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Before t0 the spring sits at 0, so the halves start apart on the first frame.
    const t0 = performance.now() + 450;
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / 1700));
      setConv(p >= 1 ? 1 : Math.min(1.04, SPRING(p)));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const n = tiles.length;
  const c = Math.max(0, Math.min(1.06, conv));
  const stageH = wide ? "clamp(440px,58vh,600px)" : `${n * 250}px`;
  const s = tiles[Math.min(sel, n - 1)]!;

  return (
    <>
      <section aria-label="Shared interests" className="wrap" style={{ paddingTop: "clamp(28px,4vw,56px)" }}>
        <div ref={stageRef} className="stage" style={{ height: stageH }}>
          {wide && (
            <>
              <div className="stage-side" style={{ left: 0 }}>
                <div className="pic">
                  <img src={A.src} alt={A.credit} />
                </div>
                <span>
                  {A.name}
                  <br />
                  <span>
                    {A.members} members · {A.place}
                  </span>
                </span>
              </div>
              <div className="stage-side" style={{ right: 0, textAlign: "right" }}>
                <div className="pic">
                  <img src={B.src} alt={B.credit} />
                </div>
                <span>
                  {B.name}
                  <br />
                  <span>
                    {B.members} members · {B.place}
                  </span>
                </span>
              </div>
              <div className="stage-only" style={{ left: "17%", opacity: 0.55 + 0.45 * (1 - Math.min(1, c)) }}>
                {A.only.map((o) => (
                  <span key={o}>{o}</span>
                ))}
              </div>
              <div className="stage-only" style={{ right: "17%", textAlign: "right", opacity: 0.55 + 0.45 * (1 - Math.min(1, c)) }}>
                {B.only.map((o) => (
                  <span key={o}>{o}</span>
                ))}
              </div>
            </>
          )}
          <div aria-hidden="true" className="seam" style={{ opacity: Math.max(0, 1 - c) }} />
          {tiles.map((tl, i) => {
            let x: number, y: number, w: number, cx: number;
            if (wide) {
              w = n > 3 ? 13 : 15;
              const gap = 2.5;
              const tot = n * w + (n - 1) * gap;
              x = 50 - tot / 2 + i * (w + gap);
              y = 12 + (i % 2) * 8;
              cx = ((x + w / 2) / 100) * W;
            } else {
              w = 56;
              x = 22;
              y = i * (100 / n) + 2;
              cx = W / 2;
            }
            const spreadL = wide ? cx - 0.1 * W : W * 0.32;
            const spreadR = wide ? 0.9 * W - cx : W * 0.32;
            const on = i === sel;
            const halfOp = (0.55 + 0.45 * Math.min(1, c)).toFixed(3);
            const half = (clip: string, tx: number) => (
              <span className="tile-half" style={{ clipPath: clip, translate: `${tx.toFixed(1)}px 0`, opacity: halfOp }}>
                <span style={{ background: tl.bg }}>
                  {tl.src ? <img src={tl.src} alt="" style={{ objectPosition: tl.pos }} /> : <span className="word">{tl.t}</span>}
                </span>
              </span>
            );
            return (
              <button
                key={tl.t}
                type="button"
                className="tile"
                onClick={() => setSel(i)}
                aria-pressed={on}
                aria-label={`${tl.t}: ${A.name} ${tl.a}%, ${B.name} ${tl.b}%`}
                style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, zIndex: on ? 5 : 2 }}
              >
                <span className="tile-art" style={{ outline: on ? `2px solid ${accent}` : "0 solid transparent" }}>
                  {half("inset(0 50% 0 0)", -(1 - c) * spreadL)}
                  {half("inset(0 0 0 50%)", (1 - c) * spreadR)}
                </span>
                <span className="tile-label" style={{ opacity: Math.max(0, (c - 0.6) / 0.4) }}>
                  <span style={{ fontStyle: on ? "italic" : "normal" }}>{tl.t}</span>
                  <span>
                    {tl.a}% · {tl.b}%
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="conv">
          <label htmlFor="conv">Apart</label>
          <input
            id="conv"
            type="range"
            min={0}
            max={100}
            value={Math.round(Math.min(1, c) * 100)}
            onChange={(e) => {
              cancelAnimationFrame(raf.current);
              setConv(Number(e.target.value) / 100);
            }}
            aria-describedby="conv-note"
            aria-label="Apart or together"
          />
          <span style={{ fontWeight: 600 }} aria-hidden="true">
            Together
          </span>
          <span id="conv-note" className="full">
            Moving the halves changes only the arrangement. The figures stay the same.
          </span>
        </div>
      </section>

      <section className="wrap two-col af-cols">
        <div className="af-col">
          <span className="kicker op75">
            Selected · {String(Math.min(sel, n - 1) + 1).padStart(2, "0")} of {String(n).padStart(2, "0")}
          </span>
          <span className="big">{s.t}</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.5, opacity: 0.85 }}>{s.ref}</span>
          <div className="af-bars">
            <span>{A.name}</span>
            <span className="pc">{s.a}%</span>
            <span className="trk">
              <span style={{ width: `${s.a}%`, background: "currentColor" }} />
            </span>
            <span>{B.name}</span>
            <span className="pc">{s.b}%</span>
            <span className="trk">
              <span style={{ width: `${s.b}%`, background: accent }} />
            </span>
          </div>
          <span style={{ fontSize: 11.5, lineHeight: 1.5, opacity: 0.7 }}>
            Share of active members whose saved works, visits and follows include this interest. When Qloo is connected,
            each figure will link to the signals behind it. These are demonstration figures.
          </span>
        </div>
        <div className="af-col" style={{ gap: 16 }}>
          <span className="kicker op75">What the overlap suggests</span>
          <Link href={proposalHref} className="suggest">
            <span className="pic">
              <img src={expSrc} alt="" />
            </span>
            <span className="txt">
              <span className="ttl">{expTitle}</span>
              <span style={{ fontSize: 12.5, opacity: 0.8 }}>{expMeta}</span>
              <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                Open the proposal
                <ArrowRight />
              </span>
            </span>
          </Link>
          <span className="kicker op75" style={{ marginTop: 10 }}>
            Also compatible · illustrative
          </span>
          {compat.map((cp) => {
            const on = !!invited[cp.name];
            return (
              <div key={cp.name} className="compat">
                <span className="av">
                  <img src={cp.src} alt="" />
                </span>
                <span className="who">
                  <span>
                    {cp.name} <span style={{ fontWeight: 400, opacity: 0.75 }}>· {cp.strength}</span>
                  </span>
                  <span>{cp.why}</span>
                </span>
                <button type="button" aria-pressed={on} onClick={() => setInvited((x) => ({ ...x, [cp.name]: !x[cp.name] }))}>
                  {on ? "Invited ✓" : "Invite"}
                </button>
              </div>
            );
          })}
          <span className="fine" style={{ margin: 0 }}>
            Inviting is a preview: nothing is sent, and these groups are not in the sandbox.
          </span>
        </div>
      </section>
    </>
  );
}

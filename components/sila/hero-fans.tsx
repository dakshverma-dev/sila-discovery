"use client";
/* eslint-disable @next/next/no-img-element -- decorative plates are pre-sized in public/art */

import Link from "next/link";
import { useState } from "react";
import { HERO_FANS, img, type ArtKey } from "@/lib/ui/sila/art";
import { DEMO_STATUS, demoById } from "@/lib/ui/sila/showcase";

/** Which demo experience each hero plate opens (v2 HERO_FANS). */
const OPENS: Partial<Record<ArtKey, string>> = {
  redfuji: "hokusai", wave: "hokusai", hamza: "hamza", actiniae: "haeckel", borgia: "codex",
  kentedetail: "kente", strawberry: "kente", wayang: "wayang", printer: "print-room",
};

/** The hero's grid of half-moon plates; hovering one lifts it and nudges its neighbours (v2). */
export function HeroFans() {
  const [hover, setHover] = useState(-1);
  const h = hover >= 0 ? HERO_FANS[hover]! : null;
  const hovExp = h && h[2] !== "fill" ? demoById(OPENS[h[2] as ArtKey] ?? "") : null;

  return (
    <div className="fans">
      <div aria-hidden="true" className="fans-deco" style={{ left: "8%", top: "-4%", width: "84%", aspectRatio: "1 / 1", borderRadius: "50%", border: "1px solid oklch(0.58 0.17 35 / .5)" }} />
      <div aria-hidden="true" className="fans-deco" style={{ left: "20%", top: "8%", width: "60%", aspectRatio: "1 / 1", border: "1px solid oklch(0.22 0.02 50 / .22)", rotate: "45deg" }} />
      <div aria-hidden="true" className="fans-deco" style={{ left: "50%", top: "-6%", bottom: "-2%", width: 1, background: "oklch(0.22 0.02 50 / .25)" }} />
      {HERO_FANS.map(([x, y, k, fill, extra], i) => {
        let off = "0 0";
        if (h) {
          if (i === hover) off = "0 -14px";
          else if (Math.abs(h[1] - y) <= 16 && Math.abs(h[0] - x) <= 32)
            off = `${Math.sign(x - h[0]) * 14 || 0}px ${y > h[1] ? 10 : y < h[1] ? -6 : 0}px`;
        }
        const isFill = k === "fill";
        return (
          <div key={i} className="fan" style={{ left: `${x}%`, top: `${y}%`, zIndex: Math.round(y) + (hover === i ? 50 : 0) }}>
            {isFill ? (
              <div aria-hidden="true" data-unfold="fan" data-text={extra ?? ""} className="fan-shape fan-fill" style={{ background: fill!, translate: off }} />
            ) : (
              <Link
                href={`/showcase/${OPENS[k as ArtKey]}`}
                aria-label={`Open ${demoById(OPENS[k as ArtKey] ?? "")?.title ?? "experience"} (demo)`}
                data-unfold="fan"
                className="fan-shape"
                style={{ background: "oklch(0.22 0.02 50 / .1)", translate: off }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(-1)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(-1)}
              >
                <img src={img(k as ArtKey)} alt="" style={{ objectPosition: extra ?? "50% 50%" }} />
              </Link>
            )}
          </div>
        );
      })}
      <div aria-live="polite" className="fan-label">
        <span className="serif">{hovExp?.title ?? ""}</span>
        <span className="op7">{hovExp ? `${hovExp.city} · ${DEMO_STATUS[hovExp.status].short}` : ""}</span>
      </div>
    </div>
  );
}

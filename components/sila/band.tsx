import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { IVORY, platesLine, type Look } from "@/lib/ui/sila/art";
import { titleLines } from "@/lib/ui/sila/view";
import { ArtLayers } from "./art-layers";
import { ArrowRight, Glyph, RevealLines } from "./chrome";
import { InterestToggle } from "./interest";

export function themeVars(look: Look): CSSProperties {
  const dark = look.theme.ink === IVORY;
  return {
    "--ground": look.theme.ground,
    "--ink-c": look.theme.ink,
    "--accent": look.theme.accent,
    "--accent-on-light": look.theme.onLight,
    "--rule": dark ? "oklch(0.97 0.015 85 / .3)" : "oklch(0.22 0.02 50 / .3)",
    "--track": dark ? "oklch(0.97 0.015 85 / .18)" : "oklch(0.22 0.02 50 / .14)",
  } as CSSProperties;
}

/** One programme on the discovery index (v2 "bands"). */
export function Band({
  no,
  look,
  title,
  href,
  linkLabel = "Open the proposal",
  place,
  description,
  format,
  glyph,
  statusLabel,
  capacity,
  required,
  reserved,
  mine,
  demandText,
  possible,
  pair,
  interestId,
  regionLabel,
  lines,
  demo = false,
  children,
}: {
  no: number;
  look: Look;
  title: string;
  href: string;
  linkLabel?: string;
  place: string;
  description: string;
  format: string;
  glyph: string;
  statusLabel: string;
  capacity: number;
  required: number;
  reserved: number;
  mine: boolean;
  demandText: string;
  possible: string;
  pair: string;
  interestId?: string;
  regionLabel?: string;
  /** Explicit display lines (showcase experiences carry v2's own line breaks). */
  lines?: Array<{ t: string; italic: boolean }>;
  /** Marks a demo-showcase experience. */
  demo?: boolean;
  children?: ReactNode;
}) {
  const t0 = titleLines(title);
  const t = lines ? { ...t0, lines } : t0;
  const pct = (n: number) => `${Math.min(100, (n / Math.max(1, capacity)) * 100).toFixed(2)}%`;
  const others = reserved - (mine ? 1 : 0);
  const cls = `band${look.layout === "bleed" ? " bleed" : look.layout === "art-right" ? " right" : ""}`;
  return (
    <article aria-label={regionLabel ?? t.plain} className={cls} style={themeVars(look)}>
      <div className="band-grid">
        <div className="band-art">
          <ArtLayers look={look} mode="d" />
        </div>
        <div className="band-txt">
          <div className="band-no">
            <span>{String(no).padStart(2, "0")}</span>
            <span>
              {look.cat}
              <br />
              <span className="op7">{place}</span>
            </span>
          </div>
          <h2 className={`band-title${t.lines.length > 2 ? " long" : ""}`}>
            <Link href={href}>
              <RevealLines lines={t.lines} />
            </Link>
          </h2>
          {t.illustrative && <span className="tag-illus">Illustrative programme</span>}
          {demo && <span className="tag-illus">Demo data</span>}
          <p className="dek">{description}</p>
          <p className="format">{format}</p>
          <div className="demand">
            <div className="status-line">
              <Glyph bg={glyph} />
              {statusLabel}
            </div>
            <div role="img" aria-label={`${reserved} of ${required} minimum reservations, capacity ${capacity}`} className="bar">
              <span className="fill" style={{ width: pct(others) }} />
              <span className="me" style={{ left: pct(others), width: pct(mine ? 1 : 0) }} />
              <span className="min" style={{ left: pct(required) }} />
              <span className="min-label" style={{ left: pct(required) }}>
                min. {required}
              </span>
            </div>
            <span className="demand-text">
              <strong>{demandText}</strong> {possible}
            </span>
            <span className="pair">{pair}</span>
          </div>
          <div className="band-actions">
            <Link href={href} className="btn-ink">
              {linkLabel}
              <ArrowRight />
            </Link>
            {interestId && <InterestToggle id={interestId} variant="band" />}
          </div>
          {children}
          <span className="plates">{platesLine(look.layers.map((l) => l.k))}</span>
        </div>
      </div>
    </article>
  );
}

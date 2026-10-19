import Image from "next/image";
import { ART, plateSrc, type Layer } from "./compositions";
import styles from "./discover.module.css";

const RATIO = { fan: "2 / 1", qfan: "1 / 1", circle: "1 / 1" } as const;
const RADIUS = { fan: "999px 999px 0 0", qfan: "100% 0 0 0", circle: "50%" } as const;
export const artKey = (sessionId: string, l: Layer) => `${sessionId}-${l.id ?? l.k}`;
export const thumbRadius = (l: Layer) => (l.shape === "circle" ? "50%" : l.shape === "fan" ? "999px 999px 0 0" : "0");

/**
 * The prototype's layered plates. mode "d" drifts with scroll (data-speed);
 * "p" and "h" follow the pointer by depth (data-depth). Every plate unfolds
 * with its own mask, and data-art-key lets the same plate carry across screens.
 */
export function Plates({ sessionId, layers, mode, priority = false }: { sessionId: string; layers: Layer[]; mode: "d" | "p" | "h"; priority?: boolean }) {
  return <>{layers.map(l => {
    const box = (mode === "h" ? l.h : undefined) ?? (mode === "d" ? l.d : l.p);
    const shape = l.shape as keyof typeof RATIO;
    const motion = mode === "d" ? { "data-speed": l.speed ?? 0 } : { "data-depth": String(Math.round((l.z ?? 1) * 5)) };
    return <div key={l.id ?? l.k} data-art-key={artKey(sessionId, l)} className={styles.layer}
      style={{ left: `${box[0]}%`, top: `${box[1]}%`, width: `${box[2]}%`, height: box[3] == null ? "auto" : `${box[3]}%`, aspectRatio: RATIO[shape] ?? "auto", zIndex: l.z ?? 1, rotate: l.rot ?? "0deg" }}>
      <div className={styles.layerMotion} {...motion}>
        <div className={styles.layerMask} data-unfold={l.unfold ?? "wipe"}
          style={{ borderRadius: RADIUS[shape] ?? "0", background: l.bg ?? "transparent", boxShadow: l.shadow ? "0 24px 40px -22px oklch(0.15 0.02 50 / .65)" : "none" }}>
          <Image src={plateSrc(l.k)} alt={ART[l.k]?.[0] ?? ""} fill unoptimized priority={priority} sizes="(min-width: 920px) 50vw, 100vw"
            style={{ objectFit: "cover", objectPosition: l.pos ?? "50% 50%", scale: l.zoom ?? 1, mixBlendMode: (l.blend ?? "normal") as React.CSSProperties["mixBlendMode"] }} />
        </div>
        {l.ring ? <div aria-hidden="true" className={styles.ring} /> : null}
      </div>
      {l.cap && mode === "d" ? <span className={styles.cap}>{l.cap}</span> : null}
    </div>;
  })}</>;
}

export function Glyph({ fill, size = 11 }: { fill: string; size?: number }) {
  return <span aria-hidden="true" className={styles.glyph} style={{ width: size, height: size, background: fill }} />;
}

export function Bar({ bar, height = 8, inherit = false, max }: { bar: { oPct: string; mPct: string; minPct: string; track: string; minColor: string; aria: string }; height?: number; inherit?: boolean; max?: number }) {
  return <span role="img" aria-label={bar.aria} className={styles.bar} style={{ height, background: bar.track, maxWidth: max }}>
    <span style={{ left: 0, width: bar.oPct, background: inherit ? "currentColor" : "var(--d-ink)" }} />
    <span style={{ left: bar.oPct, width: bar.mPct, background: "var(--d-cin)" }} />
    <span className={styles.barMin} style={{ left: bar.minPct, background: bar.minColor }} />
  </span>;
}

export function ArrowRight({ size = 15 }: { size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;
}
export function ArrowDown() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>;
}
export function ArrowLeft() {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>;
}

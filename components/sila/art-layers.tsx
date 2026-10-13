/* eslint-disable @next/next/no-img-element -- plates are pre-sized in public/art and positioned like v2's layered compositions */
import type { CSSProperties } from "react";
import { ART, img, type Layer, type Look } from "@/lib/ui/sila/art";

/** A programme's layered plates: "d" for the discovery band, "p" for the proposal art panel (v2 layerVM). */
export function ArtLayers({ look, mode }: { look: Look; mode: "d" | "p" }) {
  return (
    <>
      {look.layers.map((l) => (
        <LayerView key={l.id ?? l.k} l={l} mode={mode} />
      ))}
    </>
  );
}

const AR: Partial<Record<Layer["shape"], string>> = { fan: "2 / 1", qfan: "1 / 1", circle: "1 / 1" };
const RADIUS: Partial<Record<Layer["shape"], string>> = { fan: "999px 999px 0 0", qfan: "100% 0 0 0", circle: "50%" };
const SCREEN_BG = "radial-gradient(ellipse at 50% 38%, oklch(0.97 0.05 88), oklch(0.86 0.09 75) 62%, oklch(0.62 0.1 55))";

function LayerView({ l, mode }: { l: Layer; mode: "d" | "p" }) {
  const a = mode === "p" ? l.p : l.d;
  const screen = l.shape === "screen";
  const box: CSSProperties = {
    left: `${a[0]}%`,
    top: `${a[1]}%`,
    width: `${a[2]}%`,
    height: a[3] == null ? "auto" : `${a[3]}%`,
    aspectRatio: AR[l.shape] ?? "auto",
    zIndex: l.z,
    rotate: l.rot ?? "0deg",
  };
  const shape: CSSProperties = {
    borderRadius: RADIUS[l.shape] ?? "0",
    background: screen ? SCREEN_BG : l.bg ?? "transparent",
    boxShadow: l.shadow ? "0 24px 40px -22px oklch(0.15 0.02 50 / .65)" : "none",
  };
  const imgStyle: CSSProperties = {
    objectPosition: l.pos ?? "50% 50%",
    scale: String(l.zoom ?? 1),
    mixBlendMode: (l.blend ?? (screen ? "multiply" : "normal")) as CSSProperties["mixBlendMode"],
  };
  const move = mode === "p" ? { "data-depth": String(Math.round(l.z * 5)) } : { "data-speed": String(l.speed ?? 0) };
  const n = l.n ?? 7;
  const src = img(l.k);

  return (
    <div className="layer" style={box}>
      <div className="layer-move" {...move}>
        <div className="layer-shape" data-unfold={l.unfold} style={shape}>
          {l.lamp && <img data-lamp="" className="lamp" src={src} alt="" aria-hidden="true" style={{ objectPosition: imgStyle.objectPosition, scale: imgStyle.scale }} />}
          {l.shape === "strips" ? (
            Array.from({ length: n }, (_, i) => (
              <div
                key={i}
                className="strip"
                data-speed={mode === "p" ? undefined : String((i % 2 ? 0.09 : -0.09) * (1 + (i % 3) * 0.3))}
                style={{ left: `${(i * 100) / n}%`, width: `${100 / n + 0.2}%`, ...(mode === "p" ? { top: 0, height: "100%" } : null) }}
              >
                <img src={src} alt="" loading="lazy" style={{ left: `${-i * 100}%`, width: `${n * 100}%`, objectPosition: imgStyle.objectPosition }} />
              </div>
            ))
          ) : (
            <img src={src} alt={ART[l.k][0]} loading={mode === "p" ? "eager" : "lazy"} style={imgStyle} />
          )}
        </div>
        {l.ring && <div aria-hidden="true" className="ring" />}
      </div>
      {l.cap && mode === "d" && <span className="layer-cap">{l.cap}</span>}
    </div>
  );
}

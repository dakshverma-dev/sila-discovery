/**
 * Demo showcase: the seven demonstration experiences from Design/Sila v2.dc.html
 * (extracted verbatim into showcase.json). They are DEMO DATA, shown with a
 * "Demo data" label beside the sandbox's real proposals; nothing in them is
 * stored, reserved or charged.
 */
import data from "./showcase.json";
import { lookById, type ArtKey, type Look } from "./art";
import { GLYPH } from "./view";

export type DemoStatus = "proposed" | "awaiting" | "confirmed";

export interface DemoGroup {
  name: string;
  short: string;
  place: string;
  members: number;
  img: ArtKey;
  only: string[];
}

export interface DemoExp {
  id: string;
  ref: string;
  cat: string;
  city: string;
  unit: string;
  layout: string;
  lines: Array<[string, number]>;
  title: string;
  venue: string;
  venueShort: string;
  dek: string;
  format: string;
  short: string;
  why: string;
  plan: Array<[string, string]>;
  status: DemoStatus;
  needed: number;
  capacity: number;
  committed: number;
  interested: number;
  price: number;
  /** [ISO date, time range, people preferring or booked] */
  dates: Array<[string, string, number]>;
  opened: string;
  deadline: string | null;
  subs: [string, string, string];
  A: DemoGroup;
  B: DemoGroup;
  shared: Array<[string, number, number, string, ArtKey | null, string?]>;
  compat: Array<[string, string, string, ArtKey]>;
}

export const DEMO_EXPS = data as unknown as DemoExp[];

export const demoById = (id: string) => DEMO_EXPS.find((e) => e.id === id) ?? null;
export const demoLook = (e: DemoExp): Look => lookById(e.id);
export const demoLines = (e: DemoExp) => e.lines.map(([t, it]) => ({ t, italic: !!it }));

export const DEMO_STATUS: Record<DemoStatus, { label: string; short: string; glyph: string }> = {
  proposed: { label: "Proposed · gathering commitments", short: "Proposed", glyph: GLYPH.proposed },
  awaiting: { label: "Minimum reached · awaiting venue", short: "Awaiting venue", glyph: GLYPH.awaiting },
  confirmed: { label: "Confirmed by the venue", short: "Confirmed", glyph: GLYPH.confirmed },
};

/** "Thu 12 Nov" for a v2 calendar date. */
export const fdDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");

/** v2's band demand copy for a showcase experience (base figures, before the viewer's own demo commitment). */
export function demoDemand(e: DemoExp) {
  const confirmed = e.status === "confirmed";
  const remaining = Math.max(0, e.needed - e.committed);
  return {
    demandText: confirmed ? `${e.committed} booked, ${e.capacity - e.committed} places left.` : `${e.committed} of ${e.needed} committed.`,
    possible: confirmed
      ? "The minimum was reached and the venue confirmed."
      : remaining > 0
        ? `${remaining} more and the request goes to ${e.venueShort}. ${e.interested} others are interested.`
        : `Minimum reached; ${e.venueShort} is reviewing the request.`,
  };
}

export const capFirst = (s: string) => s.replace(/^the /, "The ");

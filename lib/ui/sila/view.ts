import type { ProposalState } from "@/lib/domain/types";
import { hashOf } from "./art";

/** Real proposal states shown in sila's three-stage language (Proposed → Awaiting venue → Confirmed). */
export const STATE_LABEL: Record<ProposalState, string> = {
  DRAFT: "Draft",
  OPEN: "Open for reservations",
  READY: "Ready for venue confirmation",
  CONFIRMED: "Confirmed by venue",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export const GLYPH = {
  proposed: "transparent",
  awaiting: "linear-gradient(90deg, currentColor 50%, transparent 50%)",
  confirmed: "currentColor",
} as const;

export type Stage = 0 | 1 | 2;

export function stageOf(state: ProposalState): Stage {
  if (state === "READY") return 1;
  if (state === "CONFIRMED" || state === "COMPLETED") return 2;
  return 0;
}

export function glyphOf(state: ProposalState): string {
  return [GLYPH.proposed, GLYPH.awaiting, GLYPH.confirmed][stageOf(state)]!;
}

export const LEGEND = [
  { label: "Proposed", glyph: GLYPH.proposed, text: "gathering reservations; nothing booked" },
  { label: "Awaiting venue", glyph: GLYPH.awaiting, text: "minimum reached; seats held, not charged" },
  { label: "Confirmed", glyph: GLYPH.confirmed, text: "venue said yes; no payment collected" },
];

const ILLUSTRATIVE = /\s*\(illustrative\)\s*$/i;

/** Splits a programme title into sila's two-line display (second line italic). */
export function titleLines(title: string): { lines: Array<{ t: string; italic: boolean }>; illustrative: boolean; plain: string } {
  const illustrative = ILLUSTRATIVE.test(title);
  const plain = title.replace(ILLUSTRATIVE, "");
  const words = plain.split(/\s+/);
  if (words.length < 3) return { lines: [{ t: plain, italic: false }], illustrative, plain };
  // Break before the word that best balances the two lines.
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  }
  return {
    lines: [
      { t: words.slice(0, best).join(" "), italic: false },
      { t: words.slice(best).join(" "), italic: true },
    ],
    illustrative,
    plain,
  };
}

const TZ = "Europe/London";
const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const hm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });

/** "Sat 14 Nov" */
export const fd = (iso: string) => day.format(new Date(iso)).replace(",", "");
/** "13:00–17:00" */
export const timeRange = (a: string, b: string) => `${hm.format(new Date(a))}–${hm.format(new Date(b))}`;
export const hhmm = (iso: string | number) => hm.format(new Date(iso));
/** "31 Oct" */
export const dayMonth = (iso: string) => dm.format(new Date(iso));

export function unitOf(startIso: string): string {
  const h = Number(hm.format(new Date(startIso)).slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const NUMS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];

/** "Four hours", "Two and a half hours", "90 minutes" */
export function durationWords(startIso: string, endIso: string): string {
  const mins = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000);
  if (mins < 120 && mins % 60 !== 0) return `${mins} minutes`;
  const h = Math.floor(mins / 60);
  const half = mins % 60 >= 30;
  const n = NUMS[h] ?? String(h);
  if (half) return `${n} and a half hours`;
  return h === 1 ? "One hour" : `${n} hours`;
}

/** Plan rows: minute offsets from the real start, or the real end. */
export function planTimes(plan: Array<[number | "end", string]>, startIso: string, endIso: string) {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  // Steps that would fall at or after the real end are dropped; the closing step always shows the end time.
  return plan
    .filter(([off]) => off === "end" || start + off * 60_000 < end)
    .map(([off, d]) => ({ t: hhmm(off === "end" ? endIso : start + off * 60_000), d }));
}

/**
 * Illustrative count of people who registered interest without reserving.
 * The API has no interest concept yet; the figure is stable per proposal and labelled "not counted".
 */
export function illustrativeInterest(id: string, capacity: number, reserved: number): number {
  const room = Math.max(0, capacity - reserved);
  return Math.min(room, 3 + (hashOf(id) % 12));
}

export const sentenceCase = (s: string) => s.replace(/^the /, "The ");

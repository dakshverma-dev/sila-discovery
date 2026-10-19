import { placesHeld, type SampleAccountId, type SampleWorkspace, type WorkspaceSession } from "@/lib/sila/sample-workspace";

/*
 * Artwork compositions, palette and session view model for the v5 discovery
 * screens (Sila prototype launch, Sila v5.dc.html). Layer positions are
 * percentages of the art box: d = feature band, p = session page, h = hero.
 * Shapes, unfold types and drift speeds follow the prototype's EXPS layers.
 */

export const INK = "oklch(0.22 0.02 50)", IVORY = "oklch(0.97 0.015 85)", PARCH = "oklch(0.95 0.025 85)";
export const OX = "oklch(0.38 0.12 25)", CIN = "oklch(0.58 0.17 35)", JADE = "oklch(0.55 0.09 165)", OCHRE = "oklch(0.74 0.13 75)";
export const OLIVE = "oklch(0.34 0.06 120)", INDIGO = "oklch(0.29 0.09 262)", ROSE = "oklch(0.78 0.08 25)";

export const ART: Record<string, [string, string]> = {
  printer: ["Jost Amman, Der Buchdrucker (The Printer), woodcut from the Ständebuch, 1568", "public domain"],
  caslon: ["William Caslon, A Specimen, type specimen sheet, c. 1734", "public domain"],
  rhino: ["Albrecht Dürer, The Rhinoceros, woodcut, 1515", "The Met, CC0"],
  melencolia: ["Albrecht Dürer, Melencolia I, engraving, 1514", "The Met, CC0"],
  knight: ["Albrecht Dürer, Knight, Death and the Devil, engraving, 1513", "The Met, CC0"],
  bewick: ["Thomas Bewick, A History of British Birds, wood engraving, 1797", "public domain"],
  kelmscott: ["The Kelmscott Chaucer, Kelmscott Press, 1896", "photograph by Cullen328, CC BY-SA 3.0"],
  hare: ["Albrecht Dürer, Young Hare, 1502", "public domain"],
  strawberry: ["William Morris, Strawberry Thief, 1883", "public domain"],
  actiniae: ["Ernst Haeckel, Actiniae, Kunstformen der Natur, 1904", "public domain"],
  trochilidae: ["Ernst Haeckel, Trochilidae, Kunstformen der Natur, 1904", "public domain"],
  orchidae: ["Ernst Haeckel, Orchidae, Kunstformen der Natur, 1904", "public domain"],
  wave: ["Katsushika Hokusai, Under the Wave off Kanagawa, c. 1830–32", "public domain"],
  redfuji: ["Katsushika Hokusai, Fine Wind, Clear Morning, c. 1830–32", "public domain"],
  oceanwaves: ["Katsushika Hokusai, Ocean Waves", "public domain"],
  mendoza: ["Codex Mendoza, folio 2r, the founding of Tenochtitlan, c. 1541", "public domain"],
  borgia: ["Codex Borgia, page 56, before 1500 (1898 facsimile)", "public domain"],
  imola: ["Leonardo da Vinci, Plan of Imola, 1502", "public domain"],
  wayang: ["Wayang kulit figure, Java", "Wereldmuseum Amsterdam, photograph Boy Lawson, CC BY-SA 3.0"],
  wayang2: ["Wayang kulit figure, Prajurit Jawa", "Nationaal Museum van Wereldculturen, CC BY-SA 4.0"],
  kentedetail: ["Man’s kente (prestige cloth), Asante, 19th century", "The Met, CC0"],
  palampore: ["Palampore (Tree of Life), India, c. 1815, detail", "The Met, CC0"],
  hamza: ["“’Umar Walks around Fulad Castle”, folio from the Hamzanama, Mughal, c. 1562–77", "The Met, CC0"],
};
export const credit = (k: string) => (ART[k] ? `${ART[k][0]} · ${ART[k][1]}` : "");
export const plateSrc = (k: string) => `/art/${k}.jpg`;

type Box = [number, number, number, number | null];
export interface Layer {
  k: string; id?: string; shape: "rect" | "circle" | "fan" | "qfan" | "bleed";
  d: Box; p: Box; h?: Box; pos?: string; zoom?: number; blend?: string; speed?: number;
  unfold?: "wipe" | "fan" | "qfan" | "circle"; z?: number; rot?: string; shadow?: boolean; ring?: boolean; bg?: string; cap?: string;
}
export interface Theme { ground: string; ink: string; accent: string; onLight: string }
export interface Composition { theme: Theme; layout: "art-left" | "art-right" | "bleed"; lines?: [string, boolean][]; layers: Layer[] }

const PAPER: Theme = { ground: PARCH, ink: INK, accent: OX, onLight: OX };
const PEACH: Theme = { ground: "oklch(0.88 0.06 55)", ink: INK, accent: "oklch(0.45 0.15 30)", onLight: "oklch(0.45 0.15 30)" };
const NIGHT: Theme = { ground: INDIGO, ink: IVORY, accent: "oklch(0.72 0.14 35)", onLight: INDIGO };
const MOSS: Theme = { ground: OLIVE, ink: IVORY, accent: ROSE, onLight: OLIVE };
const RUST: Theme = { ground: "oklch(0.42 0.13 32)", ink: IVORY, accent: OCHRE, onLight: "oklch(0.42 0.13 32)" };
const THEMES = [PAPER, PEACH, NIGHT, MOSS, RUST];

const COMPOSITIONS: Record<string, Composition> = {
  "print-room": {
    theme: PAPER, layout: "art-left", lines: [["An evening in", false], ["the print room", true]],
    layers: [
      { k: "printer", shape: "rect", d: [0, 2, 56, 92], p: [0, 0, 62, 86], h: [18, 0, 54, 68], pos: "50% 35%", blend: "multiply", speed: -0.04, unfold: "wipe", z: 1, cap: "Amman, 1568" },
      { k: "caslon", shape: "rect", d: [48, 0, 26, 70], p: [54, 2, 32, 60], h: [68, 6, 30, 50], pos: "50% 0%", rot: "-3deg", speed: 0.06, unfold: "wipe", z: 3, shadow: true, cap: "Caslon, c. 1734" },
      { k: "rhino", shape: "circle", d: [58, 54, 36, null], p: [48, 54, 42, null], h: [64, 44, 36, null], pos: "42% 58%", zoom: 1.5, speed: 0.1, unfold: "circle", z: 4, ring: true, bg: IVORY, cap: "Detail · Dürer, 1515" },
      { k: "melencolia", shape: "qfan", d: [78, 4, 24, null], p: [84, 66, 16, null], pos: "72% 28%", zoom: 1.3, speed: 0.03, unfold: "qfan", z: 2 },
    ],
  },
  woodcut: {
    theme: PEACH, layout: "art-right", lines: [["The art of", false], ["the woodcut", true]],
    layers: [
      { k: "rhino", shape: "rect", d: [0, 16, 70, 64], p: [0, 6, 84, 58], pos: "50% 50%", speed: -0.03, unfold: "wipe", z: 1, shadow: true, cap: "Dürer, 1515" },
      { k: "knight", shape: "rect", d: [62, 0, 32, 54], p: [54, 50, 40, 44], pos: "50% 40%", rot: "2deg", speed: 0.06, unfold: "wipe", z: 2, shadow: true, cap: "Dürer, 1513" },
      { k: "bewick", shape: "fan", d: [50, 64, 44, null], p: [2, 70, 50, null], pos: "50% 30%", speed: 0.08, unfold: "fan", z: 3 },
    ],
  },
  "type-and-paper": {
    theme: NIGHT, layout: "bleed", lines: [["Type, paper", false], ["& the printed page", true]],
    layers: [
      { k: "kelmscott", shape: "bleed", d: [0, 0, 100, 100], p: [0, 0, 100, 74], pos: "40% 50%", zoom: 1.04, speed: -0.05, unfold: "wipe", z: 1 },
      { k: "caslon", shape: "rect", d: [72, 8, 22, 50], p: [60, 52, 36, 44], pos: "50% 0%", rot: "2deg", speed: 0.05, unfold: "wipe", z: 2, shadow: true },
      { k: "melencolia", shape: "fan", d: [56, 64, 34, null], p: [4, 66, 52, null], pos: "60% 30%", speed: 0.08, unfold: "fan", z: 3 },
    ],
  },
  "botanical-print": {
    theme: MOSS, layout: "art-right", lines: [["Botanical", false], ["impressions", true]],
    layers: [
      { k: "orchidae", shape: "rect", d: [26, 0, 50, 100], p: [0, 0, 58, 100], pos: "50% 50%", speed: -0.03, unfold: "wipe", z: 1 },
      { k: "actiniae", shape: "rect", d: [0, 12, 24, 66], p: [60, 2, 34, 52], pos: "50% 30%", speed: 0.05, unfold: "wipe", z: 2, shadow: true },
      { k: "trochilidae", shape: "fan", d: [56, 58, 44, null], p: [42, 66, 56, null], pos: "50% 40%", speed: 0.08, unfold: "fan", z: 3 },
    ],
  },
  "autumn-prints": {
    theme: RUST, layout: "art-left", lines: [["An autumn", false], ["print gathering", true]],
    layers: [
      { k: "bewick", shape: "rect", d: [4, 0, 44, 100], p: [2, 0, 52, 100], pos: "50% 40%", rot: "-1.5deg", speed: -0.03, unfold: "wipe", z: 1, shadow: true },
      { k: "hare", shape: "rect", d: [56, 4, 34, 50], p: [58, 6, 36, 42], pos: "50% 45%", rot: "2deg", speed: 0.05, unfold: "wipe", z: 2, shadow: true },
      { k: "strawberry", shape: "qfan", d: [52, 52, 42, null], p: [56, 54, 42, null], pos: "40% 50%", speed: 0.08, unfold: "qfan", z: 3 },
    ],
  },
};

/** A session a venue adds later still gets a prototype-style plate and detail (the Hamza pattern). */
export function compositionFor(s: WorkspaceSession, index = 0): Composition {
  const known = COMPOSITIONS[s.id];
  if (known) return known;
  const k = s.image in ART ? s.image : "printer";
  return {
    theme: THEMES[index % THEMES.length] ?? PAPER, layout: index % 2 ? "art-right" : "art-left",
    layers: [
      { k, shape: "rect", d: [4, 2, 62, 96], p: [2, 0, 66, 100], pos: "50% 50%", rot: "-1.5deg", speed: -0.03, unfold: "wipe", z: 1, shadow: true },
      { k, id: `${k}-d`, shape: "circle", d: [54, 48, 40, null], p: [56, 50, 42, null], pos: "38% 60%", zoom: 2.2, speed: 0.08, unfold: "circle", z: 2, ring: true, cap: "Detail ×2.2" },
    ],
  };
}

/** Theme rotation follows the venue's own order, so a session looks the same on every screen. */
export const compositionIn = (data: SampleWorkspace, s: WorkspaceSession) => compositionFor(s, Math.max(0, data.sessions.indexOf(s)));

export function titleLines(s: WorkspaceSession, c: Composition): { t: string; italic: boolean }[] {
  if (c.lines) return c.lines.map(([t, italic]) => ({ t, italic }));
  const words = s.title.split(" "), cut = Math.ceil(words.length / 2);
  return [{ t: words.slice(0, cut).join(" "), italic: false }, ...(words.length > 1 ? [{ t: words.slice(cut).join(" "), italic: true }] : [])];
}

export const platesLine = (c: Composition) =>
  "Plates: " + [...new Set(c.layers.map(l => l.k))].map(k => { const a = ART[k]; return a ? a[0].split(",")[0] + (a[1] !== "public domain" ? ` (${a[1]})` : "") : k; }).join(" · ");
/** The first plate stands for the session in thumbnails and the index. */
export const leadLayer = (c: Composition, s: WorkspaceSession): Layer => c.layers[0] ?? { k: s.image, shape: "rect", d: [0, 0, 100, 100], p: [0, 0, 100, 100] };
export const platesCredit = (c: Composition) => [...new Set(c.layers.map(l => l.k))].map(credit).join(" · ");

// ——— one source of truth for a session's public state ———
const london = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", ...o }).format(new Date(iso));
export const shortDay = (iso: string) => london(iso, { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
export const dayMonth = (iso: string) => london(iso, { day: "numeric", month: "short" });
export const clock = (iso: string) => london(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
export const timeRange = (s: WorkspaceSession) => `${clock(s.startsAt)}–${clock(s.endsAt)}`;
export function duration(s: WorkspaceSession) {
  const mins = Math.round((Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 60000), h = Math.floor(mins / 60), m = mins % 60;
  return h && m ? `${h} h ${m} min` : h ? `${h} hour${h === 1 ? "" : "s"}` : `${m} minutes`;
}
export const pounds = (minor: number) => `£${minor % 100 ? (minor / 100).toFixed(2) : minor / 100}`;

export type StatusKey = "gathering" | "scheduled" | "deposits" | "confirmed" | "paused" | "closed";
const STATUS: Record<StatusKey, { label: string; glyph: string }> = {
  gathering: { label: "Gathering commitments", glyph: "transparent" },
  scheduled: { label: "Minimum reached · payment scheduled", glyph: "linear-gradient(90deg, currentColor 50%, transparent 50%)" },
  deposits: { label: "Deposits open · awaiting venue", glyph: "linear-gradient(90deg, currentColor 50%, transparent 50%)" },
  confirmed: { label: "Confirmed by the venue", glyph: "currentColor" },
  paused: { label: "New requests paused", glyph: "transparent" },
  closed: { label: "Not proceeding", glyph: "linear-gradient(135deg, transparent 44%, currentColor 44% 56%, transparent 56%)" },
};
export const STATUS_FILTERS: [string, StatusKey[] | null][] = [["All", null], ["Gathering", ["gathering", "paused"]], ["Deposits open", ["scheduled", "deposits"]], ["Confirmed", ["confirmed"]]];

export function sessionView(data: SampleWorkspace, s: WorkspaceSession, account: SampleAccountId) {
  const held = placesHeld(data, s.id);
  const own = data.plans.find(p => p.sessionId === s.id && p.organiser === account && !["withdrawn", "declined"].includes(p.status));
  const mine = own?.status === "committed" && held ? own.approved ?? 0 : 0, others = held - mine;
  const closed = s.phase === "closed" || s.phase === "cancelled", confirmed = s.phase === "confirmed";
  const key: StatusKey = closed ? "closed" : confirmed ? "confirmed" : s.openedAt ? "deposits" : s.minimumReachedAt ? "scheduled" : s.paused ? "paused" : "gathering";
  const more = Math.max(0, s.minimum - held);
  const venue = data.venue.name;
  const next = closed ? s.closedReason ?? "The session is closed and its conditional places are released."
    : confirmed ? `Confirmed by ${venue}${s.bookingRef ? ` · booking ${s.bookingRef}` : ""}. Each club keeps its own agreement and payment history.`
    : s.openedAt ? `Each club pays its own deposit directly to ${venue}. The venue confirms only after verifying receipts and checking its diary.`
    : s.minimumReachedAt ? "Minimum reached. Payment opens at a staffed midday deadline; nothing is confirmed yet."
    : s.paused ? "New requests are paused. Existing agreements are unchanged."
    : `${more} more place${more === 1 ? "" : "s"} and the session reaches its minimum. Nothing is due yet.`;
  const count = closed ? "Places released." : confirmed ? `${held} of ${s.capacity} places booked.` : `${held} of ${s.minimum} places conditionally committed.`;
  const stage = confirmed ? 2 : s.openedAt || s.minimumReachedAt ? 1 : 0;
  const bar = (dark = false) => {
    const pct = (n: number) => `${Math.min(100, (n / s.capacity) * 100).toFixed(2)}%`;
    return { oPct: pct(others), mPct: pct(mine), minPct: pct(s.minimum), track: dark ? "oklch(0.97 0.015 85 / .2)" : "oklch(0.22 0.02 50 / .12)",
      minColor: dark ? IVORY : OX, aria: `${held} places conditionally committed${mine ? `, ${mine} of them your club's` : ""}; venue minimum ${s.minimum}, capacity ${s.capacity}` };
  };
  return { held, own, mine, others, closed, confirmed, key, status: STATUS[key].label, glyph: STATUS[key].glyph, more, next, count, stage, bar,
    open: s.phase === "published" && !s.paused && !s.minimumReachedAt && data.now <= s.fillBy };
}
export type SessionView = ReturnType<typeof sessionView>;

/** Public sessions in the order the venue added them: the prototype's index shows confirmed ones too. */
export const publicSessions = (data: SampleWorkspace) => data.sessions.filter(s => s.phase === "published" || s.phase === "confirmed");

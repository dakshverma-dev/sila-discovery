/**
 * sila visual system (Design/Sila v2.dc.html): palette, picture credits and the
 * art composition ("look") for each programme. Compositions, shared-interest
 * percentages, companion groups and timetables here are ILLUSTRATIVE content
 * until Qloo taste data and venue programme notes exist; pages label them so.
 */

export const INK = "oklch(0.22 0.02 50)";
export const IVORY = "oklch(0.97 0.015 85)";
export const PARCH = "oklch(0.95 0.025 85)";
export const OX = "oklch(0.38 0.12 25)";
export const CIN = "oklch(0.58 0.17 35)";
export const JADE = "oklch(0.55 0.09 165)";
export const OCHRE = "oklch(0.74 0.13 75)";
export const OLIVE = "oklch(0.34 0.06 120)";
export const INDIGO = "oklch(0.29 0.09 262)";
export const ROSE = "oklch(0.78 0.08 25)";

export const ART = {
  printer: ["Jost Amman, Der Buchdrucker (The Printer), woodcut from the Ständebuch, 1568", "public domain"],
  caslon: ["William Caslon, A Specimen, type specimen sheet, c. 1734", "public domain"],
  rhino: ["Albrecht Dürer, The Rhinoceros, woodcut, 1515", "The Met, CC0"],
  melencolia: ["Albrecht Dürer, Melencolia I, engraving, 1514", "The Met, CC0"],
  knight: ["Albrecht Dürer, Knight, Death and the Devil, engraving, 1513", "The Met, CC0"],
  bewick: ["Thomas Bewick, A History of British Birds, wood engraving, 1797", "public domain"],
  kelmscott: ["The Kelmscott Chaucer, Kelmscott Press, 1896", "photograph by Cullen328, CC BY-SA 3.0"],
  hare: ["Albrecht Dürer, Young Hare, 1502", "public domain"],
  wave: ["Katsushika Hokusai, Under the Wave off Kanagawa, c. 1830–32", "public domain"],
  redfuji: ["Katsushika Hokusai, Fine Wind, Clear Morning, c. 1830–32", "public domain"],
  oceanwaves: ["Katsushika Hokusai, Ocean Waves", "public domain"],
  mendoza: ["Codex Mendoza, folio 2r, the founding of Tenochtitlan, c. 1541", "public domain"],
  borgia: ["Codex Borgia, page 56, before 1500 (1898 facsimile)", "public domain"],
  imola: ["Leonardo da Vinci, Plan of Imola, 1502", "public domain"],
  wayang: ["Wayang kulit figure, Java", "Wereldmuseum Amsterdam, photograph Boy Lawson, CC BY-SA 3.0"],
  wayang2: ["Wayang kulit figure, Prajurit Jawa", "Nationaal Museum van Wereldculturen, CC BY-SA 4.0"],
  kentedetail: ["Man’s kente (prestige cloth), Asante, 19th century", "The Met, CC0"],
  strawberry: ["William Morris, Strawberry Thief, 1883", "public domain"],
  palampore: ["Palampore (Tree of Life), India, c. 1815, detail", "The Met, CC0"],
  actiniae: ["Ernst Haeckel, Actiniae, Kunstformen der Natur, 1904", "public domain"],
  trochilidae: ["Ernst Haeckel, Trochilidae, Kunstformen der Natur, 1904", "public domain"],
  orchidae: ["Ernst Haeckel, Orchidae, Kunstformen der Natur, 1904", "public domain"],
  hamza: ["“’Umar Walks around Fulad Castle”, folio from the Hamzanama, Mughal, c. 1562–77", "The Met, CC0"],
} as const;

export type ArtKey = keyof typeof ART;

export const img = (k: ArtKey) => `/art/${k}.jpg`;
export const credit = (k: ArtKey) => `${ART[k][0]} · ${ART[k][1]}`;
export const ALL_CREDITS =
  (Object.keys(ART) as ArtKey[]).map(credit).join(". ") +
  ". Images reproduced from Wikimedia Commons and The Met Open Access.";

/** "Plates: …" line under a composition: short titles, licence only when not public domain. */
export function platesLine(keys: ArtKey[]): string {
  return (
    "Plates: " +
    [...new Set(keys)]
      .map((k) => ART[k][0].split(",")[0] + (ART[k][1] !== "public domain" ? ` (${ART[k][1]})` : ""))
      .join(" · ")
  );
}

export type Shape = "rect" | "circle" | "fan" | "qfan" | "screen" | "strips" | "bleed";
export type Unfold = "wipe" | "fan" | "qfan" | "circle";

export interface Layer {
  k: ArtKey;
  id?: string;
  shape: Shape;
  /** [x, y, w, h] in % for the discovery band; h null keeps the shape's aspect ratio. */
  d: [number, number, number, number | null];
  /** Same, for the proposal art panel. */
  p: [number, number, number, number | null];
  pos?: string;
  zoom?: number;
  blend?: string;
  rot?: string;
  speed?: number;
  unfold: Unfold;
  z: number;
  shadow?: boolean;
  ring?: boolean;
  bg?: string;
  lamp?: boolean;
  cap?: string;
  n?: number;
}

export interface Theme {
  ground: string;
  ink: string;
  accent: string;
  onLight: string;
}

/** [label, % of group A, % of group B, reference line, plate or null, object-position] */
export type Shared = [string, number, number, string, ArtKey | null, string?];

export interface Look {
  id: string;
  ref: string;
  cat: string;
  theme: Theme;
  layout: "art-left" | "art-right" | "bleed";
  layers: Layer[];
  short: string;
  why: string;
  shared: Shared[];
  /** [name, strength, why, plate] — illustrative companion groups. */
  compat: Array<[string, string, string, ArtKey]>;
  /** [minutes after start (or "end"), what happens] */
  plan: Array<[number | "end", string]>;
}

export const CATS = ["All", "Print & Paper", "Manuscript", "Performance", "Textile", "Natural History"] as const;

const LOOKS: Look[] = [
  {
    id: "print-room",
    ref: "Nº 0147",
    cat: "Print & Paper",
    theme: { ground: PARCH, ink: INK, accent: OX, onLight: OX },
    layout: "art-left",
    short:
      "Both groups keep returning to Dürer, Bewick and the Kelmscott Press. Neither is large enough on its own for the studio to open its press room.",
    why:
      "One group sets type and prints; the other reads and collects illustrated books. Independently, both keep returning to the same things: Dürer’s woodcuts, Thomas Bewick’s wood engravings, early type specimens and the books of the Kelmscott Press.",
    shared: [
      ["Dürer’s woodcuts", 58, 47, "Albrecht Dürer, The Rhinoceros, 1515", "rhino", "50% 55%"],
      ["Wood engraving", 64, 41, "Thomas Bewick, A History of British Birds, 1797", "bewick", "50% 22%"],
      ["The Kelmscott Press", 71, 33, "William Morris and Edward Burne-Jones, The Works of Geoffrey Chaucer, 1896", "kelmscott", "30% 50%"],
      ["Type specimens", 66, 23, "William Caslon, A Specimen, c. 1734", "caslon", "50% 0%"],
    ],
    compat: [
      ["Leith Bookbinders", "Strong", "Fine-press bindings and hand-sewn books", "kelmscott"],
      ["Old Town Sketchers", "Unexpected", "Draw in collections; follow Dürer closely", "knight"],
      ["Natural History Illustrators", "Partial", "Engraved plates and Haeckel", "trochilidae"],
    ],
    plan: [
      [0, "Arrive. Coats and bags to one side; aprons on."],
      [15, "The studio introduces its type collection: woodcuts, specimens and private-press proofs."],
      [45, "Setting and printing in pairs, one zine page each."],
      ["end", "The press room closes."],
    ],
    layers: [
      { k: "printer", shape: "rect", d: [0, 2, 56, 92], p: [0, 0, 62, 86], pos: "50% 35%", blend: "multiply", speed: -0.04, unfold: "wipe", z: 1, cap: "Amman, 1568" },
      { k: "caslon", shape: "rect", d: [48, 0, 26, 70], p: [54, 2, 32, 60], pos: "50% 0%", rot: "-3deg", speed: 0.06, unfold: "wipe", z: 3, shadow: true, cap: "Caslon, c. 1734" },
      { k: "rhino", shape: "circle", d: [58, 54, 36, null], p: [48, 54, 42, null], pos: "42% 58%", zoom: 1.5, speed: 0.1, unfold: "circle", z: 4, ring: true, bg: IVORY, cap: "Detail · Dürer, 1515" },
      { k: "melencolia", shape: "qfan", d: [78, 4, 24, null], p: [84, 66, 16, null], pos: "72% 28%", zoom: 1.3, speed: 0.03, unfold: "qfan", z: 2 },
    ],
  },
  {
    id: "hokusai",
    ref: "Nº 0152",
    cat: "Print & Paper",
    theme: { ground: INDIGO, ink: IVORY, accent: "oklch(0.7 0.14 35)", onLight: INDIGO },
    layout: "bleed",
    short:
      "Two groups that rarely meet both save the same coastal prints and memoirs of place. A guided session through the collection suits both.",
    why:
      "An unlikely pair. Both groups save Hokusai’s wave prints and writing about the coast far more often than comparable communities do.",
    shared: [
      ["Hokusai’s waves", 44, 38, "Katsushika Hokusai, Thirty-six Views of Mount Fuji, c. 1830–32", "wave", "35% 40%"],
      ["Indigo and Prussian blue", 52, 21, "Prussian blue pigment, widely used in Japanese prints from the late 1820s", "oceanwaves", "50% 50%"],
      ["Sea charts and coastlines", 18, 47, "Inō Tadataka’s survey maps of the Japanese coast, 1800–1821", null],
    ],
    compat: [
      ["Portobello Printmakers", "Strong", "Relief printing and Japanese tools", "redfuji"],
      ["Forth Sailing Club", "Unexpected", "Follows maritime prints", "oceanwaves"],
    ],
    plan: [
      [0, "Introductions in the collection room."],
      [20, "The curator walks the selection: memoir, place and the city."],
      [90, "Free looking, with the curator on hand."],
      ["end", "Close."],
    ],
    layers: [
      { k: "wave", shape: "bleed", d: [0, 0, 100, 100], p: [0, 0, 100, 74], pos: "28% 40%", zoom: 1.04, speed: -0.05, unfold: "wipe", z: 1 },
      { k: "oceanwaves", shape: "rect", d: [74, 8, 20, 36], p: [62, 56, 34, 34], pos: "40% 50%", rot: "2deg", speed: 0.05, unfold: "wipe", z: 2, shadow: true },
      { k: "redfuji", shape: "fan", d: [62, 62, 32, null], p: [4, 66, 52, null], pos: "55% 72%", speed: 0.08, unfold: "fan", z: 3 },
    ],
  },
  {
    id: "codex",
    ref: "Nº 0139",
    cat: "Manuscript",
    theme: { ground: "oklch(0.88 0.06 55)", ink: INK, accent: "oklch(0.45 0.15 30)", onLight: "oklch(0.45 0.15 30)" },
    layout: "art-right",
    short:
      "Both groups keep saving letters, maps and annotated pages. Someone who can read the archive answers both groups’ questions.",
    why:
      "One group reads; the other walks and collects old records. Both keep saving the same kinds of thing: handwritten letters, annotated maps and pages where pictures and words share the sheet.",
    shared: [
      ["Pictorial maps", 31, 66, "Codex Mendoza, folio 2r, c. 1541", "mendoza", "50% 40%"],
      ["Annotated manuscripts", 48, 22, "Codex Borgia, before 1500", "borgia", "50% 35%"],
      ["City plans", 22, 71, "Leonardo da Vinci, Plan of Imola, 1502", "imola", "50% 50%"],
    ],
    compat: [
      ["Edinburgh Palaeography Circle", "Strong", "Reads early handwriting", "borgia"],
      ["Stockbridge Zine Library", "Partial", "Collects hand-drawn maps", "imola"],
    ],
    plan: [
      [0, "Seminar room, with the letters on cradles."],
      [15, "Reading the first bundle aloud: hands, dates and place names."],
      [75, "The annotated pages, and who wrote in the margins."],
      ["end", "Tea, and the archive’s own early maps of the city."],
    ],
    layers: [
      { k: "mendoza", shape: "rect", d: [24, 0, 46, 100], p: [6, 0, 54, 100], pos: "50% 40%", speed: -0.03, unfold: "wipe", z: 1, shadow: true },
      { k: "imola", shape: "circle", d: [58, 4, 40, null], p: [54, 6, 44, null], pos: "50% 50%", zoom: 1.34, speed: 0.07, unfold: "circle", z: 3, bg: IVORY },
      { k: "borgia", shape: "fan", d: [0, 64, 48, null], p: [44, 70, 54, null], pos: "50% 30%", speed: 0.05, unfold: "fan", z: 2 },
    ],
  },
  {
    id: "wayang",
    ref: "Nº 0118",
    cat: "Performance",
    theme: { ground: "oklch(0.17 0.012 60)", ink: IVORY, accent: OCHRE, onLight: "oklch(0.5 0.1 70)" },
    layout: "art-right",
    short:
      "One group watches adaptations; the other reads the novels first. Together they can fill a room to argue about what changed on the way to the screen.",
    why:
      "Both groups follow the same stories across forms: shadow and screen, page and performance. The overlap is in the adaptations each keeps returning to.",
    shared: [
      ["Shadow and screen", 41, 72, "Wayang puppet theatre, UNESCO Intangible Cultural Heritage", "wayang", "50% 30%"],
      ["Live accompaniment", 88, 19, "Music played alongside the story, as in gamelan", null],
      ["Epic cycles", 27, 35, "Long stories told across many nights", "wayang2", "50% 50%"],
    ],
    compat: [
      ["Edinburgh Indonesian Society", "Strong", "Javanese and Balinese culture", "wayang2"],
      ["Lothian Storytellers", "Unexpected", "Long-form oral epics", "wayang"],
    ],
    plan: [
      [0, "Doors. Chairs in front of the screen."],
      [15, "Readings from the novel, then the same scenes on screen."],
      [75, "The discussion, chaired by the venue."],
      ["end", "Close."],
    ],
    layers: [
      { k: "wayang", shape: "screen", d: [18, 2, 78, 96], p: [4, 2, 92, 82], pos: "50% 35%", zoom: 1.02, lamp: true, speed: -0.02, unfold: "wipe", z: 1 },
      { k: "wayang2", shape: "screen", d: [0, 64, 30, 30], p: [60, 70, 36, 26], pos: "50% 50%", rot: "-4deg", speed: 0.06, unfold: "wipe", z: 2, shadow: true },
    ],
  },
  {
    id: "kente",
    ref: "Nº 0144",
    cat: "Textile",
    theme: { ground: "oklch(0.82 0.12 88)", ink: INK, accent: "oklch(0.42 0.11 150)", onLight: "oklch(0.42 0.11 150)" },
    layout: "art-left",
    short: "Both groups make things by hand and keep saving the same patterned cloth. One session at the looms serves both.",
    why: "Both groups follow narrow-strip weaving, named patterns and natural dyes, from opposite ends: one wears the cloth, the other weaves.",
    shared: [
      ["Narrow-strip weaving", 61, 58, "Asante kente, woven in strips about four inches wide", "kentedetail", "50% 50%"],
      ["Pattern names and proverbs", 73, 24, "Named kente patterns and the sayings attached to them", null],
      ["Natural dyes", 22, 49, "Palampore, India, c. 1815: mordant- and resist-dyed cotton", "palampore", "60% 50%"],
    ],
    compat: [
      ["Bruntsfield Quilters", "Partial", "Strip piecing and colour work", "palampore"],
      ["Ghana Union Scotland", "Strong", "Asante heritage events", "kentedetail"],
    ],
    plan: [
      [0, "Welcome, and the cloths the groups have brought."],
      [30, "Demonstration on a narrow strip loom."],
      [90, "Hands on the looms, in pairs."],
      ["end", "Close."],
    ],
    layers: [
      { k: "kentedetail", shape: "strips", n: 7, d: [0, 0, 62, 100], p: [0, 0, 66, 100], pos: "50% 50%", unfold: "wipe", z: 1 },
      { k: "palampore", shape: "rect", d: [60, 2, 34, 40], p: [62, 4, 36, 42], pos: "60% 50%", rot: "3deg", speed: 0.04, unfold: "wipe", z: 2, shadow: true },
      { k: "strawberry", shape: "qfan", d: [52, 50, 42, null], p: [56, 52, 42, null], pos: "40% 50%", speed: 0.08, unfold: "qfan", z: 3 },
    ],
  },
  {
    id: "haeckel",
    ref: "Nº 0156",
    cat: "Natural History",
    theme: { ground: OLIVE, ink: IVORY, accent: ROSE, onLight: OLIVE },
    layout: "art-right",
    short: "One group draws for the line; the other studies the animals. One session at the plates serves both.",
    why: "Both groups follow Kunstformen der Natur closely, from opposite ends: one for the drawing, one for the animals.",
    shared: [
      ["Haeckel’s plates", 57, 62, "Ernst Haeckel, Kunstformen der Natur, 1899–1904", "actiniae", "50% 50%"],
      ["Nature studies", 49, 44, "Albrecht Dürer, Young Hare, 1502", "hare", "50% 45%"],
      ["Microscopy", 12, 81, "Radiolaria drawn from the Challenger expedition’s samples", null],
    ],
    compat: [
      ["Natural History Illustrators", "Strong", "Botanical and zoological drawing", "orchidae"],
      ["Meadows Life Drawing", "Partial", "Draws in museum galleries", "hare"],
    ],
    plan: [
      [0, "The plates are set out on the long table."],
      [20, "A short introduction to what each animal is."],
      [40, "Drawing, with the librarian moving between tables."],
      ["end", "Close."],
    ],
    layers: [
      { k: "actiniae", shape: "rect", d: [26, 0, 50, 100], p: [0, 0, 58, 100], pos: "50% 50%", speed: -0.03, unfold: "wipe", z: 1 },
      { k: "orchidae", shape: "rect", d: [0, 12, 24, 66], p: [60, 2, 34, 52], pos: "50% 30%", speed: 0.05, unfold: "wipe", z: 2, shadow: true },
      { k: "trochilidae", shape: "fan", d: [56, 58, 44, null], p: [42, 66, 56, null], pos: "50% 40%", speed: 0.08, unfold: "fan", z: 3 },
    ],
  },
  {
    id: "hamza",
    ref: "Nº 0161",
    cat: "Performance",
    theme: { ground: "oklch(0.42 0.13 32)", ink: IVORY, accent: OCHRE, onLight: "oklch(0.42 0.13 32)" },
    layout: "art-left",
    short:
      "A poetry circle and a conversation group both save the same poems in translation. Hearing them read aloud, with music, brings the two together.",
    why:
      "One group meets for poetry; the other for conversation across languages. Both have been saving the same collection, and both ask for readings rather than lectures.",
    shared: [
      ["Poetry in translation", 62, 48, "Folios from the Hamzanama, Mughal, c. 1562–77", "hamza", "50% 50%"],
      ["Serial stories", 41, 77, "Epics traditionally told in nightly instalments", null],
      ["Words with music", 83, 26, "Readings with live accompaniment", null],
    ],
    compat: [
      ["Edinburgh Urdu Circle", "Strong", "Urdu literature and performance", "hamza"],
      ["Canongate Comics Collective", "Partial", "Visual storytelling", "wave"],
    ],
    plan: [
      [0, "Doors, and tea."],
      [20, "Readings from the collection, with live accompaniment."],
      [80, "The readers take questions."],
      ["end", "Close."],
    ],
    layers: [
      { k: "hamza", shape: "rect", d: [4, 2, 62, 96], p: [2, 0, 66, 100], pos: "50% 50%", rot: "-1.5deg", speed: -0.03, unfold: "wipe", z: 1, shadow: true },
      { k: "hamza", id: "hamza-d", shape: "circle", d: [54, 48, 40, null], p: [56, 50, 42, null], pos: "38% 74%", zoom: 2.4, speed: 0.08, unfold: "circle", z: 2, ring: true, cap: "Detail ×2.4" },
    ],
  },
];

/** Programme title keywords → composition. Unknown titles fall back to a stable hash. */
const RULES: Array<[RegExp, string]> = [
  [/letterpress|zine|print/i, "print-room"],
  [/archive|letter|manuscript|map/i, "codex"],
  [/screen|adaptation|film/i, "wayang"],
  [/poetry|salon|music|story/i, "hamza"],
  [/curator|collection|coast|memoir/i, "hokusai"],
  [/weav|textile|cloth/i, "kente"],
  [/natur|draw|botan/i, "haeckel"],
];

export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function lookById(id: string): Look {
  return LOOKS.find((l) => l.id === id) ?? LOOKS[0]!;
}

export function lookFor(title: string): Look {
  const id = RULES.find(([re]) => re.test(title))?.[1];
  return LOOKS.find((l) => l.id === id) ?? LOOKS[hashOf(title) % LOOKS.length]!;
}

export interface GroupLook {
  img: ArtKey;
  place: string;
  members: number;
  only: string[];
}

/** Illustrative group portraits: plate, neighbourhood, size and interests the other group does not share. */
const GROUPS: Array<[RegExp, GroupLook]> = [
  [/book/i, { img: "kelmscott", place: "Marchmont", members: 46, only: ["Memoir", "Edinburgh crime fiction", "Translated novels"] }],
  [/film/i, { img: "redfuji", place: "Tollcross", members: 88, only: ["Silent film", "Scottish cinema", "Festival screenings"] }],
  [/maker/i, { img: "printer", place: "Leith", members: 52, only: ["Bookbinding", "Risograph printing", "Local history"] }],
  [/walk|history/i, { img: "imola", place: "Old Town", members: 64, only: ["Closes and wynds", "Burgh records", "Long walks"] }],
  [/language/i, { img: "hamza", place: "Newington", members: 38, only: ["Conversation evenings", "Folk song", "Film nights"] }],
];
const FALLBACK_GROUP_IMGS: ArtKey[] = ["hare", "strawberry", "trochilidae", "borgia", "oceanwaves"];

export function groupLook(name: string, members?: number): GroupLook {
  const g = GROUPS.find(([re]) => re.test(name))?.[1];
  const base = g ?? {
    img: FALLBACK_GROUP_IMGS[hashOf(name) % FALLBACK_GROUP_IMGS.length]!,
    place: "Edinburgh",
    members: 30 + (hashOf(name) % 90),
    only: ["Reading", "Talks", "Walks"],
  };
  return members ? { ...base, members } : base;
}

/** The sila hero's fan grid: [x%, y%, plate | "fill", fill colour, object-position or fill text]. */
export const HERO_FANS: Array<[number, number, ArtKey | "fill", string | null, string?]> = [
  [40, 2, "fill", OX], [70, 2, "redfuji", null, "55% 70%"],
  [25, 16, "wave", null, "30% 45%"], [55, 16, "hamza", null, "50% 40%"],
  [10, 30, "fill", JADE], [40, 30, "actiniae", null, "50% 45%"], [70, 30, "fill", OCHRE, "Nº 07"],
  [25, 44, "borgia", null, "50% 30%"], [55, 44, "kentedetail", null, "50% 50%"],
  [0, 58, "strawberry", null, "40% 50%"], [40, 58, "wayang", null, "50% 30%"],
  [15, 72, "fill", CIN], [55, 72, "printer", null, "50% 30%"],
];

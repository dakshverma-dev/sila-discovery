import type { RankedAnchor } from "@/lib/domain/utility";
import type { SharingChoice, TimeWindow } from "@/lib/domain/types";

/**
 * Fictional judge-sandbox content. No real venue, programme, person or Qloo
 * entity is represented; anchor IDs are synthetic placeholders that are never
 * sent to Qloo.
 */

const VENUE_TZ = "Europe/London";

/** Converts a London wall-clock time on a date to a UTC ISO string (DST-safe). */
export function londonToUtc(date: Date, hour: number, minute = 0): string {
  const guess = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VENUE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guess));
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  const offsetMinutes = (h * 60 + m) - (hour * 60 + minute);
  return new Date(guess - offsetMinutes * 60_000).toISOString();
}

/** The Saturday at least `minDays` after `now` (UTC date arithmetic). */
export function saturdayAfter(now: Date, minDays: number): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + minDays));
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7));
  return d;
}

export const SYNTHETIC_ANCHORS = [
  { entity_id: "SYNTHETIC_ANCHOR_A", label: "Synthetic book anchor A (coastal memoir)" },
  { entity_id: "SYNTHETIC_ANCHOR_B", label: "Synthetic book anchor B (city mystery)" },
  { entity_id: "SYNTHETIC_ANCHOR_C", label: "Synthetic book anchor C (craft history)" },
  { entity_id: "SYNTHETIC_ANCHOR_D", label: "Synthetic book anchor D (graphic novel)" },
  { entity_id: "SYNTHETIC_ANCHOR_E", label: "Synthetic book anchor E (archive letters)" },
  { entity_id: "SYNTHETIC_ANCHOR_F", label: "Synthetic book anchor F (poetry collection)" },
] as const;

export const ANCHOR_UNIVERSE = SYNTHETIC_ANCHORS.map((a) => a.entity_id);

type AnchorId = (typeof SYNTHETIC_ANCHORS)[number]["entity_id"];

interface CommunityDef {
  key: string;
  name: string;
  public_summary: string;
  organiser: { key: string; display_name: string };
  participantNames: string[];
  budget_pence: number;
  sharing_choice: SharingChoice;
  access_requirements: string[];
  /** London wall-clock window on each demo Saturday. */
  window: [number, number, number, number];
  /** Synthetic ordinal ranking over the full anchor universe. */
  ranking: AnchorId[];
}

const COMMUNITIES: CommunityDef[] = [
  {
    key: "book_club",
    name: "Illustrative book club",
    public_summary: "A monthly reading circle interested in memoir and place.",
    organiser: { key: "org_book", display_name: "Ailsa (book club organiser)" },
    participantNames: ["Bram", "Cora", "Dev", "Esme", "Finn", "Gita", "Hal"],
    budget_pence: 2200,
    sharing_choice: "WILLING_TO_SHARE",
    access_requirements: ["seating"],
    window: [13, 0, 17, 0],
    ranking: ["SYNTHETIC_ANCHOR_A", "SYNTHETIC_ANCHOR_B", "SYNTHETIC_ANCHOR_E", "SYNTHETIC_ANCHOR_C", "SYNTHETIC_ANCHOR_F", "SYNTHETIC_ANCHOR_D"],
  },
  {
    key: "film_society",
    name: "Illustrative film society",
    public_summary: "Watches and discusses adaptations of novels.",
    organiser: { key: "org_film", display_name: "Iain (film society organiser)" },
    participantNames: ["Jude", "Kai", "Lena", "Moss", "Nell", "Omar", "Pia", "Quin", "Rhea"],
    budget_pence: 2000,
    sharing_choice: "WILLING_TO_SHARE",
    access_requirements: [],
    window: [14, 0, 16, 0],
    ranking: ["SYNTHETIC_ANCHOR_B", "SYNTHETIC_ANCHOR_A", "SYNTHETIC_ANCHOR_D", "SYNTHETIC_ANCHOR_F", "SYNTHETIC_ANCHOR_E", "SYNTHETIC_ANCHOR_C"],
  },
  {
    key: "makers_group",
    name: "Illustrative makers group",
    public_summary: "Practical crafts, printing and local history.",
    organiser: { key: "org_makers", display_name: "Sana (makers group organiser)" },
    participantNames: ["Tam", "Uma", "Vic", "Wren", "Xan", "Yara"],
    budget_pence: 2500,
    sharing_choice: "WILLING_TO_SHARE",
    access_requirements: ["step_free"],
    window: [13, 30, 16, 0],
    ranking: ["SYNTHETIC_ANCHOR_A", "SYNTHETIC_ANCHOR_C", "SYNTHETIC_ANCHOR_D", "SYNTHETIC_ANCHOR_B", "SYNTHETIC_ANCHOR_E", "SYNTHETIC_ANCHOR_F"],
  },
  {
    key: "walking_group",
    name: "Illustrative history walkers",
    public_summary: "Prefers private sessions for its own members.",
    organiser: { key: "org_walk", display_name: "Zoe (history walkers organiser)" },
    participantNames: ["Abe", "Bea", "Cal", "Dot", "Eli"],
    budget_pence: 1500,
    sharing_choice: "PRIVATE_ONLY",
    access_requirements: [],
    window: [10, 0, 18, 0],
    ranking: ["SYNTHETIC_ANCHOR_E", "SYNTHETIC_ANCHOR_C", "SYNTHETIC_ANCHOR_A", "SYNTHETIC_ANCHOR_B", "SYNTHETIC_ANCHOR_F", "SYNTHETIC_ANCHOR_D"],
  },
  {
    key: "language_exchange",
    name: "Illustrative language exchange",
    public_summary: "Conversation group; would like to be asked before sharing.",
    organiser: { key: "org_lang", display_name: "Femi (language exchange organiser)" },
    participantNames: ["Gus", "Hana", "Ivo", "Jin"],
    budget_pence: 1800,
    sharing_choice: "ASK_FIRST",
    access_requirements: ["hearing_support"],
    window: [12, 0, 18, 0],
    ranking: ["SYNTHETIC_ANCHOR_F", "SYNTHETIC_ANCHOR_B", "SYNTHETIC_ANCHOR_D", "SYNTHETIC_ANCHOR_A", "SYNTHETIC_ANCHOR_C", "SYNTHETIC_ANCHOR_E"],
  },
];

interface ExperienceDef {
  key: string;
  title: string;
  description: string;
  access_support: string[];
  anchors: Array<{ entity_id: AnchorId; mapping_reason: string }>;
  quote: {
    fixed_pence: number;
    variable_pence: number;
    platform_fee_pence: number;
    ticket_pence: number;
    minimum_venue_charge_pence: number;
    venue_min_seats: number;
  };
  capacity: number;
  /** London start/end hours on each demo Saturday. */
  times: [number, number, number, number];
}

const EXPERIENCES: ExperienceDef[] = [
  {
    key: "curator_session",
    title: "Curator-led collection session (illustrative)",
    description: "A specialist walk-through of a fictional collection on memoir, place and the city.",
    access_support: ["step_free", "seating"],
    anchors: [
      { entity_id: "SYNTHETIC_ANCHOR_A", mapping_reason: "The session reads place through first-person memoir." },
      { entity_id: "SYNTHETIC_ANCHOR_B", mapping_reason: "Covers the city's streets as a setting for fiction." },
    ],
    quote: { fixed_pence: 30000, variable_pence: 500, platform_fee_pence: 200, ticket_pence: 2000, minimum_venue_charge_pence: 0, venue_min_seats: 10 },
    capacity: 30,
    times: [14, 0, 15, 30],
  },
  {
    key: "letterpress",
    title: "Letterpress and zine workshop (illustrative)",
    description: "Hands-on printing using a fictional studio's type collection.",
    access_support: ["step_free"],
    anchors: [
      { entity_id: "SYNTHETIC_ANCHOR_C", mapping_reason: "Rooted in the history of craft printing." },
      { entity_id: "SYNTHETIC_ANCHOR_D", mapping_reason: "Uses sequential visual storytelling." },
    ],
    quote: { fixed_pence: 12000, variable_pence: 400, platform_fee_pence: 100, ticket_pence: 1500, minimum_venue_charge_pence: 0, venue_min_seats: 8 },
    capacity: 20,
    times: [14, 0, 15, 30],
  },
  {
    key: "archive_tour",
    title: "Archive letters reading room (illustrative)",
    description: "A quiet, seated reading of fictional archive correspondence.",
    access_support: ["seating", "quiet_space"],
    anchors: [{ entity_id: "SYNTHETIC_ANCHOR_E", mapping_reason: "Built around letters held in an archive." }],
    quote: { fixed_pence: 6000, variable_pence: 200, platform_fee_pence: 100, ticket_pence: 1200, minimum_venue_charge_pence: 0, venue_min_seats: 6 },
    capacity: 15,
    times: [11, 0, 12, 0],
  },
  {
    key: "adaptation_evening",
    title: "Page to screen discussion (illustrative)",
    description: "A facilitated conversation comparing a fictional novel with its adaptation.",
    access_support: ["step_free", "seating", "hearing_support"],
    anchors: [
      { entity_id: "SYNTHETIC_ANCHOR_B", mapping_reason: "The featured novel is a city mystery." },
      { entity_id: "SYNTHETIC_ANCHOR_D", mapping_reason: "Discusses visual adaptation." },
    ],
    quote: { fixed_pence: 15000, variable_pence: 300, platform_fee_pence: 150, ticket_pence: 1600, minimum_venue_charge_pence: 0, venue_min_seats: 12 },
    capacity: 25,
    times: [18, 0, 19, 30],
  },
  {
    key: "poetry_salon",
    title: "Poetry and music salon (illustrative)",
    description: "Readings from a fictional poetry collection with live accompaniment.",
    access_support: ["seating", "hearing_support"],
    anchors: [{ entity_id: "SYNTHETIC_ANCHOR_F", mapping_reason: "Readings drawn from a poetry collection." }],
    quote: { fixed_pence: 8000, variable_pence: 300, platform_fee_pence: 100, ticket_pence: 1400, minimum_venue_charge_pence: 0, venue_min_seats: 8 },
    capacity: 18,
    times: [15, 0, 16, 0],
  },
];

export const DEMO_RANKINGS: Record<string, RankedAnchor[]> = Object.fromEntries(
  COMMUNITIES.map((c) => [c.name, c.ranking.map((entity_id) => ({ entity_id }))]),
);

/** Builds the definition consumed by scb_api.create_demo_workspace. */
export function buildDemoDefinition(now: Date = new Date()) {
  const saturdays = [saturdayAfter(now, 14), saturdayAfter(now, 21)];
  const window = (d: Date, [sh, sm, eh, em]: [number, number, number, number]): TimeWindow => ({
    start_at: londonToUtc(d, sh, sm),
    end_at: londonToUtc(d, eh, em),
  });

  const users: Array<{ key: string; display_name: string }> = [
    { key: "venue_manager", display_name: "Rowan (venue manager)" },
    { key: "operator", display_name: "Morgan (operator)" },
  ];
  for (const c of COMMUNITIES) {
    users.push(c.organiser);
    c.participantNames.forEach((n, i) =>
      users.push({ key: `${c.key}_p${i + 1}`, display_name: `${n} (${c.name.replace("Illustrative ", "")})` }),
    );
  }

  return {
    name: "Judge sandbox",
    expires_in_hours: 24,
    users,
    operator: "operator",
    venue: { name: "Illustrative Arts Hall (fictional venue)", manager: "venue_manager" },
    experiences: EXPERIENCES.map((e) => ({
      key: e.key,
      title: e.title,
      description: e.description,
      access_support: e.access_support,
      anchors: e.anchors.map((a) => ({
        ...a,
        label: SYNTHETIC_ANCHORS.find((s) => s.entity_id === a.entity_id)!.label,
      })),
      quote: e.quote,
      slots: saturdays.map((d, i) => ({ key: `${e.key}_${i + 1}`, ...window(d, e.times), capacity: e.capacity })),
    })),
    communities: COMMUNITIES.map((c) => ({
      key: c.key,
      name: c.name,
      public_summary: c.public_summary,
      organiser: c.organiser.key,
      participants: c.participantNames.map((_, i) => `${c.key}_p${i + 1}`),
      brief: {
        budget_pence: c.budget_pence,
        expected_seats: c.participantNames.length + 1,
        availability: saturdays.map((d) => window(d, c.window)),
        sharing_choice: c.sharing_choice,
        external_query_consent: true,
        access_requirements: c.access_requirements,
      },
    })),
  };
}

export type DemoDefinition = ReturnType<typeof buildDemoDefinition>;

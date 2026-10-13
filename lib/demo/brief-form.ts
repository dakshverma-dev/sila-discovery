import { londonToUtc } from "./catalogue";
import { parsePounds } from "@/lib/domain/money";

/** Parses the brief editor form into save_group_brief arguments (R03). */

export const ACCESS_OPTIONS = ["step_free", "seating", "quiet_space", "hearing_support"] as const;
export const SHARING_OPTIONS = ["WILLING_TO_SHARE", "PRIVATE_ONLY", "ASK_FIRST"] as const;
export const MAX_WINDOWS = 4;
export const MAX_REFERENCES = 8;

export interface ParsedBrief {
  budget_pence: number;
  expected_seats: number;
  sharing_choice: (typeof SHARING_OPTIONS)[number];
  external_query_consent: boolean;
  access_requirements: string[];
  availability: Array<{ start_at: string; end_at: string }>;
  references: Array<{
    input_label: string;
    declared_meaning: string | null;
    entity_id: string | null;
    subtype: string | null;
    resolved: boolean;
  }>;
}

export type BriefParse = { ok: true; brief: ParsedBrief } | { ok: false; fields: string[] };

function text(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function londonDateTime(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  return londonToUtc(new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]))), Number(t[1]), Number(t[2]));
}

export function parseBriefForm(form: FormData): BriefParse {
  const fields: string[] = [];
  const budget = parsePounds(text(form, "budget"));
  if (budget === null) fields.push("budget");
  const seats = Number(text(form, "expected_seats"));
  if (!Number.isInteger(seats) || seats < 1 || seats > 100) fields.push("expected_seats");
  const sharing = text(form, "sharing_choice") as ParsedBrief["sharing_choice"];
  if (!SHARING_OPTIONS.includes(sharing)) fields.push("sharing_choice");
  const access = form.getAll("access").filter((a): a is string => typeof a === "string");
  if (!access.every((a) => (ACCESS_OPTIONS as readonly string[]).includes(a))) fields.push("access");

  const availability: ParsedBrief["availability"] = [];
  for (let i = 0; i < MAX_WINDOWS; i++) {
    const date = text(form, `window_${i}_date`);
    const start = text(form, `window_${i}_start`);
    const end = text(form, `window_${i}_end`);
    if (!date && !start && !end) continue;
    const s = londonDateTime(date, start);
    const e = londonDateTime(date, end);
    if (!s || !e || Date.parse(s) >= Date.parse(e)) {
      fields.push(`window_${i}`);
      continue;
    }
    availability.push({ start_at: s, end_at: e });
  }

  const references: ParsedBrief["references"] = [];
  for (let i = 0; i < MAX_REFERENCES; i++) {
    const label = text(form, `ref_${i}_label`).slice(0, 200);
    if (!label) continue;
    const entity = text(form, `ref_${i}_entity`);
    const subtype = text(form, `ref_${i}_subtype`);
    references.push({
      input_label: label,
      declared_meaning: text(form, `ref_${i}_meaning`).slice(0, 1000) || null,
      entity_id: entity || null,
      subtype: subtype || null,
      resolved: Boolean(entity && subtype),
    });
  }

  if (fields.length) return { ok: false, fields };
  return {
    ok: true,
    brief: {
      budget_pence: budget!,
      expected_seats: seats,
      sharing_choice: sharing,
      external_query_consent: form.get("external_query_consent") === "on",
      access_requirements: access,
      availability,
      references,
    },
  };
}

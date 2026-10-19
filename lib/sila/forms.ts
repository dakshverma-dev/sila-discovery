import { z } from "zod";
import { parsePounds } from "@/lib/domain/money";
import type { SessionDraft } from "./session";
import { fromLocal, toLocal, VENUE_TIME_ZONE, type LocalDate } from "./time";

const LONDON_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isLocalDate(value: string): value is LocalDate {
  const m = LOCAL_DATE.exec(value);
  return !!m && isRealDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/**
 * Reads a London wall-clock time typed into a form (`YYYY-MM-DDTHH:mm`, the
 * `datetime-local` format) as a UTC instant. Never uses `new Date(string)`, so
 * the server's own time zone is irrelevant. Returns null for any other format,
 * an impossible date, or a time skipped by the spring clock change.
 */
export function parseLondonDateTime(value: string): Date | null {
  const m = LONDON_DATE_TIME.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  if (!isRealDate(y, mo, d) || h > 23 || mi > 59) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const instant = fromLocal(date, h, mi);
  const back = toLocal(instant);
  if (back.date !== date || back.hour !== h || back.minute !== mi) return null;
  return instant;
}

/** Actual refund timestamps can include seconds, including within the closure minute (§18). */
export function parseLondonReturnTime(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const base = parseLondonDateTime(match[1]!);
  const seconds = Number(match[2] ?? 0);
  if (!base || seconds > 59) return null;
  return new Date(base.getTime() + seconds * 1000);
}

const LONDON_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIME_ZONE,
  hourCycle: "h23",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function londonParts(instant: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { type, value } of LONDON_PARTS.formatToParts(instant)) if (type !== "literal") out[type] = value;
  return out;
}

/** "Wednesday 4 November at 12:00 London": how every deadline and opening time is shown to people. */
export function formatLondon(instant: Date): string {
  const p = londonParts(instant);
  return `${p.weekday} ${p.day} ${p.month} at ${p.hour}:${p.minute} London`;
}

/** "Thursday 19 November": the London calendar day of an instant. */
export function formatLondonDay(instant: Date): string {
  const p = londonParts(instant);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "18:00 to 20:00": the London clock times of a session. */
export function formatLondonRange(start: Date, end: Date): string {
  const s = londonParts(start);
  const e = londonParts(end);
  return `${s.hour}:${s.minute} to ${e.hour}:${e.minute}`;
}

// ---------------------------------------------------------------- draft form

const text = (max: number) =>
  z.string().trim().max(max, `Use at most ${max} characters.`).nullable().transform((v) => (v ? v : null));

const wholeNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v) : v),
    z.int("Enter a whole number.").min(min, `Use ${min} or more.`).max(max, `Use ${max} or fewer.`),
  );

const londonDateTime = z.string().transform((value, ctx) => {
  const instant = parseLondonDateTime(value);
  if (!instant) {
    ctx.addIssue({ code: "custom", message: "Enter a London date and time as YYYY-MM-DDTHH:mm.", input: value });
    return z.NEVER;
  }
  return instant.toISOString();
});

const pounds = z.string().transform((value, ctx) => {
  const minor = parsePounds(value);
  if (minor === null || minor > 10_000_000) {
    ctx.addIssue({ code: "custom", message: "Enter an amount in pounds, such as 35.00.", input: value });
    return z.NEVER;
  }
  return minor;
});

const localDate = z.string().refine(isLocalDate, "Enter a date as YYYY-MM-DD.");

const httpsUrl = z
  .string()
  .trim()
  .max(2000, "Use at most 2000 characters.")
  .refine((v) => v === "" || (v.startsWith("https://") && URL.canParse(v)), "Enter an https:// address.")
  .nullable()
  .transform((v) => (v ? v : null));

/**
 * Editable fields of a dated session, as entered by the venue. Every field is
 * optional (absent fields are left unchanged); lifecycle fields such as phase,
 * version, payment dates and published_at are rejected. Datetimes are London
 * wall time; the price is a pounds string. The output uses the stored column
 * names (`price` becomes `price_minor`) and UTC ISO instants.
 */
export const sessionDraftSchema = z
  .strictObject({
    // Activity (offering) fields.
    title: z.string().trim().min(3, "Use 3 to 100 characters.").max(100, "Use 3 to 100 characters."),
    description: text(4000),
    inclusions: text(2000),
    image_url: httpsUrl,
    meeting_point: text(300),
    // Dated session fields.
    starts_at: londonDateTime,
    ends_at: londonDateTime,
    price: pounds,
    minimum: wholeNumber(1, 1000),
    capacity: wholeNumber(1, 1000),
    max_clubs: wholeNumber(1, 2),
    deposit_bp: wholeNumber(1, 10_000),
    payment_window_days: wholeNumber(1, 60),
    fill_by: londonDateTime,
    decision_by: londonDateTime,
    balance_due_at: londonDateTime,
    resource_name: text(200),
    hold_expires_at: londonDateTime.nullable(),
    hold_checked_by: text(200),
    covered_dates: z
      .array(localDate)
      .max(120, "Use at most 120 dates.")
      .transform((dates) => [...new Set(dates)].sort()),
    venue_terms_version: text(100),
    venue_terms_text: text(20_000),
    platform_terms_version: text(100),
    access_facts_reviewed: z.boolean(),
    run_at_minimum_approved: z.boolean(),
    payment_route: text(2000),
  })
  .partial()
  .transform(({ price, ...rest }) => (price === undefined ? rest : { ...rest, price_minor: price }));

export type SessionDraftInput = z.input<typeof sessionDraftSchema>;
/** Snake-case patch sent to `sila_api.save_session_draft` as `p_draft`. */
export type SessionDraftPatch = z.output<typeof sessionDraftSchema>;

// ---------------------------------------------------------------- stored row

export type SessionPhase = "draft" | "published" | "closed" | "confirmed" | "cancelled";

/** A `sila.sessions` row as `get_venue_session` returns it (timestamps are ISO strings). */
export interface VenueSessionRow {
  id: string;
  venue_id: string;
  version: number;
  phase: SessionPhase;
  terms_version: number;
  title: string;
  description: string | null;
  inclusions: string | null;
  image_url: string | null;
  meeting_point: string | null;
  starts_at: string;
  ends_at: string;
  price_minor: number;
  minimum: number;
  capacity: number;
  max_clubs: number;
  deposit_bp: number;
  payment_window_days: number;
  fill_by: string;
  decision_by: string;
  balance_due_at: string;
  resource_name: string | null;
  hold_expires_at: string | null;
  hold_checked_by: string | null;
  hold_checked_at: string | null;
  covered_dates: LocalDate[];
  venue_terms_version: string | null;
  venue_terms_text: string | null;
  platform_terms_version: string | null;
  access_facts_reviewed: boolean;
  run_at_minimum_approved: boolean;
  payment_route: string | null;
  calendar_version: string | null;
  intake_paused: boolean;
  intake_paused_reason: string | null;
  minimum_reached_at: string | null;
  payment_scheduled_for: string | null;
  payment_opened_at: string | null;
  pay_by: string | null;
  verify_by: string | null;
  payment_opening_blocked_reason: string | null;
  published_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  confirmed_at: string | null;
  created_by: string | null;
  updated_at: string;
}

/** Maps a stored session to the pure publication-rule input. */
export function toSessionDraft(row: VenueSessionRow): SessionDraft {
  return {
    title: row.title,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    priceMinor: row.price_minor,
    minimum: row.minimum,
    capacity: row.capacity,
    maxClubs: row.max_clubs,
    depositBasisPoints: row.deposit_bp,
    paymentWindowDays: row.payment_window_days,
    fillBy: new Date(row.fill_by),
    decisionBy: new Date(row.decision_by),
    balanceDueAt: new Date(row.balance_due_at),
    holdExpiresAt: row.hold_expires_at ? new Date(row.hold_expires_at) : null,
    holdCheckedBy: row.hold_checked_by,
    coveredDates: row.covered_dates.map((d) => d.slice(0, 10)),
    venueTermsVersion: row.venue_terms_version,
    platformTermsVersion: row.platform_terms_version,
    accessFactsReviewed: row.access_facts_reviewed,
    runAtMinimumApproved: row.run_at_minimum_approved,
  };
}

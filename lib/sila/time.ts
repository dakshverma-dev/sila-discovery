export const VENUE_TIME_ZONE = "Europe/London";

/** A venue-local calendar date as YYYY-MM-DD. */
export type LocalDate = string;

export interface LocalDateTime {
  date: LocalDate;
  hour: number;
  minute: number;
}

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parts(instant: Date) {
  const p: Record<string, number> = {};
  for (const { type, value } of formatter.formatToParts(instant)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function splitDate(date: LocalDate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid local date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function toLocal(instant: Date): LocalDateTime {
  const p = parts(instant);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, hour: p.hour, minute: p.minute };
}

function offsetAt(utcMs: number): number {
  const p = parts(new Date(utcMs));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

/** Resolves a London wall-clock time to its UTC instant. Deadlines never fall in the 01:00 DST gap. */
export function fromLocal(date: LocalDate, hour: number, minute = 0): Date {
  const [y, mo, d] = splitDate(date);
  const wall = Date.UTC(y, mo - 1, d, hour, minute);
  let utc = wall - offsetAt(wall);
  const corrected = offsetAt(utc);
  if (wall - utc !== corrected) utc = wall - corrected;
  return new Date(utc);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = splitDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: LocalDate): number {
  const [y, m, d] = splitDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Same London wall-clock time `days` local calendar days later (not a fixed number of hours). */
export function addLocalCalendarDays(instant: Date, days: number): Date {
  const l = toLocal(instant);
  return fromLocal(addDays(l.date, days), l.hour, l.minute);
}

export function noon(date: LocalDate): Date {
  return fromLocal(date, 12, 0);
}

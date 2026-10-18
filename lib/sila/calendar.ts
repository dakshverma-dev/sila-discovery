import { addDays, weekday, type LocalDate } from "./time";

/**
 * Scottish bank holidays (GOV.UK). Recheck against https://www.gov.uk/bank-holidays
 * before each live session and bump the version when the list changes.
 */
export const SCOTLAND_BANK_HOLIDAYS_VERSION = "scotland-2026-2027.v1";
export const SCOTLAND_BANK_HOLIDAYS: readonly LocalDate[] = [
  "2026-01-01", "2026-01-02", "2026-04-03", "2026-05-04", "2026-05-25",
  "2026-08-03", "2026-11-30", "2026-12-25", "2026-12-28",
  "2027-01-01", "2027-01-04", "2027-03-26", "2027-05-03", "2027-05-31",
  "2027-08-02", "2027-11-30", "2027-12-27", "2027-12-28",
];

export interface BusinessCalendar {
  version: string;
  holidays: ReadonlySet<LocalDate>;
  closures: ReadonlySet<LocalDate>;
}

export function scottishVenueCalendar(closures: readonly LocalDate[] = [], closureVersion = "none"): BusinessCalendar {
  return {
    version: `${SCOTLAND_BANK_HOLIDAYS_VERSION}+closures.${closureVersion}`,
    holidays: new Set(SCOTLAND_BANK_HOLIDAYS),
    closures: new Set(closures),
  };
}

export function isBusinessDay(cal: BusinessCalendar, date: LocalDate): boolean {
  const day = weekday(date);
  return day !== 0 && day !== 6 && !cal.holidays.has(date) && !cal.closures.has(date);
}

const SEARCH_LIMIT_DAYS = 60;

/** First business day strictly after `date`. */
export function nextBusinessDay(cal: BusinessCalendar, date: LocalDate): LocalDate {
  let d = date;
  for (let i = 0; i < SEARCH_LIMIT_DAYS; i++) {
    d = addDays(d, 1);
    if (isBusinessDay(cal, d)) return d;
  }
  throw new Error(`No business day within ${SEARCH_LIMIT_DAYS} days of ${date}`);
}

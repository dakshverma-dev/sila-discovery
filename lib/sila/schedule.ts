import { isBusinessDay, nextBusinessDay, type BusinessCalendar } from "./calendar";
import { addDays, addLocalCalendarDays, fromLocal, noon, toLocal, type LocalDate } from "./time";

export const PILOT_PAYMENT_WINDOW_DAYS = 5;
export const SAME_DAY_CUTOFF_HOUR = 11;
export const OPENING_HOUR = 11;
export const OPENING_MINUTE = 45;
export const FINAL_NOTICE_DAYS = 7;
export const MAX_CONDITIONAL_WAIT_DAYS = 21;
const SEARCH_LIMIT_DAYS = 60;

/** Venue business dates with an approved staffed cover record (guide §28). */
export type CoveredDates = ReadonlySet<LocalDate>;

function isCoveredBusinessDay(cal: BusinessCalendar, covered: CoveredDates, date: LocalDate): boolean {
  return isBusinessDay(cal, date) && covered.has(date);
}

/**
 * Earliest eligible staffed 11:45 opening after the minimum is reached (§12).
 * Same day only when reached strictly before 11:00 on a covered business day.
 * Returns null when no covered business day exists within the search horizon.
 */
export function scheduledPaymentOpening(
  minimumReachedAt: Date,
  cal: BusinessCalendar,
  covered: CoveredDates,
): Date | null {
  const local = toLocal(minimumReachedAt);
  if (local.hour < SAME_DAY_CUTOFF_HOUR && isCoveredBusinessDay(cal, covered, local.date)) {
    return fromLocal(local.date, OPENING_HOUR, OPENING_MINUTE);
  }
  let d = local.date;
  for (let i = 0; i < SEARCH_LIMIT_DAYS; i++) {
    d = addDays(d, 1);
    if (isCoveredBusinessDay(cal, covered, d)) return fromLocal(d, OPENING_HOUR, OPENING_MINUTE);
  }
  return null;
}

/** First business-day noon at or after `instant`. */
export function businessNoonAtOrAfter(instant: Date, cal: BusinessCalendar): Date {
  let d = toLocal(instant).date;
  for (let i = 0; i < SEARCH_LIMIT_DAYS; i++) {
    const candidate = noon(d);
    if (isBusinessDay(cal, d) && candidate.getTime() >= instant.getTime()) return candidate;
    d = addDays(d, 1);
  }
  throw new Error("No business-day noon within search horizon");
}

/** Add the window in local calendar days to the actual opening, then round forward to business-day noon. */
export function payByFor(paymentOpenedAt: Date, cal: BusinessCalendar, windowDays = PILOT_PAYMENT_WINDOW_DAYS): Date {
  return businessNoonAtOrAfter(addLocalCalendarDays(paymentOpenedAt, windowDays), cal);
}

/** Venue verification is due the next business day noon after pay-by. */
export function verifyByFor(payBy: Date, cal: BusinessCalendar): Date {
  return noon(nextBusinessDay(cal, toLocal(payBy).date));
}

export interface PaymentDeadlines {
  paymentOpenedAt: Date;
  payBy: Date;
  verifyBy: Date;
  /** Verification strictly precedes the final decision. */
  feasible: boolean;
}

/** Deadlines from the actual opening; recompute from a delayed opening rather than shrinking the window. */
export function paymentDeadlines(
  paymentOpenedAt: Date,
  decisionBy: Date,
  cal: BusinessCalendar,
  windowDays = PILOT_PAYMENT_WINDOW_DAYS,
): PaymentDeadlines {
  const payBy = payByFor(paymentOpenedAt, cal, windowDays);
  const verifyBy = verifyByFor(payBy, cal);
  return { paymentOpenedAt, payBy, verifyBy, feasible: verifyBy.getTime() < decisionBy.getTime() };
}

/**
 * Latest business-day noon fill deadline whose worst case (minimum reached exactly
 * at the noon cutoff, so no same-day release) still verifies before the final decision.
 */
export function latestFeasibleFillBy(
  decisionBy: Date,
  cal: BusinessCalendar,
  covered: CoveredDates,
  windowDays = PILOT_PAYMENT_WINDOW_DAYS,
): Date | null {
  let d = toLocal(decisionBy).date;
  for (let i = 0; i < SEARCH_LIMIT_DAYS; i++) {
    if (isBusinessDay(cal, d)) {
      const fillBy = noon(d);
      if (fillBy.getTime() < decisionBy.getTime()) {
        const opening = scheduledPaymentOpening(fillBy, cal, covered);
        if (opening && paymentDeadlines(opening, decisionBy, cal, windowDays).feasible) return fillBy;
      }
    }
    d = addDays(d, -1);
  }
  return null;
}

/** Final decision gives at least seven local calendar days before the workshop starts. */
export function hasFinalNotice(decisionBy: Date, startsAt: Date): boolean {
  return addLocalCalendarDays(decisionBy, FINAL_NOTICE_DAYS).getTime() <= startsAt.getTime();
}

/** The organiser may wait at most 21 local calendar days from commitment to the final decision. */
export function withinMaximumWait(committedAt: Date, decisionBy: Date): boolean {
  return decisionBy.getTime() <= addLocalCalendarDays(committedAt, MAX_CONDITIONAL_WAIT_DAYS).getTime();
}

export interface BalanceRemedySchedule {
  balanceDueAt: Date;
  noticeBy: Date;
  remedyPayBy: Date;
  remedyVerifyBy: Date;
  defaultDecisionAt: Date;
  practicalExportBy: Date;
}

/** Balance → notice → remedy pay → remedy verify, each the next business-day noon (§17). */
export function balanceRemedySchedule(balanceDueAt: Date, cal: BusinessCalendar): BalanceRemedySchedule {
  const step = (from: Date) => noon(nextBusinessDay(cal, toLocal(from).date));
  const noticeBy = step(balanceDueAt);
  const remedyPayBy = step(noticeBy);
  const remedyVerifyBy = step(remedyPayBy);
  const day = toLocal(remedyVerifyBy).date;
  return {
    balanceDueAt,
    noticeBy,
    remedyPayBy,
    remedyVerifyBy,
    defaultDecisionAt: fromLocal(day, 12, 15),
    practicalExportBy: fromLocal(day, 12, 30),
  };
}

/** Practical details must be exported over 24 hours before the workshop. */
export function remedyFitsBeforeEvent(schedule: BalanceRemedySchedule, startsAt: Date): boolean {
  return schedule.practicalExportBy.getTime() + 24 * 60 * 60 * 1000 <= startsAt.getTime();
}

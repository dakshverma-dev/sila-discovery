import { isBusinessDay, type BusinessCalendar } from "./calendar";
import {
  balanceRemedySchedule,
  hasFinalNotice,
  latestFeasibleFillBy,
  paymentDeadlines,
  PILOT_PAYMENT_WINDOW_DAYS,
  remedyFitsBeforeEvent,
  scheduledPaymentOpening,
  type CoveredDates,
} from "./schedule";
import { toLocal, type LocalDate } from "./time";

export const PILOT_MAX_CLUBS = 2;

export interface SessionDraft {
  title: string;
  startsAt: Date;
  endsAt: Date;
  priceMinor: number;
  minimum: number;
  capacity: number;
  maxClubs: number;
  depositBasisPoints: number;
  paymentWindowDays: number;
  fillBy: Date;
  decisionBy: Date;
  balanceDueAt: Date;
  holdExpiresAt: Date | null;
  holdCheckedBy: string | null;
  /** Business dates with an approved staffed coverage record. */
  coveredDates: readonly LocalDate[];
  venueTermsVersion: string | null;
  platformTermsVersion: string | null;
  accessFactsReviewed: boolean;
  /** Venue approved holding room and instructor and running at the minimum without public top-ups. */
  runAtMinimumApproved: boolean;
}

export type PublicationBlocker =
  | "TITLE_LENGTH"
  | "END_NOT_AFTER_START"
  | "DURATION_OUT_OF_RANGE"
  | "PRICE_NOT_POSITIVE"
  | "MINIMUM_NOT_POSITIVE"
  | "MINIMUM_ABOVE_CAPACITY"
  | "CLUB_LIMIT_OUT_OF_RANGE"
  | "DEPOSIT_OUT_OF_RANGE"
  | "PAYMENT_WINDOW_TOO_SHORT"
  | "DECISION_NOT_BUSINESS_NOON"
  | "FINAL_NOTICE_TOO_SHORT"
  | "FILL_BY_NOT_BUSINESS_NOON"
  | "FILL_BY_TOO_LATE"
  | "BALANCE_NOT_AFTER_DECISION"
  | "BALANCE_REMEDY_TOO_LATE"
  | "RESOURCE_HOLD_MISSING"
  | "RESOURCE_HOLD_TOO_SHORT"
  | "COVERAGE_MISSING"
  | "VENUE_TERMS_MISSING"
  | "PLATFORM_TERMS_MISSING"
  | "ACCESS_FACTS_UNREVIEWED"
  | "RUN_AT_MINIMUM_UNAPPROVED";

export interface PublicationCheck {
  blockers: PublicationBlocker[];
  /** Latest feasible fill deadline for this decision date, for guidance in the editor. */
  latestFillBy: Date | null;
  /** Business dates that must be covered: fill closure, worst-case opening, pay-by, verify-by, decision. */
  requiredCoverage: LocalDate[];
}

function isBusinessNoon(instant: Date, cal: BusinessCalendar): boolean {
  const l = toLocal(instant);
  return l.hour === 12 && l.minute === 0 && isBusinessDay(cal, l.date);
}

/** Publication gates from guide §04, §13 and §23. A draft may still be shared privately. */
export function checkPublication(draft: SessionDraft, cal: BusinessCalendar): PublicationCheck {
  const blockers: PublicationBlocker[] = [];
  const covered: CoveredDates = new Set(draft.coveredDates);
  const title = draft.title.trim();
  if (title.length < 3 || title.length > 100) blockers.push("TITLE_LENGTH");

  const durationMin = (draft.endsAt.getTime() - draft.startsAt.getTime()) / 60_000;
  if (durationMin <= 0) blockers.push("END_NOT_AFTER_START");
  else if (durationMin < 30 || durationMin > 480) blockers.push("DURATION_OUT_OF_RANGE");

  if (!Number.isSafeInteger(draft.priceMinor) || draft.priceMinor <= 0) blockers.push("PRICE_NOT_POSITIVE");
  if (!Number.isSafeInteger(draft.minimum) || draft.minimum <= 0) blockers.push("MINIMUM_NOT_POSITIVE");
  else if (draft.minimum > draft.capacity) blockers.push("MINIMUM_ABOVE_CAPACITY");
  if (!Number.isSafeInteger(draft.maxClubs) || draft.maxClubs < 1 || draft.maxClubs > PILOT_MAX_CLUBS) {
    blockers.push("CLUB_LIMIT_OUT_OF_RANGE");
  }
  if (!Number.isSafeInteger(draft.depositBasisPoints) || draft.depositBasisPoints <= 0 || draft.depositBasisPoints > 10_000) {
    blockers.push("DEPOSIT_OUT_OF_RANGE");
  }
  if (!Number.isSafeInteger(draft.paymentWindowDays) || draft.paymentWindowDays < PILOT_PAYMENT_WINDOW_DAYS) {
    blockers.push("PAYMENT_WINDOW_TOO_SHORT");
  }
  const windowDays = Math.max(draft.paymentWindowDays, PILOT_PAYMENT_WINDOW_DAYS);

  if (!isBusinessNoon(draft.decisionBy, cal)) blockers.push("DECISION_NOT_BUSINESS_NOON");
  if (!hasFinalNotice(draft.decisionBy, draft.startsAt)) blockers.push("FINAL_NOTICE_TOO_SHORT");

  const latestFillBy = latestFeasibleFillBy(draft.decisionBy, cal, covered, windowDays);
  if (!isBusinessNoon(draft.fillBy, cal)) blockers.push("FILL_BY_NOT_BUSINESS_NOON");
  else if (!latestFillBy || draft.fillBy.getTime() > latestFillBy.getTime()) blockers.push("FILL_BY_TOO_LATE");

  if (draft.balanceDueAt.getTime() <= draft.decisionBy.getTime()) blockers.push("BALANCE_NOT_AFTER_DECISION");
  else if (!remedyFitsBeforeEvent(balanceRemedySchedule(draft.balanceDueAt, cal), draft.startsAt)) {
    blockers.push("BALANCE_REMEDY_TOO_LATE");
  }

  if (!draft.holdExpiresAt || !draft.holdCheckedBy) blockers.push("RESOURCE_HOLD_MISSING");
  else if (draft.holdExpiresAt.getTime() < draft.decisionBy.getTime()) blockers.push("RESOURCE_HOLD_TOO_SHORT");

  const requiredCoverage = coverageDatesFor(draft.fillBy, draft.decisionBy, cal, covered, windowDays);
  if (requiredCoverage.length === 0 || requiredCoverage.some((d) => !covered.has(d))) blockers.push("COVERAGE_MISSING");

  if (!draft.venueTermsVersion) blockers.push("VENUE_TERMS_MISSING");
  if (!draft.platformTermsVersion) blockers.push("PLATFORM_TERMS_MISSING");
  if (!draft.accessFactsReviewed) blockers.push("ACCESS_FACTS_UNREVIEWED");
  if (!draft.runAtMinimumApproved) blockers.push("RUN_AT_MINIMUM_UNAPPROVED");

  return { blockers, latestFillBy, requiredCoverage };
}

function coverageDatesFor(
  fillBy: Date,
  decisionBy: Date,
  cal: BusinessCalendar,
  covered: CoveredDates,
  windowDays: number,
): LocalDate[] {
  const opening = scheduledPaymentOpening(fillBy, cal, covered);
  if (!opening) return [];
  const { payBy, verifyBy } = paymentDeadlines(opening, decisionBy, cal, windowDays);
  const dates = [fillBy, opening, payBy, verifyBy, decisionBy].map((i) => toLocal(i).date);
  return [...new Set(dates)];
}

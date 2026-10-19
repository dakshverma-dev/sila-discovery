import { nextBusinessDay, type BusinessCalendar } from "./calendar";
import { noon, toLocal } from "./time";

/** Guide §18: five business days from closure, at venue-local noon. */
export function refundTarget(closedAt: Date, calendar: BusinessCalendar): Date {
  let day = toLocal(closedAt).date;
  for (let i = 0; i < 5; i++) day = nextBusinessDay(calendar, day);
  return noon(day);
}

/** Money is retained separately from capacity and confirmation (§17–§18). */
export function refundBalance(receivedMinor: number, refundedMinor: number, assessedChargeMinor = 0) {
  for (const value of [receivedMinor, refundedMinor, assessedChargeMinor]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Use non-negative integer GBP minor units");
  }
  const liabilityMinor = Math.max(0, receivedMinor - assessedChargeMinor);
  return { liabilityMinor, dueMinor: Math.max(0, liabilityMinor - refundedMinor),
    overRefundedMinor: Math.max(0, refundedMinor - liabilityMinor) };
}

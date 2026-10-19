import { describe, expect, it } from "vitest";
import { scottishVenueCalendar } from "@/lib/sila/calendar";
import { refundBalance, refundTarget } from "@/lib/sila/refund";
describe("refund obligations (guide §18, §29)", () => {
  it("reproduces the worked target and skips holidays, closures and clock changes", () => {
    expect(refundTarget(new Date("2026-11-12T12:00:00Z"), scottishVenueCalendar()).toISOString()).toBe("2026-11-19T12:00:00.000Z");
    expect(refundTarget(new Date("2026-10-23T11:00:00Z"), scottishVenueCalendar()).toISOString()).toBe("2026-10-30T12:00:00.000Z");
    expect(refundTarget(new Date("2026-12-24T12:00:00Z"), scottishVenueCalendar(["2026-12-29"])).toISOString()).toBe("2027-01-07T12:00:00.000Z");
  });
  it("includes late and partial receipts without labelling unpaid returns refunded", () => {
    expect(refundBalance(6125, 0)).toEqual({ liabilityMinor: 6125, dueMinor: 6125, overRefundedMinor: 0 });
    expect(refundBalance(7125, 6125).dueMinor).toBe(1000);
    expect(refundBalance(6125, 6125).dueMinor).toBe(0);
    expect(refundBalance(5000, 6125).overRefundedMinor).toBe(1125);
    expect(() => refundBalance(-1, 0)).toThrow(RangeError);
  });
});

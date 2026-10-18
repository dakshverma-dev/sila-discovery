import { describe, expect, it } from "vitest";
import { isBusinessDay, scottishVenueCalendar } from "@/lib/sila/calendar";
import {
  balanceRemedySchedule,
  hasFinalNotice,
  latestFeasibleFillBy,
  paymentDeadlines,
  remedyFitsBeforeEvent,
  scheduledPaymentOpening,
  withinMaximumWait,
} from "@/lib/sila/schedule";
import { addDays, fromLocal, toLocal } from "@/lib/sila/time";

const cal = scottishVenueCalendar();
const london = (date: string, h: number, m = 0) => fromLocal(date, h, m);
const local = (d: Date) => {
  const l = toLocal(d);
  return `${l.date} ${String(l.hour).padStart(2, "0")}:${String(l.minute).padStart(2, "0")}`;
};

function allBusinessDays(from: string, to: string): Set<string> {
  const out = new Set<string>();
  for (let d = from; d <= to; d = addDays(d, 1)) if (isBusinessDay(cal, d)) out.add(d);
  return out;
}
const covered = allBusinessDays("2026-10-01", "2027-01-31");

describe("London time conversion", () => {
  it("resolves GMT and BST wall-clock times to UTC", () => {
    expect(london("2026-11-04", 12).toISOString()).toBe("2026-11-04T12:00:00.000Z");
    expect(london("2026-10-22", 12).toISOString()).toBe("2026-10-22T11:00:00.000Z");
  });

  it("keeps local wall time across the October clock change", () => {
    const opened = london("2026-10-22", 11, 45);
    const { payBy } = paymentDeadlines(opened, london("2026-11-12", 12), cal);
    expect(local(payBy)).toBe("2026-10-27 12:00");
    expect(payBy.toISOString()).toBe("2026-10-27T12:00:00.000Z");
  });
});

describe("guide §12 and §29 reference session", () => {
  const decisionBy = london("2026-11-12", 12);

  it("B committing at 11:00 on fill day opens payment the next business day at 11:45", () => {
    const opening = scheduledPaymentOpening(london("2026-11-04", 11), cal, covered);
    expect(opening && local(opening)).toBe("2026-11-05 11:45");
  });

  it("clubs pay by Tuesday 10 noon and the venue verifies by Wednesday 11 noon", () => {
    const d = paymentDeadlines(london("2026-11-05", 11, 45), decisionBy, cal);
    expect(local(d.payBy)).toBe("2026-11-10 12:00");
    expect(local(d.verifyBy)).toBe("2026-11-11 12:00");
    expect(d.feasible).toBe(true);
  });

  it("4 November noon is the latest feasible fill deadline", () => {
    const fillBy = latestFeasibleFillBy(decisionBy, cal, covered);
    expect(fillBy && local(fillBy)).toBe("2026-11-04 12:00");
  });

  it("a 5 November fill would verify at the decision, not strictly before it", () => {
    const opening = scheduledPaymentOpening(london("2026-11-05", 12), cal, covered)!;
    expect(paymentDeadlines(opening, decisionBy, cal).feasible).toBe(false);
  });

  it("a longer approved window moves the latest fill date earlier", () => {
    const fillBy = latestFeasibleFillBy(decisionBy, cal, covered, 7);
    expect(fillBy!.getTime()).toBeLessThan(london("2026-11-04", 12).getTime());
  });

  it("final decision gives at least seven days before the 19 November workshop", () => {
    expect(hasFinalNotice(decisionBy, london("2026-11-19", 18))).toBe(true);
    expect(hasFinalNotice(london("2026-11-13", 12), london("2026-11-19", 18))).toBe(false);
  });

  it("A may commit from 22 October noon for a 12 November decision, not earlier", () => {
    expect(withinMaximumWait(london("2026-10-22", 12), decisionBy)).toBe(true);
    expect(withinMaximumWait(london("2026-10-22", 11, 59), decisionBy)).toBe(false);
    expect(withinMaximumWait(london("2026-10-24", 10), decisionBy)).toBe(true);
  });

  it("balance remedy sequence ends Wednesday 18 with export over 24h before the workshop", () => {
    const s = balanceRemedySchedule(london("2026-11-13", 12), cal);
    expect(local(s.noticeBy)).toBe("2026-11-16 12:00");
    expect(local(s.remedyPayBy)).toBe("2026-11-17 12:00");
    expect(local(s.remedyVerifyBy)).toBe("2026-11-18 12:00");
    expect(local(s.defaultDecisionAt)).toBe("2026-11-18 12:15");
    expect(local(s.practicalExportBy)).toBe("2026-11-18 12:30");
    expect(remedyFitsBeforeEvent(s, london("2026-11-19", 18))).toBe(true);
  });
});

describe("P0 05 acceptance: same-day cutoff", () => {
  it("a Monday 09:00 minimum opens Monday", () => {
    const opening = scheduledPaymentOpening(london("2026-11-02", 9), cal, covered);
    expect(opening && local(opening)).toBe("2026-11-02 11:45");
  });

  it("a Friday 11:00 minimum waits until Monday", () => {
    const opening = scheduledPaymentOpening(london("2026-11-06", 11), cal, covered);
    expect(opening && local(opening)).toBe("2026-11-09 11:45");
  });

  it("neither loses payment time: both get at least five local calendar days", () => {
    for (const opened of [london("2026-11-02", 11, 45), london("2026-11-09", 11, 45)]) {
      const { payBy } = paymentDeadlines(opened, london("2026-12-31", 12), cal);
      expect(payBy.getTime() - opened.getTime()).toBeGreaterThanOrEqual(5 * 24 * 3600 * 1000);
    }
  });

  it("10:59 opens same day but 11:00 exactly does not", () => {
    expect(local(scheduledPaymentOpening(london("2026-11-03", 10, 59), cal, covered)!)).toBe("2026-11-03 11:45");
    expect(local(scheduledPaymentOpening(london("2026-11-03", 11), cal, covered)!)).toBe("2026-11-04 11:45");
  });

  it("no same-day release without approved same-day cover", () => {
    const partial = new Set([...covered].filter((d) => d !== "2026-11-03"));
    expect(local(scheduledPaymentOpening(london("2026-11-03", 9), cal, partial)!)).toBe("2026-11-04 11:45");
  });

  it("returns null when no covered day exists rather than opening uncovered", () => {
    expect(scheduledPaymentOpening(london("2026-11-03", 9), cal, new Set())).toBeNull();
  });
});

describe("§27: deadlines crossing weekends and holidays", () => {
  it("St Andrew's Day (Mon 30 Nov 2026) is not a business day", () => {
    expect(isBusinessDay(cal, "2026-11-30")).toBe(false);
  });

  it("a pay-by landing on a weekend rolls forward past the bank holiday", () => {
    const { payBy, verifyBy } = paymentDeadlines(london("2026-11-23", 11, 45), london("2026-12-31", 12), cal);
    expect(local(payBy)).toBe("2026-12-01 12:00");
    expect(local(verifyBy)).toBe("2026-12-02 12:00");
  });

  it("venue closure dates are not business days", () => {
    const withClosure = scottishVenueCalendar(["2026-11-10"], "test");
    const { payBy } = paymentDeadlines(london("2026-11-05", 11, 45), london("2026-11-20", 12), withClosure);
    expect(local(payBy)).toBe("2026-11-11 12:00");
  });
});

import { describe, expect, it } from "vitest";
import { isBusinessDay, scottishVenueCalendar } from "@/lib/sila/calendar";
import { checkCommit, withdrawalOutcome, type CommitInput } from "@/lib/sila/commitment";
import { confirmationBlockers, isTimely } from "@/lib/sila/confirmation";
import { formatGBP, groupAmounts } from "@/lib/sila/money";
import { checkPublication, type SessionDraft } from "@/lib/sila/session";
import { derivePlanStatus, type PlanFacts } from "@/lib/sila/status";
import { addDays, fromLocal } from "@/lib/sila/time";

const cal = scottishVenueCalendar();
const london = (date: string, h: number, m = 0) => fromLocal(date, h, m);

describe("§18 and §29 money", () => {
  it("matches the worked session at GBP 35 with a 25% deposit", () => {
    expect(groupAmounts(3500, 7, 2500)).toEqual({ totalMinor: 24500, depositMinor: 6125, balanceMinor: 18375 });
    expect(groupAmounts(3500, 9, 2500)).toEqual({ totalMinor: 31500, depositMinor: 7875, balanceMinor: 23625 });
  });

  it("rounds a percentage deposit half up once per group", () => {
    expect(groupAmounts(1001, 1, 2500).depositMinor).toBe(250);
    expect(groupAmounts(1002, 1, 2500).depositMinor).toBe(251);
    const g = groupAmounts(3333, 3, 3333);
    expect(g.depositMinor + g.balanceMinor).toBe(g.totalMinor);
  });

  it("formats GBP for display", () => {
    expect(formatGBP(6125)).toBe("GBP 61.25");
  });
});

function coveredBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isBusinessDay(cal, d)) out.push(d);
  return out;
}

const referenceDraft: SessionDraft = {
  title: "Printmaking for clubs",
  startsAt: london("2026-11-19", 18),
  endsAt: london("2026-11-19", 20),
  priceMinor: 3500,
  minimum: 16,
  capacity: 20,
  maxClubs: 2,
  depositBasisPoints: 2500,
  paymentWindowDays: 5,
  fillBy: london("2026-11-04", 12),
  decisionBy: london("2026-11-12", 12),
  balanceDueAt: london("2026-11-13", 12),
  holdExpiresAt: london("2026-11-12", 12),
  holdCheckedBy: "coordinator",
  coveredDates: coveredBetween("2026-11-04", "2026-11-12"),
  venueTermsVersion: "venue-v1",
  platformTermsVersion: "platform-v1",
  accessFactsReviewed: true,
  runAtMinimumApproved: true,
};

describe("§04 and §23 publication gates", () => {
  it("the reference session can publish", () => {
    expect(checkPublication(referenceDraft, cal).blockers).toEqual([]);
  });

  it("an infeasible fill deadline cannot publish", () => {
    const r = checkPublication({ ...referenceDraft, fillBy: london("2026-11-05", 12) }, cal);
    expect(r.blockers).toContain("FILL_BY_TOO_LATE");
  });

  it("a decision less than seven days before the workshop cannot publish", () => {
    const r = checkPublication({ ...referenceDraft, decisionBy: london("2026-11-13", 12) }, cal);
    expect(r.blockers).toContain("FINAL_NOTICE_TOO_SHORT");
  });

  it("rejects a shorter payment window rather than truncating it", () => {
    expect(checkPublication({ ...referenceDraft, paymentWindowDays: 4 }, cal).blockers).toContain("PAYMENT_WINDOW_TOO_SHORT");
  });

  it("requires the hold through the decision, coverage, terms and run-at-minimum approval", () => {
    const r = checkPublication(
      {
        ...referenceDraft,
        holdExpiresAt: london("2026-11-11", 12),
        coveredDates: [],
        venueTermsVersion: null,
        runAtMinimumApproved: false,
      },
      cal,
    );
    expect(r.blockers).toEqual(
      expect.arrayContaining(["RESOURCE_HOLD_TOO_SHORT", "COVERAGE_MISSING", "VENUE_TERMS_MISSING", "RUN_AT_MINIMUM_UNAPPROVED"]),
    );
  });

  it("rejects more than two clubs and minimum above capacity", () => {
    const r = checkPublication({ ...referenceDraft, maxClubs: 3, minimum: 21 }, cal);
    expect(r.blockers).toEqual(expect.arrayContaining(["CLUB_LIMIT_OUT_OF_RANGE", "MINIMUM_ABOVE_CAPACITY"]));
  });
});

const baseCommit: CommitInput = {
  now: london("2026-10-24", 10),
  planId: "A",
  session: {
    phase: "published",
    termsVersion: 1,
    fillBy: london("2026-11-04", 12),
    decisionBy: london("2026-11-12", 12),
    minimum: 16,
    capacity: 20,
    maxClubs: 2,
    intakePaused: false,
    minimumReachedAt: null,
  },
  approval: { quantity: 7, termsVersion: 1 },
  request: { quantity: 7, termsVersion: 1 },
  liveAllocations: [],
};

describe("§15 commitment rules", () => {
  it("Club A commits seven and waits", () => {
    expect(checkCommit(baseCommit)).toEqual({ ok: true, placesAfter: 7, reachesMinimum: false });
  });

  it("Club B committing nine reaches the minimum", () => {
    const r = checkCommit({
      ...baseCommit,
      now: london("2026-11-04", 11),
      planId: "B",
      approval: { quantity: 9, termsVersion: 1 },
      request: { quantity: 9, termsVersion: 1 },
      liveAllocations: [{ planId: "A", places: 7 }],
    });
    expect(r).toEqual({ ok: true, placesAfter: 16, reachesMinimum: true });
  });

  it("a second club of eight cannot complete a 7-place session needing 16", () => {
    const r = checkCommit({
      ...baseCommit,
      planId: "B",
      approval: { quantity: 8, termsVersion: 1 },
      request: { quantity: 8, termsVersion: 1 },
      liveAllocations: [{ planId: "A", places: 7 }],
    });
    expect(r).toMatchObject({ ok: false, reason: "SECOND_CLUB_BELOW_MINIMUM" });
  });

  it("a commit exactly at fill_by is accepted; one after is rejected", () => {
    const at = { ...baseCommit, now: london("2026-11-04", 12) };
    expect(checkCommit(at).ok).toBe(true);
    const after = { ...baseCommit, now: new Date(london("2026-11-04", 12).getTime() + 1) };
    expect(checkCommit(after)).toMatchObject({ ok: false, reason: "FILL_DEADLINE_PASSED" });
  });

  it("an old invitation on different terms is blocked", () => {
    expect(checkCommit({ ...baseCommit, request: { quantity: 7, termsVersion: 0 } })).toMatchObject({
      ok: false,
      reason: "STALE_TERMS",
    });
  });

  it("an unapproved request or a different quantity cannot commit", () => {
    expect(checkCommit({ ...baseCommit, approval: null })).toMatchObject({ reason: "NOT_APPROVED" });
    expect(checkCommit({ ...baseCommit, request: { quantity: 8, termsVersion: 1 } })).toMatchObject({
      reason: "QUANTITY_NOT_APPROVED",
      status: 422,
    });
  });

  it("enforces capacity, the two-club limit, pause, frozen set and duplicate plans", () => {
    const two = [{ planId: "A", places: 7 }, { planId: "B", places: 9 }];
    expect(checkCommit({ ...baseCommit, planId: "C", liveAllocations: two })).toMatchObject({ reason: "CLUB_LIMIT_REACHED" });
    expect(
      checkCommit({
        ...baseCommit,
        planId: "B",
        approval: { quantity: 14, termsVersion: 1 },
        request: { quantity: 14, termsVersion: 1 },
        liveAllocations: [{ planId: "A", places: 7 }],
      }),
    ).toMatchObject({ reason: "CAPACITY_EXCEEDED" });
    expect(checkCommit({ ...baseCommit, session: { ...baseCommit.session, intakePaused: true } })).toMatchObject({
      reason: "INTAKE_PAUSED",
    });
    expect(
      checkCommit({ ...baseCommit, session: { ...baseCommit.session, minimumReachedAt: london("2026-11-02", 9) } }),
    ).toMatchObject({ reason: "MINIMUM_ALREADY_REACHED" });
    expect(checkCommit({ ...baseCommit, liveAllocations: [{ planId: "A", places: 7 }] })).toMatchObject({
      reason: "ALREADY_COMMITTED",
    });
  });

  it("rejects a commitment that would wait more than 21 days", () => {
    expect(checkCommit({ ...baseCommit, now: london("2026-10-20", 12) })).toMatchObject({ reason: "WAIT_EXCEEDS_LIMIT" });
  });

  it("a single club large enough to meet the minimum uses the same journey", () => {
    const r = checkCommit({ ...baseCommit, approval: { quantity: 16, termsVersion: 1 }, request: { quantity: 16, termsVersion: 1 } });
    expect(r).toEqual({ ok: true, placesAfter: 16, reachesMinimum: true });
  });
});

describe("§15 withdrawal", () => {
  it("before payment opens, a minimum-breaking withdrawal cancels the scheduled opening", () => {
    expect(withdrawalOutcome({ paymentOpenedAt: null, placesAfterWithdrawal: 7, minimum: 16, paymentScheduled: true })).toEqual({
      kind: "released",
      cancelScheduledOpening: true,
    });
  });

  it("after payment opens, withdrawal goes to venue review with no automatic reset", () => {
    expect(
      withdrawalOutcome({ paymentOpenedAt: london("2026-11-05", 11, 45), placesAfterWithdrawal: 7, minimum: 16, paymentScheduled: true }),
    ).toEqual({ kind: "venue_review" });
  });
});

describe("§17 and §29 receipts and confirmation", () => {
  const payBy = london("2026-11-10", 12);

  it("B's deposit at 11:00 on pay-by day is timely even though verified the next day", () => {
    expect(isTimely(london("2026-11-10", 11), payBy)).toBe(true);
    expect(isTimely(london("2026-11-10", 12, 1), payBy)).toBe(false);
  });

  const input = {
    now: london("2026-11-11", 10),
    minimum: 16,
    decisionBy: london("2026-11-12", 12),
    holdExpiresAt: london("2026-11-12", 12),
    externalDiaryCheckedAt: london("2026-11-11", 9, 30),
    paymentOpenedAt: london("2026-11-05", 11, 45),
    allocations: [
      { allocationId: "A", places: 7, depositMinor: 6125 },
      { allocationId: "B", places: 9, depositMinor: 7875 },
    ],
    receipts: [
      { allocationId: "A", kind: "deposit" as const, amountMinor: 6125, receiptId: "RC-2026-A", receivedAt: london("2026-11-09", 10), verifiedAt: london("2026-11-11", 9) },
      { allocationId: "B", kind: "deposit" as const, amountMinor: 7875, receiptId: "RC-2026-B", receivedAt: london("2026-11-10", 11), verifiedAt: london("2026-11-11", 9, 15) },
    ],
  };

  it("confirms when both deposits are verified, the hold is valid and the diary is checked", () => {
    expect(confirmationBlockers(input)).toEqual([]);
  });

  it("a final receipt with a failed resource check is blocked, naming the blocker", () => {
    expect(confirmationBlockers({ ...input, holdExpiresAt: london("2026-11-10", 12) })).toEqual([{ code: "RESOURCE_HOLD_EXPIRED" }]);
  });

  it("names the allocation whose deposit is still unverified", () => {
    expect(confirmationBlockers({ ...input, receipts: input.receipts.slice(0, 1) })).toEqual([
      { code: "DEPOSIT_NOT_VERIFIED", allocationId: "B" },
    ]);
  });
});

describe("§16 plan status", () => {
  const facts: PlanFacts = {
    submitted: true,
    approved: true,
    committed: true,
    closed: false,
    minimumReached: false,
    openingBlocked: false,
    paymentOpened: false,
    ownPaymentReported: false,
    ownDepositVerified: false,
    allDepositsVerified: false,
    confirmed: false,
    balanceDefaultEstablished: false,
    amendmentPending: false,
  };

  it("walks the shared session from waiting to confirmed", () => {
    expect(derivePlanStatus(facts)).toBe("waiting_for_more_places");
    expect(derivePlanStatus({ ...facts, minimumReached: true })).toBe("payment_scheduled");
    expect(derivePlanStatus({ ...facts, minimumReached: true, openingBlocked: true })).toBe("payment_delayed");
    expect(derivePlanStatus({ ...facts, minimumReached: true, paymentOpened: true })).toBe("deposit_due");
    expect(derivePlanStatus({ ...facts, minimumReached: true, paymentOpened: true, ownPaymentReported: true })).toBe(
      "verification_pending",
    );
    expect(derivePlanStatus({ ...facts, minimumReached: true, paymentOpened: true, ownDepositVerified: true })).toBe(
      "waiting_for_another_deposit",
    );
    expect(
      derivePlanStatus({ ...facts, minimumReached: true, paymentOpened: true, ownDepositVerified: true, allDepositsVerified: true }),
    ).toBe("waiting_for_confirmation");
    expect(derivePlanStatus({ ...facts, confirmed: true })).toBe("confirmed");
  });

  it("never says confirmed for an approved or committed plan", () => {
    expect(derivePlanStatus({ ...facts, committed: false })).toBe("review_conditions");
    expect(derivePlanStatus({ ...facts, approved: false })).toBe("waiting_for_venue_approval");
  });

  it("a closed session shows not proceeding", () => {
    expect(derivePlanStatus({ ...facts, closed: true })).toBe("not_proceeding");
  });
});

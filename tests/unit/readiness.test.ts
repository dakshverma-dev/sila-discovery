import { describe, expect, it } from "vitest";
import { readiness, type ReadinessInput } from "@/lib/domain/readiness";
import { canTransition, holdsSlot, isTerminal } from "@/lib/domain/lifecycle";

const base: ReadinessInput = {
  organiser_acceptances: [true, true, true],
  active_seats: 24,
  required_seats: 24,
  capacity: 30,
  now: new Date("2026-12-01T10:00:00Z"),
  reservation_deadline: new Date("2026-12-03T10:00:00Z"),
  quote_is_current: true,
  slot_held_by_proposal: true,
};

describe("readiness predicate (D14)", () => {
  it("is ready when every guard passes", () => {
    expect(readiness(base)).toEqual({ ready: true, blockers: [] });
  });

  it("reverts when a withdrawal drops seats below the threshold", () => {
    expect(readiness({ ...base, active_seats: 23 })).toEqual({
      ready: false,
      blockers: ["SEATS_BELOW_REQUIRED"],
    });
  });

  it.each<[string, Partial<ReadinessInput>, string]>([
    ["a declined organiser", { organiser_acceptances: [true, false, true] }, "ORGANISER_ACCEPTANCE_MISSING"],
    ["no included groups", { organiser_acceptances: [] }, "NO_INCLUDED_GROUPS"],
    ["seats over capacity", { active_seats: 31 }, "SEATS_EXCEED_CAPACITY"],
    ["the deadline reached", { now: base.reservation_deadline }, "DEADLINE_PASSED"],
    ["a stale quote", { quote_is_current: false }, "QUOTE_NOT_CURRENT"],
    ["a released slot", { slot_held_by_proposal: false }, "SLOT_NOT_HELD"],
  ])("is not ready with %s", (_, patch, blocker) => {
    const r = readiness({ ...base, ...patch });
    expect(r.ready).toBe(false);
    expect(r.blockers).toContain(blocker);
  });
});

describe("proposal lifecycle (D14)", () => {
  it("allows the documented transitions", () => {
    expect(canTransition("DRAFT", "OPEN")).toBe(true);
    expect(canTransition("READY", "OPEN")).toBe(true);
    expect(canTransition("READY", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "COMPLETED")).toBe(true);
  });

  it("rejects skipping readiness or reviving terminal states", () => {
    expect(canTransition("OPEN", "CONFIRMED")).toBe(false);
    expect(canTransition("DRAFT", "READY")).toBe(false);
    expect(canTransition("CONFIRMED", "OPEN")).toBe(false);
    expect(canTransition("EXPIRED", "OPEN")).toBe(false);
    expect(isTerminal("CANCELLED")).toBe(true);
  });

  it("holds the slot only while open, ready or confirmed", () => {
    expect(holdsSlot("DRAFT")).toBe(false);
    expect(holdsSlot("READY")).toBe(true);
    expect(holdsSlot("CONFIRMED")).toBe(true);
    expect(holdsSlot("EXPIRED")).toBe(false);
  });
});

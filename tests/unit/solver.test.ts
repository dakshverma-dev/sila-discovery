import { describe, expect, it } from "vitest";
import { solve, type SolverInput } from "@/lib/domain/solver";
import { syntheticSolverInput, SYNTHETIC_EXPECTED } from "@/lib/demo/synthetic-fixture";
import type { GroupBrief } from "@/lib/domain/types";

function fixture(): SolverInput {
  return structuredClone(syntheticSolverInput());
}

function withGroup(input: SolverInput, index: number, patch: Partial<GroupBrief>): SolverInput {
  const groups = input.groups.map((g, i) => (i === index ? { ...g, ...patch } : g));
  return { ...input, groups };
}

describe("coalition solver (D13, BR03-BR06)", () => {
  it("finds the single feasible three-group coalition in the fixture", () => {
    const { candidates, feasible_count } = solve(fixture());
    expect(feasible_count).toBe(1);
    expect(candidates).toHaveLength(1);
    const c = candidates[0]!;
    expect(c.group_ids).toEqual(["group_a", "group_b", "group_c"]);
    expect(c.required_seats).toBe(SYNTHETIC_EXPECTED.required_seats);
    expect(c.planned_seats).toBe(SYNTHETIC_EXPECTED.planned_seats);
    expect(c.economics.surplus_pence).toBe(SYNTHETIC_EXPECTED.quoted_surplus_pence);
    expect(c.status).toBe("DRAFT");
    expect(c.cultural_score).toBeCloseTo(0.55);
    expect(c.source_mode).toBe("synthetic");
    expect(c.payment_status).toBe("NOT_COLLECTED");
  });

  it("excludes a group whose budget is below the all-in ticket price", () => {
    const r = solve(withGroup(fixture(), 0, { budget_pence: 1000 }));
    expect(r.candidates).toEqual([]);
    expect(r.slot_reports[0]!.group_blockers.group_a).toContain("BUDGET_BELOW_PRICE");
  });

  it("asks for clarification instead of exceeding capacity", () => {
    const input = fixture();
    const offer = input.offers[0]!;
    const r = solve({
      ...input,
      offers: [{ ...offer, slots: [{ ...offer.slots[0]!, capacity: 24 }] }],
    });
    expect(r.candidates).toEqual([]);
    expect(r.slot_reports[0]!.slot_blockers).toContain("CAPACITY_NEEDS_CLARIFICATION");
  });

  it("reports an infeasible quote when capacity is below the self-funding threshold", () => {
    const input = fixture();
    const offer = input.offers[0]!;
    const r = solve({
      ...input,
      offers: [{ ...offer, slots: [{ ...offer.slots[0]!, capacity: 23 }] }],
    });
    expect(r.candidates).toEqual([]);
    expect(r.slot_reports[0]!.slot_blockers).toEqual(["QUOTE_INFEASIBLE"]);
  });

  it("requires availability that fully contains the slot", () => {
    const r = solve(withGroup(fixture(), 0, { availability: [] }));
    expect(r.candidates).toEqual([]);
    const partial = solve(
      withGroup(fixture(), 1, {
        availability: [{ start_at: "2026-12-05T14:30:00Z", end_at: "2026-12-05T16:00:00Z" }],
      }),
    );
    expect(partial.slot_reports[0]!.group_blockers.group_b).toEqual(["TIME_UNAVAILABLE"]);
  });

  it("blocks access requirements the venue has not explicitly confirmed", () => {
    const input = fixture();
    const offer = input.offers[0]!;
    const r = solve({
      ...input,
      offers: [{ ...offer, experience: { ...offer.experience, access_support: ["seating"] } }],
    });
    expect(r.candidates).toEqual([]);
    expect(r.slot_reports[0]!.group_blockers.group_c).toEqual(["ACCESS_UNSUPPORTED"]);
  });

  it.each(["PRIVATE_ONLY", "ASK_FIRST"] as const)(
    "never includes a group whose sharing choice is %s",
    (sharing) => {
      const r = solve(withGroup(fixture(), 0, { sharing }));
      expect(r.candidates).toEqual([]);
      expect(r.slot_reports[0]!.group_blockers.group_a).toEqual(["SHARING_NOT_CONSENTED"]);
    },
  );

  it("marks a coalition NEEDS_REVIEW when any group's evidence is unknown", () => {
    const input = fixture();
    const r = solve({ ...input, rankings: { ...input.rankings, group_a: [] } });
    expect(r.candidates[0]!.status).toBe("NEEDS_REVIEW");
    expect(r.candidates[0]!.cultural_score).toBeNull();
    expect(r.candidates[0]!.group_utilities.group_a).toMatchObject({ reason: "EMPTY_RESULT" });
  });

  it("does not approve an unapproved programme", () => {
    const input = fixture();
    const offer = input.offers[0]!;
    const r = solve({
      ...input,
      offers: [{ ...offer, experience: { ...offer.experience, approved: false } }],
    });
    expect(r.candidates).toEqual([]);
    expect(r.slot_reports[0]!.slot_blockers).toEqual(["EXPERIENCE_NOT_APPROVED"]);
  });

  it("enforces the 20-group input cap", () => {
    const input = fixture();
    const groups = Array.from({ length: 21 }, (_, i) => ({
      ...input.groups[i % 3]!,
      group_id: `g${i}`,
    }));
    expect(() => solve({ ...input, groups })).toThrow(/20 groups/);
  });

  it("rejects a slot attached to a different experience", () => {
    const input = fixture();
    const offer = input.offers[0]!;
    expect(() =>
      solve({
        ...input,
        offers: [{ ...offer, slots: [{ ...offer.slots[0]!, experience_id: "other" }] }],
      }),
    ).toThrow(/does not belong/);
  });

  it("ranks by cultural score, then surplus, then earlier slot, and returns at most three", () => {
    const input = fixture();
    const offer = input.offers[0]!;
    const base = offer.slots[0]!;
    const slots = [0, 1, 2, 3].map((d) => ({
      ...base,
      id: `slot_${d}`,
      start_at: `2026-12-0${5 + d}T14:00:00Z`,
      end_at: `2026-12-0${5 + d}T15:30:00Z`,
    }));
    const wide = [{ start_at: "2026-12-01T00:00:00Z", end_at: "2026-12-31T00:00:00Z" }];
    const r = solve({
      ...input,
      groups: input.groups.map((g) => ({ ...g, availability: wide })),
      offers: [{ ...offer, slots }],
    });
    expect(r.feasible_count).toBe(4);
    expect(r.candidates.map((c) => c.slot_id)).toEqual(["slot_0", "slot_1", "slot_2"]);
  });

  it("prefers the coalition that serves its least-matched group better", () => {
    const input = fixture();
    const groups = [
      ...input.groups.map((g) => ({ ...g, expected_seats: 12 })),
      { ...input.groups[1]!, group_id: "group_d", expected_seats: 12 },
    ];
    const rankings = {
      ...input.rankings,
      group_d: [{ entity_id: "anchor_c" }, { entity_id: "anchor_b" }, { entity_id: "anchor_a" }],
    };
    const r = solve({ ...input, groups, rankings });
    // group_c and group_d score lowest; the best pair excludes both.
    expect(r.candidates[0]!.group_ids).toEqual(["group_a", "group_b"]);
  });
});

import { describe, expect, it } from "vitest";
import { solve, type SolverInput } from "@/lib/domain/solver";
import type { Offer } from "@/lib/domain/types";

/*
 * Worst-case solver benchmark at the D13 input caps: 20 groups, 10
 * experiences x 5 slots, 30 anchors, and every group eligible for every slot,
 * so all 6,175 coalitions of 2-4 groups are evaluated for each of 50 slots
 * (308,750 candidate evaluations). Synthetic data; measures CPU time only.
 * Run with: npm run perf
 */

function worstCase(): SolverInput {
  const universe = Array.from({ length: 30 }, (_, i) => `A${i}`);
  const offers: Offer[] = Array.from({ length: 10 }, (_, e) => ({
    experience: {
      id: `exp_${e}`,
      title: `Experience ${e}`,
      approved: true,
      access_support: ["step_free", "seating"],
      anchor_entity_ids: universe.slice(e * 3, e * 3 + 3),
    },
    quote: {
      id: `q_${e}`, version: 1, currency: "GBP", fixed_pence: 1000, variable_pence: 100, platform_fee_pence: 50,
      ticket_pence: 1500, minimum_venue_charge_pence: 0, venue_min_seats: 2,
    },
    slots: Array.from({ length: 5 }, (_, s) => ({
      id: `slot_${e}_${s}`,
      experience_id: `exp_${e}`,
      start_at: `2026-12-${String(s + 1).padStart(2, "0")}T14:00:00Z`,
      end_at: `2026-12-${String(s + 1).padStart(2, "0")}T16:00:00Z`,
      capacity: 100,
    })),
  }));
  const groups = Array.from({ length: 20 }, (_, g) => ({
    group_id: `g${String(g).padStart(2, "0")}`,
    expected_seats: 5 + (g % 7),
    budget_pence: 3000,
    sharing: "WILLING_TO_SHARE" as const,
    access_requirements: [],
    availability: [{ start_at: "2026-12-01T00:00:00Z", end_at: "2026-12-31T00:00:00Z" }],
  }));
  const rankings = Object.fromEntries(groups.map((g, i) => [
    g.group_id,
    [...universe.slice(i % 30), ...universe.slice(0, i % 30)].map((entity_id) => ({ entity_id })),
  ]));
  return { groups, offers, anchor_universe: universe, rankings, source_mode: "synthetic" };
}

describe("solver performance at input caps", () => {
  it("evaluates the full worst case and reports timing", () => {
    const input = worstCase();
    solve(input); // warm-up
    const runs: number[] = [];
    let feasible = 0;
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      feasible = solve(input).feasible_count;
      runs.push(performance.now() - t);
    }
    runs.sort((a, b) => a - b);
    console.log(JSON.stringify({
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      feasible_candidates: feasible,
      runs_ms: runs.map((r) => Math.round(r)),
      median_ms: Math.round(runs[2]!),
    }));
    expect(feasible).toBe(6175 * 50);
  });
});

import { describe, expect, it } from "vitest";
import { isScenarioId, scenarioInput, SCENARIOS, type ScenarioId } from "@/lib/demo/scenarios";
import { solve } from "@/lib/domain/solver";

describe("sandbox scenarios", () => {
  it.each<[ScenarioId, number, string | null]>([
    ["baseline", 1, "DRAFT"],
    ["low-budget", 0, null],
    ["private-group", 0, null],
    ["missing-evidence", 1, "NEEDS_REVIEW"],
  ])("%s yields %i candidate(s)", (id, count, status) => {
    const r = solve(scenarioInput(id));
    expect(r.candidates).toHaveLength(count);
    if (status) expect(r.candidates[0]!.status).toBe(status);
    for (const c of r.candidates) {
      expect(c.source_mode).toBe("synthetic");
      expect(c.payment_status).toBe("NOT_COLLECTED");
    }
  });

  it("only accepts known scenario IDs", () => {
    expect(Object.keys(SCENARIOS).every(isScenarioId)).toBe(true);
    expect(isScenarioId("toString")).toBe(false);
    expect(isScenarioId(["baseline"])).toBe(false);
  });
});

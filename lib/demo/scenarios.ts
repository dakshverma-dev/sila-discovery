import type { SolverInput } from "@/lib/domain/solver";
import { syntheticSolverInput } from "./synthetic-fixture";

/** Illustrative sandbox scenarios derived from the synthetic fixture. */
export const SCENARIOS = {
  baseline: {
    label: "Feasible coalition",
    description: "Three illustrative groups can jointly fund the session.",
  },
  "low-budget": {
    label: "Budget conflict",
    description: "One group's maximum is below the all-in ticket price.",
  },
  "private-group": {
    label: "Sharing refused",
    description: "One group prefers a private session, so no shared coalition is possible.",
  },
  "missing-evidence": {
    label: "Incomplete evidence",
    description: "Cultural evidence for one group is unavailable, so the draft needs review.",
  },
} as const;

export type ScenarioId = keyof typeof SCENARIOS;

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && Object.hasOwn(SCENARIOS, value);
}

export function scenarioInput(id: ScenarioId): SolverInput {
  const input = syntheticSolverInput();
  switch (id) {
    case "baseline":
      return input;
    case "low-budget":
      return {
        ...input,
        groups: input.groups.map((g, i) => (i === 0 ? { ...g, budget_pence: 1500 } : g)),
      };
    case "private-group":
      return {
        ...input,
        groups: input.groups.map((g, i) => (i === 1 ? { ...g, sharing: "PRIVATE_ONLY" } : g)),
      };
    case "missing-evidence":
      return { ...input, rankings: { ...input.rankings, group_c: undefined } };
  }
}

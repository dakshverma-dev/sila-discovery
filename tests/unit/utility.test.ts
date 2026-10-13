import { describe, expect, it } from "vitest";
import {
  averagedPositions,
  culturalScore,
  experienceUtility,
  positionUtility,
} from "@/lib/domain/utility";

const universe = ["a", "b", "c"];
const ranked = (...ids: string[]) => ids.map((entity_id) => ({ entity_id }));

describe("ordinal utility (D13)", () => {
  it("maps positions linearly and keeps a single candidate neutral", () => {
    expect(positionUtility(1, 3)).toBe(1);
    expect(positionUtility(2, 3)).toBe(0.5);
    expect(positionUtility(3, 3)).toBe(0);
    expect(positionUtility(1, 1)).toBe(0.5);
  });

  it("averages utilities of the experience's anchors", () => {
    const r = experienceUtility(["a", "b"], ranked("a", "b", "c"), universe);
    expect(r).toEqual({ status: "scored", utility: 0.75, coverage: 1 });
  });

  it("gives tied raw scores their average rank", () => {
    const positions = averagedPositions([
      { entity_id: "a", raw_score: 0.9 },
      { entity_id: "b", raw_score: 0.5 },
      { entity_id: "c", raw_score: 0.5 },
    ]);
    expect(positions.get("b")).toBe(2.5);
    expect(positions.get("c")).toBe(2.5);
    const r = experienceUtility(
      ["b"],
      [
        { entity_id: "a", raw_score: 0.9 },
        { entity_id: "b", raw_score: 0.5 },
        { entity_id: "c", raw_score: 0.5 },
      ],
      universe,
    );
    expect(r.status === "scored" && r.utility).toBe(0.25);
  });

  it.each([
    ["an empty result", ranked(), "EMPTY_RESULT"],
    ["a partial universe", ranked("a", "b"), "INCOMPLETE_UNIVERSE"],
    ["duplicate entities", ranked("a", "a", "b"), "DUPLICATE_RESULT"],
    ["an entity outside the universe", ranked("a", "b", "z"), "UNEXPECTED_ENTITY"],
  ])("treats %s as unknown, never as dislike", (_, input, reason) => {
    const r = experienceUtility(["a"], input, universe);
    expect(r).toMatchObject({ status: "unknown", reason });
  });

  it("requires at least two anchors in the comparison universe", () => {
    expect(experienceUtility(["a"], ranked("a"), ["a"])).toMatchObject({
      status: "unknown",
      reason: "UNIVERSE_TOO_SMALL",
    });
  });

  it("cannot score an experience with no approved anchors", () => {
    expect(experienceUtility([], ranked("a", "b", "c"), universe)).toMatchObject({
      status: "unknown",
      reason: "NO_EXPERIENCE_ANCHORS",
    });
  });

  it("weights the least-served group most heavily", () => {
    expect(culturalScore([0.75, 0.75, 0.5])).toBeCloseTo(0.7 * 0.5 + 0.3 * (2 / 3));
    expect(culturalScore([1, 0])).toBeLessThan(culturalScore([0.5, 0.5]));
  });
});

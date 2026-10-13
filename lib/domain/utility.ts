import { LIMITS } from "./limits";

/**
 * Ordinal cultural utility (D13). Ranks are compared only within one fixed
 * anchor-universe query; raw provider scores are never treated as probabilities.
 */

export interface RankedAnchor {
  entity_id: string;
  /** Optional provider score, used only to detect ties. */
  raw_score?: number;
}

export type UtilityResult =
  | { status: "scored"; utility: number; coverage: number }
  | { status: "unknown"; reason: UnknownReason; coverage: number };

export type UnknownReason =
  | "EMPTY_RESULT"
  | "DUPLICATE_RESULT"
  | "UNIVERSE_TOO_SMALL"
  | "INCOMPLETE_UNIVERSE"
  | "UNEXPECTED_ENTITY"
  | "NO_EXPERIENCE_ANCHORS";

/** Utility for 1-based position r among n ranked results: 1 - (r-1)/(n-1); n=1 is neutral. */
export function positionUtility(position: number, n: number): number {
  if (n === 1) return 0.5;
  return 1 - (position - 1) / (n - 1);
}

/** 1-based positions with tied raw scores sharing their average rank. */
export function averagedPositions(ranked: readonly RankedAnchor[]): Map<string, number> {
  const positions = new Map<string, number>();
  let i = 0;
  while (i < ranked.length) {
    let j = i;
    const score = ranked[i]!.raw_score;
    while (
      score !== undefined &&
      j + 1 < ranked.length &&
      ranked[j + 1]!.raw_score === score
    ) {
      j++;
    }
    const average = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) positions.set(ranked[k]!.entity_id, average);
    i = j + 1;
  }
  return positions;
}

/**
 * Group utility for one experience. A scored result requires the provider to
 * return the complete shared universe of at least two anchors; anything else is
 * unknown, never zero dislike.
 */
export function experienceUtility(
  experienceAnchors: readonly string[],
  ranked: readonly RankedAnchor[],
  universe: readonly string[],
): UtilityResult {
  const universeSet = new Set(universe);
  const rankedIds = ranked.map((r) => r.entity_id);
  const rankedSet = new Set(rankedIds);
  const coverage =
    universeSet.size === 0
      ? 0
      : rankedIds.filter((id) => universeSet.has(id)).length / universeSet.size;

  if (experienceAnchors.length === 0) {
    return { status: "unknown", reason: "NO_EXPERIENCE_ANCHORS", coverage };
  }
  if (ranked.length === 0) return { status: "unknown", reason: "EMPTY_RESULT", coverage };
  if (rankedSet.size !== rankedIds.length) {
    return { status: "unknown", reason: "DUPLICATE_RESULT", coverage };
  }
  if (rankedIds.some((id) => !universeSet.has(id))) {
    return { status: "unknown", reason: "UNEXPECTED_ENTITY", coverage };
  }
  if (universeSet.size < 2) return { status: "unknown", reason: "UNIVERSE_TOO_SMALL", coverage };
  if (rankedSet.size !== universeSet.size) {
    return { status: "unknown", reason: "INCOMPLETE_UNIVERSE", coverage };
  }

  const positions = averagedPositions(ranked);
  const n = ranked.length;
  const known = experienceAnchors.filter((a) => positions.has(a));
  if (known.length === 0) return { status: "unknown", reason: "INCOMPLETE_UNIVERSE", coverage };
  const total = known.reduce((sum, a) => sum + positionUtility(positions.get(a)!, n), 0);
  return { status: "scored", utility: total / known.length, coverage };
}

/** Coalition cultural score: 0.70 * min + 0.30 * mean; groups weigh equally. */
export function culturalScore(groupUtilities: readonly number[]): number {
  if (groupUtilities.length === 0) throw new RangeError("At least one utility is required");
  const min = Math.min(...groupUtilities);
  const mean = groupUtilities.reduce((a, b) => a + b, 0) / groupUtilities.length;
  return LIMITS.culturalMinWeight * min + LIMITS.culturalMeanWeight * mean;
}

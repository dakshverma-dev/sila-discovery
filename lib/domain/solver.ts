import { quotedEconomics, requiredSeats, type QuotedEconomics } from "./economics";
import { assertValidWindow, groupBlockers, type GroupBlocker } from "./feasibility";
import { LIMITS } from "./limits";
import { PAYMENT_STATUS, type GroupBrief, type Offer, type PaymentStatus, type SourceMode } from "./types";
import { culturalScore, experienceUtility, type RankedAnchor, type UtilityResult } from "./utility";

export interface SolverInput {
  groups: readonly GroupBrief[];
  offers: readonly Offer[];
  /** The shared, venue-reviewed anchor universe queried for every group. */
  anchor_universe: readonly string[];
  /** Ordered provider results per group; a missing entry means no evidence. */
  rankings: Readonly<Record<string, readonly RankedAnchor[] | undefined>>;
  source_mode: SourceMode;
}

export interface Candidate {
  experience_id: string;
  slot_id: string;
  slot_start_at: string;
  group_ids: string[];
  required_seats: number;
  planned_seats: number;
  capacity: number;
  status: "DRAFT" | "NEEDS_REVIEW";
  cultural_score: number | null;
  group_utilities: Record<string, UtilityResult>;
  economics: QuotedEconomics;
  source_mode: SourceMode;
  payment_status: PaymentStatus;
}

export type SlotBlocker =
  | "EXPERIENCE_NOT_APPROVED"
  | "QUOTE_INFEASIBLE"
  | "TOO_FEW_ELIGIBLE_GROUPS"
  | "SEATS_BELOW_REQUIRED"
  /** Some coalitions would exceed capacity; organisers must clarify attendance rather than be dropped. */
  | "CAPACITY_NEEDS_CLARIFICATION";

export interface SlotReport {
  experience_id: string;
  slot_id: string;
  required_seats: number | null;
  eligible_group_ids: string[];
  group_blockers: Record<string, GroupBlocker[]>;
  slot_blockers: SlotBlocker[];
  feasible_coalitions: number;
}

export interface SolverResult {
  candidates: Candidate[];
  feasible_count: number;
  slot_reports: SlotReport[];
}

function validateInput(input: SolverInput): void {
  if (input.groups.length > LIMITS.maximumGroups) {
    throw new RangeError(`At most ${LIMITS.maximumGroups} groups per run`);
  }
  if (input.offers.length > LIMITS.maximumExperiences) {
    throw new RangeError(`At most ${LIMITS.maximumExperiences} experiences per run`);
  }
  if (input.anchor_universe.length > LIMITS.maximumAnchorUniverse) {
    throw new RangeError(`At most ${LIMITS.maximumAnchorUniverse} anchors in the universe`);
  }
  const ids = new Set(input.groups.map((g) => g.group_id));
  if (ids.size !== input.groups.length) throw new RangeError("Duplicate group IDs");
  for (const g of input.groups) {
    if (!Number.isSafeInteger(g.expected_seats) || g.expected_seats < 1) {
      throw new RangeError("expected_seats must be a positive integer");
    }
    g.availability.forEach(assertValidWindow);
  }
  for (const offer of input.offers) {
    if (offer.slots.length > LIMITS.maximumSlotsPerExperience) {
      throw new RangeError(`At most ${LIMITS.maximumSlotsPerExperience} slots per experience`);
    }
    for (const slot of offer.slots) {
      if (slot.experience_id !== offer.experience.id) {
        throw new RangeError("Slot does not belong to its experience");
      }
      if (!Number.isSafeInteger(slot.capacity) || slot.capacity < 1) {
        throw new RangeError("capacity must be a positive integer");
      }
      assertValidWindow(slot);
    }
  }
}

function* subsets<T>(items: readonly T[], size: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === size) {
    yield [...acc];
    return;
  }
  for (let i = start; i <= items.length - (size - acc.length); i++) {
    acc.push(items[i]!);
    yield* subsets(items, size, i + 1, acc);
    acc.pop();
  }
}

function compareCandidates(a: Candidate, b: Candidate): number {
  const aUnknown = a.cultural_score === null;
  const bUnknown = b.cultural_score === null;
  if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
  if (!aUnknown && a.cultural_score !== b.cultural_score) {
    return b.cultural_score! - a.cultural_score!;
  }
  if (a.economics.surplus_pence !== b.economics.surplus_pence) {
    return b.economics.surplus_pence - a.economics.surplus_pence;
  }
  const startDiff = Date.parse(a.slot_start_at) - Date.parse(b.slot_start_at);
  if (startDiff !== 0) return startDiff;
  const groupKey = a.group_ids.join(",").localeCompare(b.group_ids.join(","));
  if (groupKey !== 0) return groupKey;
  return a.experience_id.localeCompare(b.experience_id);
}

/**
 * Deterministic coalition solver (D13). Hard constraints are applied before any
 * cultural ranking, and are never relaxed to produce a result.
 */
export function solve(input: SolverInput): SolverResult {
  validateInput(input);
  const candidates: Candidate[] = [];
  const reports: SlotReport[] = [];

  for (const { experience, quote, slots } of input.offers) {
    const utilities = new Map<string, UtilityResult>();
    for (const g of input.groups) {
      utilities.set(
        g.group_id,
        experienceUtility(
          experience.anchor_entity_ids,
          input.rankings[g.group_id] ?? [],
          input.anchor_universe,
        ),
      );
    }

    for (const slot of slots) {
      const report: SlotReport = {
        experience_id: experience.id,
        slot_id: slot.id,
        required_seats: null,
        eligible_group_ids: [],
        group_blockers: {},
        slot_blockers: [],
        feasible_coalitions: 0,
      };
      reports.push(report);

      if (!experience.approved) {
        report.slot_blockers.push("EXPERIENCE_NOT_APPROVED");
        continue;
      }
      const required = requiredSeats(quote, slot.capacity);
      report.required_seats = required;
      if (required === null) {
        report.slot_blockers.push("QUOTE_INFEASIBLE");
        continue;
      }

      const eligible: GroupBrief[] = [];
      for (const g of input.groups) {
        const blockers = groupBlockers(g, experience, quote, slot);
        if (blockers.length > 0) report.group_blockers[g.group_id] = blockers;
        else eligible.push(g);
      }
      report.eligible_group_ids = eligible.map((g) => g.group_id).sort();
      if (eligible.length < LIMITS.coalitionMin) {
        report.slot_blockers.push("TOO_FEW_ELIGIBLE_GROUPS");
        continue;
      }

      let belowRequired = 0;
      let overCapacity = 0;
      const maxSize = Math.min(LIMITS.coalitionMax, eligible.length);
      for (let size = LIMITS.coalitionMin; size <= maxSize; size++) {
        for (const coalition of subsets(eligible, size)) {
          const seats = coalition.reduce((sum, g) => sum + g.expected_seats, 0);
          if (seats < required) {
            belowRequired++;
            continue;
          }
          if (seats > slot.capacity) {
            overCapacity++;
            continue;
          }
          report.feasible_coalitions++;

          const groupUtilities: Record<string, UtilityResult> = {};
          const scores: number[] = [];
          for (const g of coalition) {
            const u = utilities.get(g.group_id)!;
            groupUtilities[g.group_id] = u;
            if (u.status === "scored") scores.push(u.utility);
          }
          const allScored = scores.length === coalition.length;
          candidates.push({
            experience_id: experience.id,
            slot_id: slot.id,
            slot_start_at: slot.start_at,
            group_ids: coalition.map((g) => g.group_id).sort(),
            required_seats: required,
            planned_seats: seats,
            capacity: slot.capacity,
            status: allScored ? "DRAFT" : "NEEDS_REVIEW",
            cultural_score: allScored ? culturalScore(scores) : null,
            group_utilities: groupUtilities,
            economics: quotedEconomics(quote, seats),
            source_mode: input.source_mode,
            payment_status: PAYMENT_STATUS,
          });
        }
      }
      if (report.feasible_coalitions === 0) {
        if (overCapacity > 0) report.slot_blockers.push("CAPACITY_NEEDS_CLARIFICATION");
        if (belowRequired > 0) report.slot_blockers.push("SEATS_BELOW_REQUIRED");
      }
    }
  }

  candidates.sort(compareCandidates);
  return {
    candidates: candidates.slice(0, LIMITS.maximumAlternatives),
    feasible_count: candidates.length,
    slot_reports: reports,
  };
}

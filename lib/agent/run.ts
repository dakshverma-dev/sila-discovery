import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { callApi, json } from "@/lib/db/api";
import { getPool } from "@/lib/db/pool";
import { DEMO_RANKINGS } from "@/lib/demo/catalogue";
import type { GroupBlocker } from "@/lib/domain/feasibility";
import { solve, type SlotBlocker } from "@/lib/domain/solver";
import type { GroupBrief, Offer, SharingChoice, SourceMode, TimeWindow } from "@/lib/domain/types";
import type { RankedAnchor } from "@/lib/domain/utility";
import { CallBudget, type QlooClient } from "@/lib/providers/qloo/client";
import { QlooError } from "@/lib/providers/qloo/errors";
import { explainCandidate } from "./explain";

/** Frozen inputs written by scb_api.create_match_run. */
interface Snapshot {
  workspace_id: string;
  requested_group_id: string;
  source_mode: "live" | "synthetic";
  groups: Array<{
    group_id: string;
    name: string;
    expected_seats: number;
    budget_pence: number;
    availability: TimeWindow[];
    sharing_choice: SharingChoice;
    external_query_consent: boolean;
    access_requirements: string[];
    confirmed_entity_ids: string[];
  }>;
  offers: Offer[];
  anchor_universe: string[];
  anchor_labels: Record<string, string>;
}

interface Lease {
  run_id: string;
  snapshot: Snapshot;
  requested_by: string;
  deadline_at: string;
}

export interface RunResult {
  outcome: "CANDIDATES" | "NO_FEASIBLE_COALITION";
  source_mode: SourceMode;
  feasible_count: number;
  candidates: Array<{
    proposal_id: string;
    rank: number;
    status: "DRAFT" | "NEEDS_REVIEW";
    experience_title: string;
    slot_start_at: string;
    slot_end_at: string;
    group_names: string[];
    planned_seats: number;
    required_seats: number;
    ticket_pence: number;
  }>;
  own_blockers: Array<{ experience_title: string; slot_start_at: string; blockers: GroupBlocker[] }>;
  slot_blockers: Array<{ experience_title: string; slot_start_at: string; blockers: SlotBlocker[] }>;
  evidence: { groups_scored: number; groups_without_evidence: number };
}

export interface RunDeps {
  pool?: Pool;
  qloo?: QlooClient | null;
}

/**
 * Processes one leased match run. Safe to call repeatedly: leasing is atomic
 * in the database, so a run is processed by one worker at a time and an
 * expired lease is recovered rather than duplicated.
 */
export async function processMatchRun(runId: string, deps: RunDeps = {}): Promise<string> {
  const pool = deps.pool ?? getPool();
  const leased = await callApi<Lease>("lease_match_run", [runId], pool);
  if (!leased.ok) return leased.error.code;
  const { snapshot, requested_by: actor } = leased.data;
  const deadline = Date.parse(leased.data.deadline_at);

  const finish = (state: "SUCCEEDED" | "FAILED", result: unknown, errorCode: string | null) =>
    callApi("finish_match_run", [runId, state, result, errorCode], pool);
  const checkpoint = (data: Record<string, unknown>, calls: number) =>
    callApi("checkpoint_match_run", [runId, data, calls], pool);

  try {
    await checkpoint({ stage: "inputs_frozen", groups: snapshot.groups.length, offers: snapshot.offers.length }, 0);

    // Evidence. Consent is rechecked from the frozen brief before any provider call.
    const budget = new CallBudget(24, deadline);
    const rankings: Record<string, RankedAnchor[] | undefined> = {};
    const evidence: Array<Record<string, unknown>> = [];
    const fetchedAt = new Date().toISOString();

    if (snapshot.source_mode === "synthetic") {
      for (const g of snapshot.groups) rankings[g.group_id] = DEMO_RANKINGS[g.name];
    } else {
      if (!deps.qloo) {
        await finish("FAILED", null, "QLOO_UNAVAILABLE");
        return "QLOO_UNAVAILABLE";
      }
      const eligible = snapshot.groups.filter(
        (g) => g.external_query_consent && g.confirmed_entity_ids.length > 0,
      );
      const results = await Promise.all(
        eligible.map(async (g) => {
          const r = await deps.qloo!.rankAnchors(g.confirmed_entity_ids, snapshot.anchor_universe, budget);
          return { g, r };
        }),
      );
      for (const { g, r } of results) {
        rankings[g.group_id] = r.ranked;
        r.entities.forEach((e) =>
          evidence.push({
            group_id: g.group_id,
            source_mode: "live",
            query_hash: r.meta.query_fingerprint,
            entity_id: e.entity_id,
            rank: e.rank,
            raw_score: e.raw_score ?? null,
            fetched_at: r.meta.fetched_at,
          }),
        );
      }
    }
    if (snapshot.source_mode === "synthetic") {
      for (const g of snapshot.groups) {
        (rankings[g.group_id] ?? []).forEach((r, i) =>
          evidence.push({
            group_id: g.group_id,
            source_mode: "synthetic",
            query_hash: "synthetic",
            entity_id: r.entity_id,
            rank: i + 1,
            fetched_at: fetchedAt,
          }),
        );
      }
    }
    if (evidence.length > 0) await callApi("record_evidence", [runId, json(evidence)], pool);
    await checkpoint({ stage: "evidence", calls_used: budget.callsUsed }, budget.callsUsed);

    // Deterministic solve, scoped to coalitions that include the requester's group.
    const groups: GroupBrief[] = snapshot.groups.map((g) => ({
      group_id: g.group_id,
      expected_seats: g.expected_seats,
      budget_pence: g.budget_pence,
      sharing: g.sharing_choice,
      access_requirements: g.access_requirements,
      availability: g.availability,
    }));
    const source: SourceMode = snapshot.source_mode;
    const solved = solve({
      groups,
      offers: snapshot.offers,
      anchor_universe: snapshot.anchor_universe,
      rankings,
      source_mode: source,
      must_include_group_id: snapshot.requested_group_id,
    });
    await checkpoint({ stage: "solved", feasible_count: solved.feasible_count }, budget.callsUsed);

    const names = Object.fromEntries(snapshot.groups.map((g) => [g.group_id, g.name]));
    const offers = new Map(snapshot.offers.map((o) => [o.experience.id, o]));
    const result: RunResult = {
      outcome: solved.candidates.length > 0 ? "CANDIDATES" : "NO_FEASIBLE_COALITION",
      source_mode: source,
      feasible_count: solved.feasible_count,
      candidates: [],
      own_blockers: [],
      slot_blockers: [],
      evidence: {
        groups_scored: Object.values(rankings).filter((r) => r && r.length > 0).length,
        groups_without_evidence: snapshot.groups.length - Object.values(rankings).filter((r) => r && r.length > 0).length,
      },
    };

    for (const [i, c] of solved.candidates.entries()) {
      const offer = offers.get(c.experience_id)!;
      const rationale = explainCandidate({
        candidate: c,
        rank: i + 1,
        runId,
        title: offer.experience.title,
        ticketPence: offer.quote.ticket_pence,
        anchorIds: offer.experience.anchor_entity_ids,
        anchorLabels: snapshot.anchor_labels,
        groupNames: names,
        rankings,
      });
      const saved = await callApi<{ proposal_id: string }>(
        "save_draft",
        [actor, snapshot.workspace_id, c.slot_id, offer.quote.id, c.group_ids, c.required_seats, source,
         rationale, runId, randomUUID()],
        pool,
      );
      if (!saved.ok) throw new Error(`save_draft failed: ${saved.error.code}`);
      result.candidates.push({
        proposal_id: saved.data.proposal_id,
        rank: i + 1,
        status: c.status,
        experience_title: offer.experience.title,
        slot_start_at: c.slot_start_at,
        slot_end_at: c.slot_end_at,
        group_names: c.group_ids.map((id) => names[id]!),
        planned_seats: c.planned_seats,
        required_seats: c.required_seats,
        ticket_pence: offer.quote.ticket_pence,
      });
    }

    // Requester-safe blockers: only the requesting group's own reasons plus
    // slot-level reasons that reveal nothing about other groups (BR17).
    for (const report of solved.slot_reports) {
      const offer = offers.get(report.experience_id)!;
      const slot = offer.slots.find((s) => s.id === report.slot_id)!;
      const own = report.group_blockers[snapshot.requested_group_id];
      if (own?.length) {
        result.own_blockers.push({ experience_title: offer.experience.title, slot_start_at: slot.start_at, blockers: own });
      } else if (report.slot_blockers.length) {
        result.slot_blockers.push({
          experience_title: offer.experience.title,
          slot_start_at: slot.start_at,
          blockers: report.slot_blockers,
        });
      }
    }

    await finish("SUCCEEDED", result, null);
    return "SUCCEEDED";
  } catch (error) {
    // Never substitute synthetic evidence for a provider failure (BR16).
    const code = error instanceof QlooError ? error.code : "INTERNAL_ERROR";
    await finish("FAILED", null, code).catch(() => undefined);
    if (!(error instanceof QlooError)) console.error("match run failed", runId, error);
    return code;
  }
}

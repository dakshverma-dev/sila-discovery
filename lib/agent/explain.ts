import { formatGbp } from "@/lib/domain/money";
import type { Candidate } from "@/lib/domain/solver";
import type { SourceMode } from "@/lib/domain/types";
import type { RankedAnchor } from "@/lib/domain/utility";
import { UNKNOWN_REASON_COPY } from "@/lib/ui/copy";

/**
 * Deterministic, template-based explanations (D12 fallback; DEC19). Reasons are
 * typed so constraint checks, provider observations and product
 * interpretations stay distinguishable, and every cultural claim cites the
 * anchor evidence it relies on. No hidden reasoning is stored.
 */

export interface Reason {
  kind: "constraint" | "observation" | "interpretation";
  text: string;
  evidence: string[];
}

export interface GroupFit {
  status: "scored" | "unknown";
  /** 0..1 ordinal utility; ordering only, never a probability. */
  utility: number | null;
  note: string;
  anchors: Array<{ entity_id: string; label: string; position: number | null; of: number }>;
}

export interface Rationale {
  status: "draft_only";
  summary: string;
  reasons: Reason[];
  uncertainties: string[];
  cultural_score: number | null;
  candidate_rank: number;
  source_mode: SourceMode;
  run_id: string;
  economics: { planned_seats: number; required_seats: number; capacity: number; ticket_pence: number };
  /** Per-group fit; projected so organisers only see their own group (BR17). */
  by_group: Record<string, GroupFit>;
}

const SOURCE_PHRASE: Record<SourceMode, string> = {
  live: "live Qloo rankings",
  cached: "cached Qloo rankings",
  synthetic: "synthetic illustrative rankings (not Qloo data)",
  unavailable: "no cultural evidence",
};

export function explainCandidate(args: {
  candidate: Candidate;
  rank: number;
  runId: string;
  title: string;
  ticketPence: number;
  anchorIds: readonly string[];
  anchorLabels: Readonly<Record<string, string>>;
  groupNames: Readonly<Record<string, string>>;
  rankings: Readonly<Record<string, readonly RankedAnchor[] | undefined>>;
}): Rationale {
  const { candidate: c, anchorIds, anchorLabels, groupNames, rankings } = args;
  const names = c.group_ids.map((id) => groupNames[id] ?? "A group");
  const label = (id: string) => anchorLabels[id] ?? id;

  const reasons: Reason[] = [
    {
      kind: "constraint",
      text:
        `Every included group chose to share a session, is available for the whole slot, set a per-person ` +
        `maximum at or above the ${formatGbp(args.ticketPence)} all-in price, and has its stated access needs ` +
        `confirmed by the venue.`,
      evidence: ["constraint:sharing", "constraint:time", "constraint:budget", "constraint:access"],
    },
    {
      kind: "constraint",
      text:
        `About ${c.planned_seats} people are expected across the groups. The venue quote needs ` +
        `${c.required_seats} individual reservations, within a capacity of ${c.capacity}.`,
      evidence: ["constraint:quote", "constraint:capacity"],
    },
  ];

  const byGroup: Record<string, GroupFit> = {};
  for (const groupId of c.group_ids) {
    const u = c.group_utilities[groupId]!;
    const ranked = rankings[groupId] ?? [];
    const anchors = anchorIds.map((id) => {
      const idx = ranked.findIndex((r) => r.entity_id === id);
      return { entity_id: id, label: label(id), position: idx >= 0 ? idx + 1 : null, of: ranked.length };
    });
    byGroup[groupId] = {
      status: u.status,
      utility: u.status === "scored" ? u.utility : null,
      note:
        u.status === "scored"
          ? `Ranks this programme's anchors ${describePositions(anchors)} on the shared book list.`
          : UNKNOWN_REASON_COPY[u.reason],
      anchors,
    };
  }

  if (c.cultural_score !== null) {
    const allUpper = Object.values(byGroup).every((g) => (g.utility ?? 0) >= 0.5);
    reasons.push({
      kind: "observation",
      text:
        `Using ${SOURCE_PHRASE[c.source_mode]}, each group's references were compared against the same ` +
        `venue-approved list of ${rankings[c.group_ids[0]!]?.length ?? 0} book anchors.`,
      evidence: anchorIds.map((id) => `anchor:${id}`),
    });
    reasons.push({
      kind: "interpretation",
      text: allUpper
        ? `The programme's anchors (${anchorIds.map(label).join(", ")}) sit in the upper half of every included group's ranking. The venue chose these anchors to represent the programme.`
        : `The programme's anchors (${anchorIds.map(label).join(", ")}) rank highly for some groups and lower for others; the least-matched group carries most weight in the ordering.`,
      evidence: anchorIds.map((id) => `anchor:${id}`),
    });
  }

  const uncertainties = [
    "Expected attendance is an organiser estimate; only individual reservations count towards the threshold.",
    "Ranking positions order suggestions. They are not a probability that anyone will attend or enjoy the session.",
  ];
  if (c.source_mode === "synthetic") {
    uncertainties.push("Cultural evidence is synthetic and illustrative; it does not come from Qloo.");
  }
  if (c.status === "NEEDS_REVIEW") {
    uncertainties.push("At least one group's cultural fit is unknown, so this option needs human review.");
  }

  return {
    status: "draft_only",
    summary: `${args.title} could bring together ${names.join(", ")}.`,
    reasons,
    uncertainties,
    cultural_score: c.cultural_score,
    candidate_rank: args.rank,
    source_mode: c.source_mode,
    run_id: args.runId,
    economics: {
      planned_seats: c.planned_seats,
      required_seats: c.required_seats,
      capacity: c.capacity,
      ticket_pence: args.ticketPence,
    },
    by_group: byGroup,
  };
}

function describePositions(anchors: GroupFit["anchors"]): string {
  return anchors
    .filter((a) => a.position !== null)
    .map((a) => `${a.label} at ${a.position} of ${a.of}`)
    .join("; ");
}

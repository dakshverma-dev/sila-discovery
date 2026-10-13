import { callApi } from "@/lib/db/api";
import type { ProposalDetail } from "@/lib/demo/views";
import { HttpError } from "./http";

/** Exactly the D16 / OpenAPI ProposalView fields; no viewer-private extras. */
export function contractView(p: ProposalDetail) {
  return {
    id: p.id,
    proposal_version_id: p.proposal_version_id,
    version: p.version,
    state: p.state,
    experience_title: p.experience_title,
    venue_name: p.venue_name,
    slot_start_at: p.slot_start_at,
    slot_end_at: p.slot_end_at,
    timezone: p.timezone,
    ticket_pence: p.ticket_pence,
    currency: "GBP" as const,
    required_seats: p.required_seats,
    active_reservations: p.active_reservations,
    capacity: p.capacity,
    deadline: p.deadline,
    payment_status: "NOT_COLLECTED" as const,
    source_mode: p.source_mode,
    group_summaries: p.group_summaries.map((g) => ({ group_id: g.group_id, summary: g.summary || g.name })),
    // Evidence is linked to match runs, not yet to individual proposal versions.
    evidence_ids: [] as string[],
  };
}

/** Loads the actor's view and rejects a stale version before a write (D16 expected_version). */
export async function requireCurrentVersion(
  actorId: string,
  proposalId: string,
  expected: { proposal_version_id?: string; expected_version: number },
): Promise<ProposalDetail> {
  const r = await callApi<ProposalDetail>("get_proposal_detail", [actorId, proposalId]);
  if (!r.ok) throw new HttpError(r.error.code, r.error.message);
  if (
    r.data.version !== expected.expected_version ||
    (expected.proposal_version_id && r.data.proposal_version_id !== expected.proposal_version_id)
  ) {
    throw new HttpError("VERSION_CONFLICT", "The proposal terms changed. Refresh and review the new version.");
  }
  return r.data;
}

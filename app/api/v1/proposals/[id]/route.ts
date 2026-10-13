import { contractView } from "@/lib/api/proposals";
import { fromResult, handle, HttpError, resolveActor, uuid } from "@/lib/api/http";
import { callApi } from "@/lib/db/api";
import type { ProposalDetail } from "@/lib/demo/views";

export const GET = handle<{ params: Promise<{ id: string }> }>(async (_request, { params }) => {
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Proposal not found.");
  const actor = await resolveActor();
  return fromResult(await callApi<ProposalDetail>("get_proposal_detail", [actor.actorId, id]), contractView);
});

import { fromResult, handle, HttpError, resolveActor, uuid } from "@/lib/api/http";
import { callApi } from "@/lib/db/api";

/** GET /match-runs/{id}: job status and requester-safe drafts (R14). */
export const GET = handle<{ params: Promise<{ id: string }> }>(async (_request, { params }) => {
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Run not found.");
  const actor = await resolveActor();
  return fromResult(await callApi("get_match_run", [actor.actorId, id]));
});

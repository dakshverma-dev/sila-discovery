import { fromResult, handle, HttpError, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { getMyPlan } from "@/lib/sila/commands/plans";

/** GET /api/v1/sila/plans/:id: organiser view. Neutral 404 for plans the caller does not own. */
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  return fromResult(await getMyPlan(actor, id));
});

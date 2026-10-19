import { fromResult, handle, HttpError, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { getVenueSession } from "@/lib/sila/commands/sessions";

/** GET /api/v1/sila/sessions/:id: venue view. Neutral 404 for sessions the caller may not see. */
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  return fromResult(await getVenueSession(actor, id));
});

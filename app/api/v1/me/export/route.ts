import { fromResult, handle, resolveActor } from "@/lib/api/http";
import { callApi } from "@/lib/db/api";

/** GET /me/export: the caller's own authorised data (R16). */
export const GET = handle<unknown>(async () => {
  const actor = await resolveActor();
  return fromResult(await callApi("export_my_data", [actor.actorId]));
});

import { z } from "zod";
import { assertSameOrigin, handle, HttpError, readJson, resolveActor, success, uuid } from "@/lib/api/http";
import { cookies } from "next/headers";
import { verifyCapability } from "@/lib/auth/capability";
import { DEMO_COOKIE, setDemoCookie } from "@/lib/auth/demo-session";
import { getPool } from "@/lib/db/pool";

const Body = z.strictObject({ persona_id: uuid });

/** POST /demo/role: switch persona within the caller's own sandbox only. */
export const POST = handle<unknown>(async (request) => {
  assertSameOrigin(request);
  const actor = await resolveActor();
  const { persona_id } = await readJson(request, Body);
  const { rows } = await getPool().query<{ valid: boolean }>("select scb_api.demo_persona_valid($1, $2) as valid", [
    actor.workspaceId,
    persona_id,
  ]);
  if (!rows[0]?.valid) throw new HttpError("FORBIDDEN", "That persona is not part of this sandbox.");
  const cap = verifyCapability((await cookies()).get(DEMO_COOKIE)?.value)!;
  await setDemoCookie({ w: actor.workspaceId, p: persona_id, exp: cap.exp });
  return success({ workspace_id: actor.workspaceId, acting_persona_id: persona_id });
});

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { assertSameOrigin, fromResult, handle, idempotencyKey, resolveActor } from "@/lib/api/http";
import { DEMO_COOKIE } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";

/** DELETE /me: delete the caller's account data and revoke the session (R16). */
export const DELETE = handle<unknown>(async (request) => {
  assertSameOrigin(request);
  idempotencyKey(request);
  const actor = await resolveActor();
  const result = await callApi("delete_my_account", [actor.actorId, randomUUID()]);
  if (result.ok) (await cookies()).delete(DEMO_COOKIE);
  return fromResult(result);
});

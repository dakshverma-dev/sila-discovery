import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertSameOrigin, fromResult, handle, idempotencyKey, readJson, resolveActor } from "@/lib/api/http";
import { callApi } from "@/lib/db/api";

const Body = z.strictObject({
  purpose: z.enum(["EXTERNAL_TASTE_QUERY", "SHARED_SESSION", "OPTIONAL_MEANING"]),
  notice_version: z.string().min(1).max(40),
  accepted: z.boolean(),
});

/** POST /consents: record one purpose-specific choice for the caller (R16). */
export const POST = handle<unknown>(async (request) => {
  assertSameOrigin(request);
  idempotencyKey(request);
  const actor = await resolveActor();
  const b = await readJson(request, Body);
  return fromResult(
    await callApi("record_consent", [actor.actorId, actor.workspaceId, b.purpose, b.notice_version, b.accepted, randomUUID()]),
    (d) => d,
    201,
  );
});

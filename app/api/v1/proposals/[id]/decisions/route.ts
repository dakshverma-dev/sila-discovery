import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertSameOrigin, fromResult, handle, idempotencyKey, readJson, resolveActor, uuid } from "@/lib/api/http";
import { callApi } from "@/lib/db/api";

const Body = z.strictObject({
  proposal_version_id: uuid,
  expected_version: z.int().min(1),
  group_id: uuid,
  decision: z.enum(["ACCEPT", "DECLINE"]),
  reason_category: z.enum(["SUBJECT", "INTERPRETATION", "COST", "TIME", "ACCESS", "SHARING", "OTHER"]).optional(),
  reason: z.string().max(2000).optional(),
});

export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await resolveActor();
  const b = await readJson(request, Body);
  return fromResult(
    await callApi("respond_to_proposal", [
      actor.actorId, id, b.proposal_version_id, b.expected_version, b.group_id, b.decision,
      b.reason_category ?? null, b.reason ?? null, randomUUID(), key,
    ]),
  );
});

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertSameOrigin, fromResult, handle, idempotencyKey, readJson, resolveActor, uuid } from "@/lib/api/http";
import { callApi } from "@/lib/db/api";

const Body = z.strictObject({
  proposal_version_id: uuid,
  expected_version: z.int().min(1),
  group_id: uuid,
  accept_shared_session: z.literal(true),
  adult_declaration: z.literal(true),
});

export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await resolveActor();
  const b = await readJson(request, Body);
  return fromResult(
    await callApi("reserve_seat", [
      actor.actorId, id, b.proposal_version_id, b.expected_version, b.group_id,
      b.accept_shared_session, b.adult_declaration, randomUUID(), key,
    ]),
    (d) => d,
    201,
  );
});

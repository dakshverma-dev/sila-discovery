import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireCurrentVersion } from "@/lib/api/proposals";
import { assertSameOrigin, fromResult, handle, idempotencyKey, readJson, resolveActor, uuid } from "@/lib/api/http";
import { callApi } from "@/lib/db/api";

const Body = z.strictObject({ proposal_version_id: uuid, expected_version: z.int().min(1) });

export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await resolveActor();
  const b = await readJson(request, Body);
  await requireCurrentVersion(actor.actorId, id, b);
  return fromResult(await callApi("confirm_booking", [actor.actorId, id, b.expected_version, randomUUID(), key]));
});

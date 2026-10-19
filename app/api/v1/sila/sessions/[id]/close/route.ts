import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { closeSession } from "@/lib/sila/commands/refunds";
const Body = z.strictObject({ expected_version: z.int().positive(), cause: z.enum(["unconfirmed", "venue_fault"]), reason: z.string().trim().min(1).max(500) });
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const actor = await requireApiActor(request);
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await closeSession(actor, key, id, b.expected_version, b.cause, b.reason));
});

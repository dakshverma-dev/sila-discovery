import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { publishSession } from "@/lib/sila/commands/sessions";

const Body = z.strictObject({ expected_version: z.int().min(1) });

/** POST /api/v1/sila/sessions/:id/publish: coordinator publishes a ready draft (409 NOT_READY with blockers). */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await publishSession(actor, key, id, b.expected_version), (d) => d, 200, { details: true });
});

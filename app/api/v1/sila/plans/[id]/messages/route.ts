import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { postPlanMessage } from "@/lib/sila/commands/plans";

// The database trims and checks 1–2000 characters (INVALID_FIELDS on `body`).
const Body = z.strictObject({ body: z.string() });

/** POST /api/v1/sila/plans/:id/messages: the organiser, a venue member or an operator adds a message. */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await postPlanMessage(actor, key, id, b.body), (d) => d, 201, { details: true });
});

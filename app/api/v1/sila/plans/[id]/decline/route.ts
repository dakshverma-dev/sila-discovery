import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { declinePlan } from "@/lib/sila/commands/commitments";

const Body = z.strictObject({ reason: z.string().trim().min(1, "Give a reason.").max(500) });

/** POST /api/v1/sila/plans/:id/decline: a venue coordinator declines a request that has not committed. */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await declinePlan(actor, key, id, b.reason), (d) => d, 200, { details: true });
});

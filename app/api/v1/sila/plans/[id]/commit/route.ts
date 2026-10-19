import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { commitPlan } from "@/lib/sila/commands/commitments";

// Totals are never accepted from the client; the database computes them (§18).
const Body = z.strictObject({ places: z.int().min(1), terms_version: z.int().min(1) });

/**
 * POST /api/v1/sila/plans/:id/commit: the organiser commits the approved
 * places, conditional on the minimum. Rejections use CommitRejection codes
 * (409, or 422 for QUANTITY_NOT_APPROVED).
 */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await commitPlan(actor, key, id, b.places, b.terms_version), (d) => d, 201, { details: true });
});

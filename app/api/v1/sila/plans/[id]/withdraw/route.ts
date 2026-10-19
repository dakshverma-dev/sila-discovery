import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { withdrawPlan } from "@/lib/sila/commands/payments";

const Body = z.strictObject({
  expected_version: z.int().min(1),
  reason: z.string().trim().min(1, "Give a reason.").max(500),
});

/**
 * POST /api/v1/sila/plans/:id/withdraw: the organiser withdraws their club's
 * commitment. Before payment opens the places are released (`outcome:
 * "released"`); afterwards the venue reviews it (`outcome: "venue_review"`).
 * `expected_version` is the plan version the organiser saw; a stale one (for
 * example payment opened since) returns VERSION_CONFLICT (409). A plan without
 * live places returns NOT_COMMITTED (409).
 */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await withdrawPlan(actor, key, id, b.expected_version, b.reason), (d) => d, 200, { details: true });
});

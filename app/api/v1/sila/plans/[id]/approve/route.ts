import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { approvePlan } from "@/lib/sila/commands/commitments";

// The database checks 1..capacity (INVALID_FIELDS on `places`) and the terms version (STALE_TERMS).
const Body = z.strictObject({ places: z.int().min(1), terms_version: z.int().min(1) });

/** POST /api/v1/sila/plans/:id/approve: a venue coordinator approves a quantity. Reserves nothing. */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await approvePlan(actor, key, id, b.places, b.terms_version), (d) => d, 200, { details: true });
});

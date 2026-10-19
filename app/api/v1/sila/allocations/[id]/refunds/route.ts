import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { recordRefund } from "@/lib/sila/commands/refunds";
const Body = z.strictObject({ expected_version: z.int().positive(), amount_minor: z.int().positive().max(1000000000),
  reference: z.string().trim().min(1).max(100), returned_at: z.iso.datetime({ offset: true }), evidence: z.string().trim().min(1).max(1000) });
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const actor = await requireApiActor(request);
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await recordRefund(actor, key, id, b.expected_version, b.amount_minor, b.reference, new Date(b.returned_at), b.evidence));
});

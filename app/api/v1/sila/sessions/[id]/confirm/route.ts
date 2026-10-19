import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { confirmSession } from "@/lib/sila/commands/receipts";

const Body = z.strictObject({ expected_version: z.int().min(1), diary_checked: z.boolean() });

/**
 * POST /api/v1/sila/sessions/:id/confirm: the venue coordinator confirms at the
 * session version they saw after checking the external diary. Unmet
 * prerequisites return 409 NOT_READY with `details.blockers` in
 * confirmationBlockers order; a session no longer awaiting confirmation
 * returns SESSION_NOT_OPEN (409).
 */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await confirmSession(actor, key, id, b.expected_version, b.diary_checked), (d) => d, 201,
                    { details: true });
});

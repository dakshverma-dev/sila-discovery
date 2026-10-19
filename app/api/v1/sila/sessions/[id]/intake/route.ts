import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { setIntake } from "@/lib/sila/commands/sessions";

const Body = z
  .strictObject({
    paused: z.boolean(),
    reason: z.string().trim().max(500).nullish(),
    expected_version: z.number().int().positive(),
  })
  .refine((b) => !b.paused || !!b.reason, { path: ["reason"], message: "Give a reason for pausing new requests." });

/** POST /api/v1/sila/sessions/:id/intake: pause (reason required) or resume new requests. */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  return fromResult(await setIntake(actor, key, id, b.paused, b.reason || null, b.expected_version),
    (d) => d, 200, { details: true });
});

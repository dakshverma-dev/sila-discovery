import { z } from "zod";
import { assertSameOrigin, fromResult, handle, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { saveSessionDraft } from "@/lib/sila/commands/sessions";
import { sessionDraftSchema } from "@/lib/sila/forms";

const Body = z
  .strictObject({
    venue_id: uuid,
    session_id: uuid.nullish(),
    expected_version: z.int().min(1).nullish(),
    draft: sessionDraftSchema,
  })
  .refine((b) => !b.session_id || b.expected_version != null, {
    path: ["expected_version"],
    message: "Required when editing a session.",
  });

/** POST /api/v1/sila/sessions: create (no session_id) or update a session draft. */
export const POST = handle<unknown>(async (request) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const actor = await requireApiActor(request);
  const b = await readJson(request, Body, "INVALID_FIELDS");
  const result = await saveSessionDraft(actor, key, {
    venueId: b.venue_id,
    sessionId: b.session_id ?? null,
    expectedVersion: b.expected_version ?? null,
    draft: b.draft,
  });
  return fromResult(result, (d) => d, b.session_id ? 200 : 201, { details: true });
});

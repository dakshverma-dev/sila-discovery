import { z } from "zod";
import { assertSameOrigin, fromResult, handle, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { PLAN_SOURCES, submitPlan } from "@/lib/sila/commands/plans";

// Types only here; lengths and the capacity limit are checked by the database,
// which returns INVALID_FIELDS keyed by these field names.
const Body = z.strictObject({
  session_id: uuid,
  club_name: z.string(),
  places: z.int(),
  source: z.enum(PLAN_SOURCES).default("unknown"),
});

/** POST /api/v1/sila/plans: an organiser requests places for their club on a session. */
export const POST = handle<unknown>(async (request) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const actor = await requireApiActor(request);
  const b = await readJson(request, Body, "INVALID_FIELDS");
  const result = await submitPlan(actor, key, {
    sessionId: b.session_id,
    clubName: b.club_name,
    places: b.places,
    source: b.source,
  });
  return fromResult(result, (d) => d, 201, { details: true });
});

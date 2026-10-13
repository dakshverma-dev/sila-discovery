import { randomUUID } from "node:crypto";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, resolveActor, uuid } from "@/lib/api/http";
import { callApi } from "@/lib/db/api";

export const DELETE = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Reservation not found.");
  const actor = await resolveActor();
  return fromResult(await callApi("withdraw_seat", [actor.actorId, id, randomUUID(), key]));
});

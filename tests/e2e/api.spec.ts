import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

/*
 * /api/v1 contract checks (D16, T01, T15, T21). Uses a fresh sandbox per test
 * through the public demo session endpoint.
 */

test.describe.configure({ mode: "serial" });
test.skip(({ viewport }) => (viewport?.width ?? 0) < 400, "API checks run once, on the desktop project");

async function sandbox(request: APIRequestContext) {
  const r = await request.post("/api/v1/demo/sessions");
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.data.synthetic).toBe(true);
  expect(body.meta.request_id).toBeTruthy();
  return body.data as { workspace_id: string; personas: Array<{ user_id: string; display_name: string; role: string }> };
}

async function actAs(request: APIRequestContext, personas: Array<{ user_id: string; display_name: string }>, name: string) {
  const persona = personas.find((p) => p.display_name === name)!;
  const r = await request.post("/api/v1/demo/role", { data: { persona_id: persona.user_id } });
  expect(r.status()).toBe(200);
}

const write = (data: unknown, key = randomUUID()) => ({ data, headers: { "Idempotency-Key": key } });

test("rejects unauthenticated and malformed requests with typed envelopes", async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL });
  const r = await anon.get(`/api/v1/proposals/${randomUUID()}`);
  expect(r.status()).toBe(401);
  const body = await r.json();
  expect(body.error).toMatchObject({ code: "AUTH_REQUIRED", retryable: false });
  expect(body.meta.request_id).toBeTruthy();
  expect((await anon.post("/api/v1/internal/tick")).status()).toBe(401);
  await anon.dispose();
});

test("runs the reservation workflow through the HTTP contract", async ({ request }) => {
  const { personas } = await sandbox(request);

  // Unknown or inaccessible objects are 404, never a leak of their existence.
  const missing = await request.get(`/api/v1/proposals/${randomUUID()}`);
  expect(missing.status()).toBe(404);

  // The caller's own groups come from their export (R16), not from guessing.
  const exported = (await (await request.get("/api/v1/me/export")).json()).data;
  expect(exported.user.is_synthetic).toBe(true);
  const group = exported.group_memberships.find((g: { role: string }) => g.role === "ORGANISER");

  // Mutations require an Idempotency-Key.
  const noKey = await request.post("/api/v1/match-runs", {
    data: { group_ids: [group.group_id], experience_ids: [], expected_brief_versions: {} },
  });
  expect(noKey.status()).toBe(400);
  expect((await noKey.json()).error.field_errors["Idempotency-Key"]).toBeTruthy();

  // A stale brief version is a conflict.
  const stale = await request.post("/api/v1/match-runs", write({
    group_ids: [group.group_id], experience_ids: [], expected_brief_versions: { [group.group_id]: 99 },
  }));
  expect(stale.status()).toBe(409);

  const queued = await request.post("/api/v1/match-runs", write({
    group_ids: [group.group_id], experience_ids: [], expected_brief_versions: { [group.group_id]: group.latest_brief_version },
  }));
  expect(queued.status()).toBe(202);
  const runId = (await queued.json()).data.id;

  let run: { state: string; result: { candidates: Array<{ proposal_id: string }> } | null } = { state: "QUEUED", result: null };
  for (let i = 0; i < 30 && (run.state === "QUEUED" || run.state === "RUNNING"); i++) {
    await new Promise((r) => setTimeout(r, 300));
    run = (await (await request.get(`/api/v1/match-runs/${runId}`)).json()).data;
  }
  expect(run.state).toBe("SUCCEEDED");
  const proposalId = run.result!.candidates[0]!.proposal_id;

  // Draft view as the organiser follows the strict ProposalView contract.
  const draft = (await (await request.get(`/api/v1/proposals/${proposalId}`)).json()).data;
  expect(Object.keys(draft).sort()).toEqual([
    "active_reservations", "capacity", "currency", "deadline", "evidence_ids", "experience_title", "group_summaries",
    "id", "payment_status", "proposal_version_id", "required_seats", "slot_end_at", "slot_start_at", "source_mode",
    "state", "ticket_pence", "timezone", "venue_name", "version",
  ]);
  expect(draft).toMatchObject({ state: "DRAFT", payment_status: "NOT_COLLECTED", currency: "GBP", source_mode: "synthetic" });

  // Organisers cannot publish; the venue can.
  const deadline = new Date(Date.parse(draft.slot_start_at) - 2 * 86_400_000).toISOString();
  const publishBody = { proposal_version_id: draft.proposal_version_id, expected_version: 1, deadline };
  expect((await request.post(`/api/v1/proposals/${proposalId}/publish`, write(publishBody))).status()).toBe(403);
  await actAs(request, personas, "Rowan (venue manager)");
  const publishKey = randomUUID();
  const published = await request.post(`/api/v1/proposals/${proposalId}/publish`, write(publishBody, publishKey));
  expect(published.status()).toBe(200);
  // Replaying the same key returns the original outcome without publishing twice.
  const replay = await request.post(`/api/v1/proposals/${proposalId}/publish`, write(publishBody, publishKey));
  expect((await replay.json()).meta.replayed).toBe(true);

  // Cross-site writes are refused (CSRF).
  const crossSite = await request.post(`/api/v1/proposals/${proposalId}/confirm`, {
    data: { proposal_version_id: draft.proposal_version_id, expected_version: 1 },
    headers: { "Idempotency-Key": randomUUID(), Origin: "https://evil.example" },
  });
  expect(crossSite.status()).toBe(403);

  // Not ready yet: confirmation is refused with a typed NOT_READY.
  const early = await request.post(`/api/v1/proposals/${proposalId}/confirm`,
    write({ proposal_version_id: draft.proposal_version_id, expected_version: 1 }));
  expect(early.status()).toBe(409);
  expect((await early.json()).error.code).toBe("NOT_READY");

  // A stale expected_version is a conflict.
  const staleConfirm = await request.post(`/api/v1/proposals/${proposalId}/confirm`,
    write({ proposal_version_id: draft.proposal_version_id, expected_version: 2 }));
  expect((await staleConfirm.json()).error.code).toBe("VERSION_CONFLICT");

  // Organiser accepts; a participant reserves exactly one seat via the API.
  await actAs(request, personas, "Ailsa (book club organiser)");
  const accepted = await request.post(`/api/v1/proposals/${proposalId}/decisions`, write({
    proposal_version_id: draft.proposal_version_id, expected_version: 1, group_id: group.group_id, decision: "ACCEPT",
  }));
  expect(accepted.status()).toBe(200);

  await actAs(request, personas, "Bram (book club)");
  const seatBody = {
    proposal_version_id: draft.proposal_version_id, expected_version: 1, group_id: group.group_id,
    accept_shared_session: true, adult_declaration: true,
  };
  const notAdult = await request.post(`/api/v1/proposals/${proposalId}/reservations`,
    write({ ...seatBody, adult_declaration: false }));
  expect(notAdult.status()).toBe(400);
  const seat = await request.post(`/api/v1/proposals/${proposalId}/reservations`, write(seatBody));
  expect(seat.status()).toBe(201);
  const seatData = (await seat.json()).data;
  expect(seatData.payment_status).toBe("NOT_COLLECTED");
  const again = await request.post(`/api/v1/proposals/${proposalId}/reservations`, write(seatBody));
  expect((await again.json()).error.code).toBe("ALREADY_RESERVED");

  const withdrawn = await request.delete(`/api/v1/reservations/${seatData.reservation_id}`, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  expect(withdrawn.status()).toBe(200);
});

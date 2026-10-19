import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { ApiResult } from "@/lib/db/api";
import {
  admin, app, key, makePerson, makeVenue, okData, publishedSession, sila, submittedPlan,
} from "./fixtures";

afterAll(async () => {
  await Promise.all([admin.end(), app.end()]);
});

const DAY_MS = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();
const newPerson = () => makePerson(`${randomUUID()}@test.example`);

/** Field names of `PlanFacts` in lib/sila/status.ts. */
const FACT_KEYS = [
  "submitted", "approved", "committed", "closed", "minimumReached", "openingBlocked", "paymentOpened",
  "ownPaymentReported", "ownDepositVerified", "allDepositsVerified", "confirmed", "balanceDefaultEstablished",
  "amendmentPending",
].sort();

async function errorOf(p: Promise<ApiResult<unknown>>) {
  const r = await p;
  if (r.ok) throw new Error("Expected an error envelope");
  return r.error;
}

async function code(p: Promise<ApiResult<unknown>>): Promise<string> {
  const r = await p;
  return r.ok ? "OK" : r.error.code;
}

interface Submitted { plan_id: string; plan_ref: string }
interface MyPlan {
  plan: Record<string, unknown>;
  session: Record<string, unknown>;
  messages: { id: string; author_role: string; body: string; created_at: string; from_me: boolean }[];
  facts: Record<string, boolean>;
}
interface SessionRequests {
  session_id: string;
  plans: { id: string; plan_ref: string; club_name: string; requested_places: number;
           group_total_minor: number; status: string }[];
}

const planRows = async (sessionId: string) =>
  (await admin.query("select * from sila.plans where session_id = $1", [sessionId])).rows;

describe("sila submit_plan", () => {
  it("creates a request with a PL reference and an organiser view", async () => {
    const session = await publishedSession();
    const organiser = await newPerson();
    const made = await okData(sila<Submitted>("submit_plan", organiser.personId, key(), session.sessionId,
                                              "  Thursday Book Club  ", 8, null));
    expect(made.plan_ref).toMatch(/^PL\d+$/);
    expect(Number(made.plan_ref.slice(2))).toBeGreaterThanOrEqual(1001);

    const [row] = await planRows(session.sessionId);
    expect(row).toMatchObject({ id: made.plan_id, club_name: "Thursday Book Club", requested_places: 8,
                                organiser_id: organiser.personId, organiser_email: organiser.email,
                                source: "unknown", status: "submitted", version: 1 });

    const mine = await okData(sila<MyPlan>("get_my_plan", organiser.personId, made.plan_id));
    expect(mine.plan).toEqual({ id: made.plan_id, plan_ref: made.plan_ref, club_name: "Thursday Book Club",
                                requested_places: 8, source: "unknown", status: "submitted",
                                declined_reason: null, version: 1 });
    // Same public shape as get_public_session.
    expect(mine.session).toEqual(await okData(sila("get_public_session", session.sessionId)));
    expect(mine.messages).toEqual([]);
    expect(Object.keys(mine.facts).sort()).toEqual(FACT_KEYS);
    expect(Object.values(mine.facts).every((v) => typeof v === "boolean")).toBe(true);
    expect(mine.facts).toMatchObject({ submitted: true, approved: false, committed: false, closed: false });
    expect(Object.entries(mine.facts).filter(([, v]) => v).map(([k]) => k)).toEqual(["submitted"]);

    const audit = await admin.query("select command, entity, version from sila.audit_events where entity_id = $1",
                                    [made.plan_id]);
    expect(audit.rows).toEqual([{ command: "submit_plan", entity: "plan", version: 1 }]);
  });

  it("records an allowed source", async () => {
    const plan = await submittedPlan({ source: "sila_introduction" });
    const mine = await okData(sila<MyPlan>("get_my_plan", plan.organiser.personId, plan.planId));
    expect(mine.plan.source).toBe("sila_introduction");
  });

  it("replays the same request once and rejects a different payload on the same key", async () => {
    const session = await publishedSession();
    const organiser = await newPerson();
    const k = key();
    const first = await sila<Submitted>("submit_plan", organiser.personId, k, session.sessionId, "Walkers", 6, null);
    const again = await sila<Submitted>("submit_plan", organiser.personId, k, session.sessionId, "Walkers", 6, null);
    expect(first.ok).toBe(true);
    expect(again).toMatchObject({ ok: true, replayed: true, data: first.ok ? first.data : {} });
    expect(await planRows(session.sessionId)).toHaveLength(1);

    expect(await code(sila("submit_plan", organiser.personId, k, session.sessionId, "Walkers", 7, null)))
      .toBe("IDEMPOTENCY_CONFLICT");
    expect(await planRows(session.sessionId)).toHaveLength(1);
  });

  it("refuses sessions that are not taking requests", async () => {
    const organiser = await newPerson();
    const draft = await publishedSession({ phase: "draft", published_at: null });
    expect(await code(sila("submit_plan", organiser.personId, key(), draft.sessionId, "Club", 4, null)))
      .toBe("SESSION_NOT_OPEN");
    const paused = await publishedSession({ intake_paused: true, intake_paused_reason: "Instructor unwell" });
    expect(await code(sila("submit_plan", organiser.personId, key(), paused.sessionId, "Club", 4, null)))
      .toBe("INTAKE_PAUSED");
    const late = await publishedSession({ fill_by: at(-1) });
    expect(await code(sila("submit_plan", organiser.personId, key(), late.sessionId, "Club", 4, null)))
      .toBe("FILL_DEADLINE_PASSED");
    for (const s of [draft, paused, late]) expect(await planRows(s.sessionId)).toHaveLength(0);
  });

  it("refuses new requests once the session has reached its minimum", async () => {
    const organiser = await newPerson();
    const full = await publishedSession({ minimum_reached_at: at(-0.1) });
    expect(await code(sila("submit_plan", organiser.personId, key(), full.sessionId, "Club", 4, null)))
      .toBe("MINIMUM_ALREADY_REACHED");
    expect(await planRows(full.sessionId)).toHaveLength(0);
    // The phase check still comes first.
    const draft = await publishedSession({ phase: "draft", published_at: null, minimum_reached_at: at(-0.1) });
    expect(await code(sila("submit_plan", organiser.personId, key(), draft.sessionId, "Club", 4, null)))
      .toBe("SESSION_NOT_OPEN");
  });

  it("returns field errors keyed by API field names", async () => {
    const session = await publishedSession();
    const organiser = await newPerson();
    const tooMany = await errorOf(sila("submit_plan", organiser.personId, key(), session.sessionId, "Club", 21, null));
    expect(tooMany.code).toBe("INVALID_FIELDS");
    expect(Object.keys(tooMany.details?.field_errors as object)).toEqual(["places"]);

    const several = await errorOf(sila("submit_plan", organiser.personId, key(), session.sessionId, "   ", 0,
                                       "newspaper"));
    expect(several.code).toBe("INVALID_FIELDS");
    expect(Object.keys(several.details?.field_errors as object).sort()).toEqual(["club_name", "places", "source"]);

    const long = await errorOf(sila("submit_plan", organiser.personId, key(), session.sessionId, "x".repeat(121), 4,
                                    null));
    expect(Object.keys(long.details?.field_errors as object)).toEqual(["club_name"]);
    expect(await planRows(session.sessionId)).toHaveLength(0);
  });

  it("does not let an unknown actor or a missing session through", async () => {
    const session = await publishedSession();
    const organiser = await newPerson();
    expect(await code(sila("submit_plan", randomUUID(), key(), session.sessionId, "Club", 4, null)))
      .toBe("NOT_FOUND");
    expect(await code(sila("submit_plan", organiser.personId, key(), randomUUID(), "Club", 4, null)))
      .toBe("NOT_FOUND");
  });
});

describe("sila plan visibility", () => {
  it("shows a plan only to its organiser", async () => {
    const plan = await submittedPlan();
    const other = await newPerson();
    const r = await sila("get_my_plan", other.personId, plan.planId);
    expect(r).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "Not found.", retryable: false,
                                            details: {} } });
    expect(await code(sila("get_my_plan", plan.venue.coordinator.personId, plan.planId))).toBe("NOT_FOUND");
    expect(await code(sila("get_my_plan", plan.organiser.personId, randomUUID()))).toBe("NOT_FOUND");
  });

  it("lists only the organiser's own plans", async () => {
    const organiser = await newPerson();
    const a = await submittedPlan({ organiser, clubName: "Club A" });
    const b = await submittedPlan({ organiser, clubName: "Club B" });
    await submittedPlan({ session: { sessionId: a.sessionId, venue: a.venue } });
    const { plans } = await okData(sila<{ plans: { id: string; plan_ref: string; facts: Record<string, boolean>;
                                                     session: { id: string } }[] }>("list_my_plans",
                                                                                    organiser.personId));
    expect(plans.map((p) => p.id).sort()).toEqual([a.planId, b.planId].sort());
    expect(plans.every((p) => Object.keys(p.facts).sort().join() === FACT_KEYS.join())).toBe(true);
    expect(plans.find((p) => p.id === a.planId)?.session.id).toBe(a.sessionId);
  });

  it("lists a session's requests with group totals for its venue only", async () => {
    const plan = await submittedPlan({ places: 9 });
    const venueB = await makeVenue();
    const stranger = await newPerson();
    expect(await code(sila("list_session_requests", venueB.coordinator.personId, plan.sessionId))).toBe("NOT_FOUND");
    expect(await code(sila("list_session_requests", stranger.personId, plan.sessionId))).toBe("NOT_FOUND");
    expect(await code(sila("list_session_requests", plan.organiser.personId, plan.sessionId))).toBe("NOT_FOUND");

    for (const viewer of [plan.venue.coordinator, plan.venue.finance, plan.venue.operator]) {
      const view = await okData(sila<SessionRequests>("list_session_requests", viewer.personId, plan.sessionId));
      expect(view.session_id).toBe(plan.sessionId);
      expect(view.plans).toEqual([expect.objectContaining({
        id: plan.planId, plan_ref: plan.planRef, club_name: "Thursday Book Club", requested_places: 9,
        group_total_minor: 3500 * 9, status: "submitted" })]);
    }
  });

  it("treats a declined plan or a cancelled session as closed", async () => {
    const declined = await submittedPlan();
    await admin.query("update sila.plans set status = 'declined', declined_reason = 'Full', declined_at = now() " +
                      "where id = $1", [declined.planId]);
    const d = await okData(sila<MyPlan>("get_my_plan", declined.organiser.personId, declined.planId));
    expect(d.facts.closed).toBe(true);
    expect(d.plan).toMatchObject({ status: "declined", declined_reason: "Full" });

    const cancelled = await submittedPlan();
    await admin.query("update sila.sessions set phase = 'cancelled' where id = $1", [cancelled.sessionId]);
    const c = await okData(sila<MyPlan>("get_my_plan", cancelled.organiser.personId, cancelled.planId));
    expect(c.facts.closed).toBe(true);
    expect(c.session).toMatchObject({ id: cancelled.sessionId, phase: "cancelled", intake_open: false });
  });
});

describe("sila plan messages", () => {
  it("records the author's role and shows the conversation to the organiser", async () => {
    const plan = await submittedPlan();
    const operator = plan.venue.operator;
    const fromOrganiser = await okData(sila<{ message_id: string; author_role: string }>(
      "post_plan_message", plan.organiser.personId, key(), plan.planId, "  Can we bring a guest?  "));
    expect(fromOrganiser.author_role).toBe("organiser");
    const fromVenue = await okData(sila<{ author_role: string }>(
      "post_plan_message", plan.venue.coordinator.personId, key(), plan.planId, "Yes, within your 8 places."));
    expect(fromVenue.author_role).toBe("venue");
    expect(await okData(sila<{ author_role: string }>(
      "post_plan_message", operator.personId, key(), plan.planId, "Noted."))).toMatchObject({ author_role: "operator" });

    const mine = await okData(sila<MyPlan>("get_my_plan", plan.organiser.personId, plan.planId));
    expect(mine.messages.map((m) => [m.author_role, m.body, m.from_me])).toEqual([
      ["organiser", "Can we bring a guest?", true],
      ["venue", "Yes, within your 8 places.", false],
      ["operator", "Noted.", false],
    ]);

    // The outbox carries ids only, never the message text.
    const outbox = await admin.query("select payload from sila.outbox where dedupe_key = $1",
                                     [`plan.message:${fromOrganiser.message_id}`]);
    expect(outbox.rows).toEqual([{ payload: { plan_id: plan.planId, message_id: fromOrganiser.message_id } }]);
    const audit = await admin.query("select reason from sila.audit_events where entity_id = $1",
                                    [fromOrganiser.message_id]);
    expect(audit.rows).toEqual([{ reason: null }]);
  });

  it("replays a repeated message and refuses people outside the plan", async () => {
    const plan = await submittedPlan();
    const k = key();
    const first = await okData(sila<{ message_id: string }>("post_plan_message", plan.organiser.personId, k,
                                                            plan.planId, "Hello"));
    expect(await sila("post_plan_message", plan.organiser.personId, k, plan.planId, "Hello"))
      .toMatchObject({ ok: true, replayed: true, data: first });

    const stranger = await newPerson();
    const venueB = await makeVenue();
    expect(await code(sila("post_plan_message", stranger.personId, key(), plan.planId, "Hi"))).toBe("NOT_FOUND");
    expect(await code(sila("post_plan_message", venueB.coordinator.personId, key(), plan.planId, "Hi")))
      .toBe("NOT_FOUND");
    expect(await code(sila("post_plan_message", plan.organiser.personId, key(), randomUUID(), "Hi")))
      .toBe("NOT_FOUND");
    const rows = await admin.query("select count(*)::int as n from sila.plan_messages where plan_id = $1",
                                   [plan.planId]);
    expect(rows.rows[0].n).toBe(1);
  });

  it("validates the message body", async () => {
    const plan = await submittedPlan();
    for (const body of ["   ", "x".repeat(2001), null]) {
      const e = await errorOf(sila("post_plan_message", plan.organiser.personId, key(), plan.planId, body));
      expect(e.code).toBe("INVALID_FIELDS");
      expect(Object.keys(e.details?.field_errors as object)).toEqual(["body"]);
    }
  });
});

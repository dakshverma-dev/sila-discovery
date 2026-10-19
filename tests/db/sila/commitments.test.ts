import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { ApiResult } from "@/lib/db/api";
import { scottishVenueCalendar } from "@/lib/sila/calendar";
import { scheduledPaymentOpening } from "@/lib/sila/schedule";
import { toLocal } from "@/lib/sila/time";
import { APP_URL } from "../helpers";
import {
  admin, app, approvedPlan, committedPlan, key, makePerson, okData, publishedSession, sila, submittedPlan,
  type TestPlan,
} from "./fixtures";

afterAll(async () => {
  await Promise.all([admin.end(), app.end(), globalThis.__scbPool?.end()]);
});

const DAY_MS = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();
const newPerson = () => makePerson(`${randomUUID()}@test.example`);

async function code(p: Promise<ApiResult<unknown>>): Promise<string> {
  const r = await p;
  return r.ok ? "OK" : r.error.code;
}

interface Committed {
  allocation_id: string;
  places_after: number;
  reaches_minimum: boolean;
  minimum_reached_at: string | null;
  next_action: "payment_scheduled" | "waiting_for_more_places";
  total_minor: number;
  deposit_minor: number;
  balance_minor: number;
}

const commit = (plan: TestPlan, places: number, termsVersion = 1, idem = key()) =>
  sila<Committed>("commit_plan", plan.organiser.personId, idem, plan.planId, places, termsVersion);

const approve = (plan: TestPlan, places: number, termsVersion = 1, actor = plan.venue.coordinator.personId) =>
  sila<{ approval_id: string }>("approve_plan", actor, key(), plan.planId, places, termsVersion);

const liveAllocations = async (sessionId: string) =>
  (await admin.query("select * from sila.allocations where session_id = $1 and status = 'live'", [sessionId])).rows;

describe("sila approve_plan and decline_plan", () => {
  it("records an approval that reserves nothing and can be replaced before commitment", async () => {
    const plan = await submittedPlan({ places: 8 });
    const first = await okData(approve(plan, 7));
    expect(first.approval_id).toEqual(expect.any(String));
    const second = await okData(approve(plan, 6));
    expect(second.approval_id).toBe(first.approval_id);
    const { rows } = await admin.query("select approved_places, terms_version, approver_id from sila.approvals " +
                                       "where plan_id = $1", [plan.planId]);
    expect(rows).toEqual([{ approved_places: 6, terms_version: 1, approver_id: plan.venue.coordinator.personId }]);
    expect(await liveAllocations(plan.sessionId)).toEqual([]);
    const view = await okData(sila<{ committed_places: number }>("get_public_session", plan.sessionId));
    expect(view.committed_places).toBe(0);
    const audit = await admin.query("select command from sila.audit_events where entity_id = $1 order by id",
                                    [plan.planId]);
    expect(audit.rows.map((r) => r.command)).toEqual(["submit_plan", "approve_plan", "approve_plan"]);
  });

  it("lets only a coordinator of the plan's venue approve or decline", async () => {
    const plan = await submittedPlan();
    const other = await submittedPlan();
    for (const actor of [plan.venue.finance, plan.venue.operator, plan.organiser, other.venue.coordinator]) {
      expect(await code(approve(plan, 7, 1, actor.personId))).toBe("NOT_FOUND");
      expect(await code(sila("decline_plan", actor.personId, key(), plan.planId, "Full"))).toBe("NOT_FOUND");
    }
    expect(await code(sila("approve_plan", plan.venue.coordinator.personId, key(), randomUUID(), 7, 1)))
      .toBe("NOT_FOUND");
    const { rows } = await admin.query("select count(*)::int as n from sila.idempotency where fn = 'approve_plan' " +
                                       "and actor = any($1)",
                                       [[plan.venue.finance.personId, plan.venue.operator.personId]]);
    expect(rows[0].n).toBe(0);
  });

  it("checks terms, quantity and plan state on approval", async () => {
    const plan = await submittedPlan();
    expect(await code(approve(plan, 7, 2))).toBe("STALE_TERMS");
    expect(await code(approve(plan, 0))).toBe("INVALID_FIELDS");
    expect(await code(approve(plan, 21))).toBe("INVALID_FIELDS");
    expect(await code(approve(plan, 20))).toBe("OK");

    const declined = await submittedPlan();
    const empty = await sila("decline_plan", declined.venue.coordinator.personId, key(), declined.planId, "   ");
    expect(empty.ok ? "OK" : empty.error.code).toBe("INVALID_FIELDS");
    await okData(sila("decline_plan", declined.venue.coordinator.personId, key(), declined.planId,
                      "We cannot run two groups that day."));
    expect(await code(approve(declined, 7))).toBe("PLAN_DECLINED");
    const mine = await okData(sila<{ plan: { status: string; declined_reason: string };
                                     facts: Record<string, boolean> }>("get_my_plan", declined.organiser.personId,
                                                                        declined.planId));
    expect(mine.plan).toMatchObject({ status: "declined", declined_reason: "We cannot run two groups that day." });
    expect(mine.facts.closed).toBe(true);

    const committed = await committedPlan({ places: 7 });
    expect(await code(approve(committed, 8))).toBe("ALREADY_COMMITTED");
    expect(await code(sila("decline_plan", committed.venue.coordinator.personId, key(), committed.planId, "No")))
      .toBe("ALREADY_COMMITTED");
  });
});

describe("sila commit_plan", () => {
  it("A commits 7 and waits for more places with server-computed money", async () => {
    const a = await approvedPlan({ places: 7 });
    const r = await okData(commit(a, 7));
    expect(r).toMatchObject({ places_after: 7, reaches_minimum: false, minimum_reached_at: null,
                              next_action: "waiting_for_more_places", total_minor: 24500, deposit_minor: 6125,
                              balance_minor: 18375 });
    const [row] = await liveAllocations(a.sessionId);
    const { rows: [s] } = await admin.query("select decision_by, platform_terms_version, minimum_reached_at " +
                                            "from sila.sessions where id = $1", [a.sessionId]);
    expect(row).toMatchObject({ id: r.allocation_id, plan_id: a.planId, places: 7, price_minor: 3500,
                                terms_version: 1, platform_terms_version: "platform-v1",
                                committed_by: a.organiser.personId, status: "live" });
    expect(Number(row.total_minor)).toBe(24500);
    expect(new Date(row.accepted_decision_by).getTime()).toBe(new Date(s.decision_by).getTime());
    expect(s.minimum_reached_at).toBeNull();

    const mine = await okData(sila<{ facts: Record<string, boolean>; approval: unknown; allocation: unknown;
                                     payment: unknown }>("get_my_plan", a.organiser.personId, a.planId));
    expect(mine.facts).toMatchObject({ approved: true, committed: true, minimumReached: false,
                                       openingBlocked: false });
    expect(mine.approval).toEqual({ approved_places: 7, terms_version: 1 });
    expect(mine.allocation).toMatchObject({ places: 7, total_minor: 24500, deposit_minor: 6125,
                                            balance_minor: 18375, status: "live" });
    expect(mine.payment).toEqual({ scheduled_for: null, blocked_reason: null, opened_at: null, pay_by: null,
                                   verify_by: null, payment_route: null, reports: [], verified_deposit_minor: 0 });
  });

  it("B approved 9 after A 7 reaches the minimum and queues one scheduling job", async () => {
    const a = await committedPlan({ places: 7 });
    const b = await approvedPlan({ session: { sessionId: a.sessionId, venue: a.venue }, places: 9 });
    const r = await okData(commit(b, 9));
    expect(r).toMatchObject({ places_after: 16, reaches_minimum: true, next_action: "payment_scheduled",
                              total_minor: 31500, deposit_minor: 7875, balance_minor: 23625 });
    expect(r.minimum_reached_at).toEqual(expect.any(String));
    const { rows } = await admin.query("select payload from sila.outbox where topic = 'payment.schedule' " +
                                       "and payload->>'session_id' = $1", [a.sessionId]);
    expect(rows).toHaveLength(1);
    const mine = await okData(sila<{ facts: Record<string, boolean> }>("get_my_plan", b.organiser.personId,
                                                                       b.planId));
    expect(mine.facts).toMatchObject({ committed: true, minimumReached: true, openingBlocked: false });
  });

  it("stamps the minimum with the clock read after the session lock, equal to the last commitment", async () => {
    const a = await committedPlan({ places: 7 });
    const b = await approvedPlan({ session: { sessionId: a.sessionId, venue: a.venue }, places: 9 });
    const blocker = await admin.connect();
    let unlockedAt = new Date(0);
    try {
      await blocker.query("begin");
      await blocker.query("select 1 from sila.sessions where id = $1 for update", [a.sessionId]);
      const pending = commit(b, 9);
      await new Promise((resolve) => setTimeout(resolve, 300));
      unlockedAt = (await blocker.query<{ t: Date }>("select clock_timestamp() as t")).rows[0]!.t;
      await blocker.query("commit");
      await okData(pending);
    } finally {
      blocker.release();
    }
    const { rows: [s] } = await admin.query("select minimum_reached_at from sila.sessions where id = $1",
                                            [a.sessionId]);
    const { rows } = await admin.query("select plan_id, committed_at from sila.allocations " +
                                       "where session_id = $1 and status = 'live'", [a.sessionId]);
    const last = rows.find((r) => r.plan_id === b.planId)!;
    const first = rows.find((r) => r.plan_id === a.planId)!;
    expect(s.minimum_reached_at.getTime()).toBeGreaterThanOrEqual(unlockedAt.getTime());
    expect(s.minimum_reached_at).toEqual(last.committed_at);
    expect(s.minimum_reached_at.getTime()).toBeGreaterThanOrEqual(first.committed_at.getTime());
  });

  it("B approved 8 after A 7 is rejected as below minimum", async () => {
    const a = await committedPlan({ places: 7 });
    const b = await approvedPlan({ session: { sessionId: a.sessionId, venue: a.venue }, places: 8 });
    expect(await code(commit(b, 8))).toBe("SECOND_CLUB_BELOW_MINIMUM");
    expect(await liveAllocations(a.sessionId)).toHaveLength(1);
  });

  it("rejects stale terms", async () => {
    const plan = await approvedPlan({ places: 7 });
    expect(await code(commit(plan, 7, 0))).toBe("STALE_TERMS");
    await admin.query("update sila.sessions set terms_version = 2 where id = $1", [plan.sessionId]);
    expect(await code(commit(plan, 7, 2))).toBe("STALE_TERMS");
    expect(await liveAllocations(plan.sessionId)).toEqual([]);
  });

  it("rejects a commit without approval or with a different quantity", async () => {
    const plan = await submittedPlan({ places: 7 });
    expect(await code(commit(plan, 7))).toBe("NOT_APPROVED");
    await okData(approve(plan, 7));
    const r = await commit(plan, 8);
    expect(r.ok ? "OK" : r.error.code).toBe("QUANTITY_NOT_APPROVED");
  });

  it("returns the original allocation when the same commit key is replayed", async () => {
    const plan = await approvedPlan({ places: 7 });
    const idem = key();
    const first = await commit(plan, 7, 1, idem);
    const again = await commit(plan, 7, 1, idem);
    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.replayed).toBe(true);
    expect(again.data.allocation_id).toBe(first.data.allocation_id);
    expect(await liveAllocations(plan.sessionId)).toHaveLength(1);
    expect(await code(commit(plan, 8, 1, idem))).toBe("IDEMPOTENCY_CONFLICT");
    expect(await code(commit(plan, 7))).toBe("ALREADY_COMMITTED");
  });

  it("rejects a third approved club after the minimum is reached", async () => {
    const a = await committedPlan({ places: 7 });
    const session = { sessionId: a.sessionId, venue: a.venue };
    // C requests and is approved before the minimum; afterwards no new request is accepted (§08).
    const c = await approvedPlan({ session, places: 2 });
    await committedPlan({ session, places: 9 });
    expect(await code(commit(c, 2))).toBe("MINIMUM_ALREADY_REACHED");
    expect(await liveAllocations(a.sessionId)).toHaveLength(2);
    const view = await okData(sila<{ intake_open: boolean; committed_places: number }>("get_public_session",
                                                                                       a.sessionId));
    expect(view).toMatchObject({ intake_open: false, committed_places: 16 });
  });

  it("rejects commitment while intake is paused", async () => {
    const plan = await approvedPlan({ places: 7 });
    await admin.query("update sila.sessions set intake_paused = true, intake_paused_reason = 'Checking room' " +
                      "where id = $1", [plan.sessionId]);
    expect(await code(commit(plan, 7))).toBe("INTAKE_PAUSED");
  });

  it("rejects commitment after the fill deadline", async () => {
    const plan = await approvedPlan({ places: 7 });
    await admin.query("update sila.sessions set fill_by = now() - interval '1 minute' where id = $1",
                      [plan.sessionId]);
    expect(await code(commit(plan, 7))).toBe("FILL_DEADLINE_PASSED");
  });

  it("rejects a session whose final decision is more than 21 days away", async () => {
    const session = await publishedSession({ decision_by: at(30), hold_expires_at: at(30), balance_due_at: at(31),
                                             starts_at: at(45), ends_at: at(45.1) });
    const plan = await approvedPlan({ session, places: 7 });
    expect(await code(commit(plan, 7))).toBe("WAIT_EXCEEDS_LIMIT");
  });

  it("a single club approved for 16 reaches the minimum", async () => {
    const plan = await approvedPlan({ places: 16 });
    const r = await okData(commit(plan, 16));
    expect(r).toMatchObject({ places_after: 16, reaches_minimum: true, next_action: "payment_scheduled" });
  });

  it("lets only the organiser commit", async () => {
    const plan = await approvedPlan({ places: 7 });
    for (const actor of [plan.venue.operator, plan.venue.coordinator, await newPerson()]) {
      expect(await code(sila("commit_plan", actor.personId, key(), plan.planId, 7, 1))).toBe("NOT_FOUND");
    }
    expect(await liveAllocations(plan.sessionId)).toEqual([]);
  });

  it("counts only live allocations in the public committed places", async () => {
    const a = await committedPlan({ places: 7 });
    const session = { sessionId: a.sessionId, venue: a.venue };
    await approvedPlan({ session, places: 5 });
    await submittedPlan({ session, places: 12 });
    const view = await okData(sila<{ committed_places: number; intake_open: boolean }>("get_public_session",
                                                                                       a.sessionId));
    expect(view).toMatchObject({ committed_places: 7, intake_open: true });

    const requests = await okData(sila<{ plans: { id: string; approval: unknown; allocation: unknown }[] }>(
      "list_session_requests", a.venue.coordinator.personId, a.sessionId));
    const row = requests.plans.find((p) => p.id === a.planId);
    expect(row?.approval).toMatchObject({ approved_places: 7, terms_version: 1 });
    expect(row?.allocation).toMatchObject({ places: 7, total_minor: 24500, status: "live" });
    expect(requests.plans.filter((p) => p.allocation === null)).toHaveLength(2);
  });
});

describe("sila schedule_payment_opening", () => {
  it("sets the opening once for the current minimum", async () => {
    const plan = await approvedPlan({ places: 16 });
    const r = await okData(commit(plan, 16));
    const first = await okData(sila<{ payment_scheduled_for: string; blocked_reason: string | null }>(
      "schedule_payment_opening", plan.sessionId, r.minimum_reached_at, at(2), null));
    expect(first.payment_scheduled_for).toEqual(expect.any(String));
    const second = await okData(sila<{ payment_scheduled_for: string }>(
      "schedule_payment_opening", plan.sessionId, r.minimum_reached_at, at(5), null));
    expect(second.payment_scheduled_for).toBe(first.payment_scheduled_for);
    const stale = await okData(sila<{ payment_scheduled_for: string }>(
      "schedule_payment_opening", plan.sessionId, at(-1), at(6), null));
    expect(stale.payment_scheduled_for).toBe(first.payment_scheduled_for);
  });
});

describe("commitPlan command", () => {
  process.env.DATABASE_URL ??= APP_URL;

  it("schedules payment at the next covered 11:45 when the minimum is reached", async () => {
    const { commitPlan } = await import("@/lib/sila/commands/commitments");
    const covered = Array.from({ length: 40 }, (_, i) => toLocal(new Date(Date.now() + i * DAY_MS)).date);
    const session = await publishedSession({ covered_dates: covered });
    const plan = await approvedPlan({ session, places: 16 });
    const r = await commitPlan({ personId: plan.organiser.personId, email: plan.organiser.email }, key(),
                               plan.planId, 16, 1);
    if (!r.ok) throw new Error(r.error.code);
    const expected = scheduledPaymentOpening(new Date(r.data.minimum_reached_at!), scottishVenueCalendar(),
                                             new Set(covered));
    expect(r.data.payment).toEqual({ scheduled_for: expect.any(String), blocked_reason: null });
    expect(new Date(r.data.payment!.scheduled_for!).getTime()).toBe(expected!.getTime());
    const mine = await okData(sila<{ facts: Record<string, boolean>; payment: { scheduled_for: string } }>(
      "get_my_plan", plan.organiser.personId, plan.planId));
    expect(mine.facts).toMatchObject({ minimumReached: true, openingBlocked: false });
    expect(new Date(mine.payment.scheduled_for).getTime()).toBe(expected!.getTime());
  });

  it("keeps the commitment and shows payment delayed when no covered day exists", async () => {
    const { commitPlan } = await import("@/lib/sila/commands/commitments");
    const plan = await approvedPlan({ places: 16 });
    const r = await commitPlan({ personId: plan.organiser.personId, email: plan.organiser.email }, key(),
                               plan.planId, 16, 1);
    if (!r.ok) throw new Error(r.error.code);
    expect(r.data.payment).toEqual({ scheduled_for: null, blocked_reason: "NO_COVERAGE" });
    expect(await liveAllocations(plan.sessionId)).toHaveLength(1);
    const mine = await okData(sila<{ facts: Record<string, boolean>; payment: unknown }>(
      "get_my_plan", plan.organiser.personId, plan.planId));
    expect(mine.facts).toMatchObject({ committed: true, minimumReached: true, openingBlocked: true });
    expect(mine.payment).toEqual({ scheduled_for: null, blocked_reason: "NO_COVERAGE", opened_at: null,
                                   pay_by: null, verify_by: null, payment_route: null, reports: [],
                                   verified_deposit_minor: 0 });
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { ApiResult } from "@/lib/db/api";
import { scottishVenueCalendar } from "@/lib/sila/calendar";
import { scheduledPaymentOpening } from "@/lib/sila/schedule";
import { addDays, fromLocal, toLocal } from "@/lib/sila/time";
import { APP_URL } from "../helpers";
import { admin, app, approvedPlan, committedPlan, key, makePerson, okData, publishedSession, sila, type TestPlan } from "./fixtures";

afterAll(async () => {
  await Promise.all([admin.end(), app.end(), globalThis.__scbPool?.end()]);
});

const DAY_MS = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();
const plus = (iso: string | Date, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString();
const today = () => toLocal(new Date()).date;
/** London wall time `hour:minute` on the date `days` from today, as an ISO instant. */
const london = (days: number, hour: number, minute: number) => fromLocal(addDays(today(), days), hour, minute)
  .toISOString();
/** The staffed 11:45 release `days` from today. */
const opening = (days = 1) => london(days, 11, 45);

async function code(p: Promise<ApiResult<unknown>>): Promise<string> {
  const r = await p;
  return r.ok ? "OK" : r.error.code;
}

async function errorOf(p: Promise<ApiResult<unknown>>) {
  const r = await p;
  if (r.ok) throw new Error("Expected an error envelope");
  return r.error;
}

/** Calls an internal clocked `sila.*` function through the admin pool. */
async function internal<T = Record<string, unknown>>(call: string, args: unknown[]): Promise<ApiResult<T>> {
  const { rows } = await admin.query<{ result: ApiResult<T> }>(`select ${call} as result`, args);
  return rows[0]!.result;
}

interface Released { payment_opened_at: string; pay_by: string; verify_by: string; opened: boolean }
interface Withdrawn { outcome: "released" | "venue_review"; cancelled_scheduled_opening: boolean; committed_places: number }
interface Rescheduled { payment_scheduled_for: string | null; blocked_reason: string | null; rescheduled: boolean }

const release = (sessionId: string, now: string, payBy: string, verifyBy: string) =>
  internal<Released>("sila.release_payment_opening($1::uuid, $2::timestamptz, $3::timestamptz, $4::timestamptz)",
                     [sessionId, now, payBy, verifyBy]);
const block = (sessionId: string, now: string, reason: string) =>
  internal<{ blocked_reason: string; blocked: boolean }>(
    "sila.block_payment_opening($1::uuid, $2::timestamptz, $3::text)", [sessionId, now, reason]);
const close = (sessionId: string, now: string) =>
  internal<{ session_id: string; released_allocations: number }>(
    "sila.close_unfilled_session($1::uuid, $2::timestamptz)", [sessionId, now]);

const planVersion = async (planId: string): Promise<number> =>
  (await admin.query("select version from sila.plans where id = $1", [planId])).rows[0].version;

/** Withdraws as the organiser at the plan's current version unless `version` is given. */
async function withdraw(plan: TestPlan, options: { reason?: string; idem?: string; actor?: string; version?: number } = {}) {
  const version = options.version ?? (await planVersion(plan.planId));
  return sila<Withdrawn>("withdraw_plan", options.actor ?? plan.organiser.personId, options.idem ?? key(),
                         plan.planId, version, options.reason ?? "Our coach is no longer available.");
}

const sessionRow = async (sessionId: string) =>
  (await admin.query("select * from sila.sessions where id = $1", [sessionId])).rows[0];
const allocationRow = async (allocationId: string) =>
  (await admin.query("select * from sila.allocations where id = $1", [allocationId])).rows[0];
const outbox = async (topic: string, payloadKey: string, id: string) =>
  (await admin.query("select * from sila.outbox where topic = $1 and payload ->> $2 = $3", [topic, payloadKey, id]))
    .rows;

/** A session whose single club committed 16 places (the minimum), with payment due at `scheduledFor`. */
async function scheduledSession(scheduledFor = opening(1), sessionOverrides: Record<string, unknown> = {}) {
  const session = await publishedSession(sessionOverrides);
  const plan = await committedPlan({ session, places: 16 });
  await admin.query("update sila.sessions set payment_scheduled_for = $2 where id = $1", [plan.sessionId, scheduledFor]);
  return plan;
}

const setPaused = (sessionId: string, paused: boolean) =>
  admin.query("update sila.sessions set intake_paused = $2, intake_paused_reason = case when $2 then 'Room check' end " +
              "where id = $1", [sessionId, paused]);

/** One minute into the staffed window of the opening scheduled at `scheduledFor`. */
const inWindow = (scheduledFor = opening(1)) => plus(scheduledFor, 60_000);

/** Two clubs, 7 then 9, reaching the minimum of 16, with payment scheduled. */
async function twoClubs(scheduledFor = opening(2)) {
  const a = await committedPlan({ places: 7 });
  const b = await committedPlan({ session: { sessionId: a.sessionId, venue: a.venue }, places: 9 });
  await admin.query("update sila.sessions set payment_scheduled_for = $2 where id = $1", [a.sessionId, scheduledFor]);
  return { a, b };
}

describe("sila release_payment_opening", () => {
  it("opens payment only once the scheduled time has come, and writes the deadlines once", async () => {
    const scheduledFor = opening(1);
    const plan = await scheduledSession(scheduledFor);
    const s = await sessionRow(plan.sessionId);
    const planBefore = await planVersion(plan.planId);
    const payBy = at(7);
    const verifyBy = at(8);
    const early = await errorOf(release(plan.sessionId, plus(scheduledFor, -60_000), payBy, verifyBy));
    expect(early).toMatchObject({ code: "NOT_READY", details: { reason: "NOT_DUE" } });
    expect((await sessionRow(plan.sessionId)).payment_opened_at).toBeNull();

    const r = await okData(release(plan.sessionId, scheduledFor, payBy, verifyBy));
    expect(r).toMatchObject({ opened: true });
    expect(new Date(r.payment_opened_at).getTime()).toBe(new Date(scheduledFor).getTime());
    const opened = await sessionRow(plan.sessionId);
    expect(opened.payment_opened_at.toISOString()).toBe(scheduledFor);
    expect(opened.pay_by.toISOString()).toBe(payBy);
    expect(opened.verify_by.toISOString()).toBe(verifyBy);
    expect(opened.version).toBe(s.version + 1);
    expect(await planVersion(plan.planId)).toBe(planBefore + 1);
    expect(await outbox("payment.opened", "allocation_id", plan.allocationId)).toHaveLength(1);

    const again = await okData(release(plan.sessionId, plus(scheduledFor, 3_600_000), at(9), at(10)));
    expect(again.opened).toBe(false);
    const after = await sessionRow(plan.sessionId);
    expect(after.payment_opened_at).toEqual(opened.payment_opened_at);
    expect(after.pay_by).toEqual(opened.pay_by);
    expect(after.verify_by).toEqual(opened.verify_by);
    expect(after.version).toBe(opened.version);
    expect(await planVersion(plan.planId)).toBe(planBefore + 1);
    expect(await outbox("payment.opened", "allocation_id", plan.allocationId)).toHaveLength(1);

    const mine = await okData(sila<{ facts: Record<string, boolean>; payment: Record<string, unknown> }>(
      "get_my_plan", plan.organiser.personId, plan.planId));
    expect(mine.facts).toMatchObject({ committed: true, minimumReached: true, paymentOpened: true });
    expect(mine.payment).toMatchObject({ opened_at: expect.any(String), pay_by: expect.any(String),
                                         verify_by: expect.any(String) });
  });

  it("opens until 12:30 London on the scheduled date and not after", async () => {
    const missed = await scheduledSession(opening(1));
    const before = await sessionRow(missed.sessionId);
    const r = await errorOf(release(missed.sessionId, london(1, 12, 31), at(7), at(8)));
    expect(r).toMatchObject({ code: "NOT_READY", details: { reason: "RELEASE_MISSED" } });
    expect(await sessionRow(missed.sessionId)).toEqual(before);
    expect(await outbox("payment.opened", "allocation_id", missed.allocationId)).toHaveLength(0);

    const late = await scheduledSession(opening(1));
    const ok = await okData(release(late.sessionId, london(1, 12, 29), at(7), at(8)));
    expect(ok.opened).toBe(true);
    expect((await sessionRow(late.sessionId)).payment_opened_at.toISOString()).toBe(london(1, 12, 29));
  });

  it("refuses when a withdrawal broke the minimum and clears the scheduling", async () => {
    const { a, b } = await twoClubs();
    await okData(withdraw(a));
    const r = await errorOf(release(a.sessionId, inWindow(opening(2)), at(8), at(9)));
    expect(r).toMatchObject({ code: "NOT_READY", details: { reason: "SET_CHANGED" } });
    const s = await sessionRow(b.sessionId);
    expect(s).toMatchObject({ payment_scheduled_for: null, minimum_reached_at: null, payment_opened_at: null,
                              payment_opening_blocked_reason: null });
  });

  it("clears the scheduling itself when the live set changed underneath it", async () => {
    const plan = await scheduledSession();
    await admin.query("update sila.allocations set status = 'withdrawn', withdrawn_at = now() where id = $1",
                      [plan.allocationId]);
    const r = await errorOf(release(plan.sessionId, inWindow(), at(6), at(7)));
    expect(r).toMatchObject({ code: "NOT_READY", details: { reason: "SET_CHANGED" } });
    expect(await sessionRow(plan.sessionId)).toMatchObject({ payment_scheduled_for: null, minimum_reached_at: null,
                                                             payment_opened_at: null });
  });

  it("never clears an opening that has already happened", async () => {
    const plan = await scheduledSession();
    await okData(release(plan.sessionId, inWindow(), at(6), at(7)));
    const opened = await sessionRow(plan.sessionId);
    await admin.query("update sila.allocations set status = 'withdrawn', withdrawn_at = now() where id = $1",
                      [plan.allocationId]);
    expect((await okData(release(plan.sessionId, plus(inWindow(), 60_000), at(6), at(7)))).opened).toBe(false);
    const after = await sessionRow(plan.sessionId);
    expect(after.payment_opened_at).toEqual(opened.payment_opened_at);
    expect(after.minimum_reached_at).toEqual(opened.minimum_reached_at);
    expect(after.payment_scheduled_for).toEqual(opened.payment_scheduled_for);
  });

  it("rejects a verify-by at or after the final decision and a pay-by already past", async () => {
    const plan = await scheduledSession();
    const s = await sessionRow(plan.sessionId);
    const decisionBy = s.decision_by.toISOString();
    expect(await code(release(plan.sessionId, inWindow(), at(6), decisionBy))).toBe("INVALID_FIELDS");
    expect(await code(release(plan.sessionId, inWindow(), at(6), plus(decisionBy, 60_000)))).toBe("INVALID_FIELDS");
    expect(await code(release(plan.sessionId, inWindow(), at(-0.001), at(7)))).toBe("INVALID_FIELDS");
    expect((await sessionRow(plan.sessionId)).payment_opened_at).toBeNull();
  });

  it("does not release a paused session", async () => {
    const plan = await scheduledSession();
    await admin.query("update sila.sessions set intake_paused = true, intake_paused_reason = 'Room check' " +
                      "where id = $1", [plan.sessionId]);
    const r = await errorOf(release(plan.sessionId, inWindow(), at(6), at(7)));
    expect(r).toMatchObject({ code: "NOT_READY", details: { reason: "PAUSED" } });
    expect((await sessionRow(plan.sessionId)).payment_opened_at).toBeNull();
  });
});

describe("sila reschedule_payment_opening", () => {
  it("moves a missed opening once, and ignores a stale expected time", async () => {
    const missed = opening(-2);
    const plan = await scheduledSession(missed);
    const before = await sessionRow(plan.sessionId);
    const stale = await okData(sila<Rescheduled>("reschedule_payment_opening", plan.sessionId, opening(-3),
                                                 opening(3), null));
    expect(stale.rescheduled).toBe(false);
    expect(await sessionRow(plan.sessionId)).toEqual(before);

    const r = await okData(sila<Rescheduled>("reschedule_payment_opening", plan.sessionId, missed, opening(3), null));
    expect(r.rescheduled).toBe(true);
    expect(new Date(r.payment_scheduled_for!).toISOString()).toBe(opening(3));
    const repeat = await okData(sila<Rescheduled>("reschedule_payment_opening", plan.sessionId, missed, opening(4),
                                                  null));
    expect(repeat.rescheduled).toBe(false);
    expect((await sessionRow(plan.sessionId)).payment_scheduled_for.toISOString()).toBe(opening(3));
    expect(await outbox("payment.rescheduled", "session_id", plan.sessionId)).toHaveLength(1);
  });

  it("records NO_COVERAGE when no staffed release remains", async () => {
    const missed = opening(-2);
    const plan = await scheduledSession(missed);
    const r = await okData(sila<Rescheduled>("reschedule_payment_opening", plan.sessionId, missed, null,
                                             "NO_COVERAGE"));
    expect(r).toEqual({ payment_scheduled_for: null, blocked_reason: "NO_COVERAGE", rescheduled: true });
    const mine = await okData(sila<{ facts: Record<string, boolean> }>("get_my_plan", plan.organiser.personId,
                                                                         plan.planId));
    expect(mine.facts).toMatchObject({ openingBlocked: true, paymentOpened: false });
  });
});

describe("sila block_payment_opening", () => {
  it("records why payment cannot open, once, and shows the club a delay", async () => {
    const plan = await scheduledSession();
    const r = await okData(block(plan.sessionId, at(0), "VERIFY_AFTER_DECISION"));
    expect(r).toEqual({ blocked_reason: "VERIFY_AFTER_DECISION", blocked: true });
    expect(await sessionRow(plan.sessionId)).toMatchObject({
      payment_scheduled_for: null, payment_opened_at: null, payment_opening_blocked_reason: "VERIFY_AFTER_DECISION",
    });
    expect((await okData(block(plan.sessionId, at(0), "VERIFY_AFTER_DECISION"))).blocked).toBe(false);
    expect(await outbox("payment.delayed", "session_id", plan.sessionId)).toHaveLength(1);
    const mine = await okData(sila<{ facts: Record<string, boolean> }>("get_my_plan", plan.organiser.personId,
                                                                         plan.planId));
    expect(mine.facts).toMatchObject({ minimumReached: true, openingBlocked: true, paymentOpened: false });
  });
});

describe("sila close_unfilled_session", () => {
  it("does nothing before the fill deadline, then closes and releases the places once", async () => {
    const plan = await committedPlan({ places: 7 });
    const fillBy = (await sessionRow(plan.sessionId)).fill_by.toISOString();
    const early = await errorOf(close(plan.sessionId, fillBy));
    expect(early).toMatchObject({ code: "NOT_READY", details: { reason: "BEFORE_FILL_BY" } });
    expect((await sessionRow(plan.sessionId)).phase).toBe("published");

    const after = plus(fillBy, 60_000);
    expect(await okData(close(plan.sessionId, after))).toMatchObject({ session_id: plan.sessionId,
                                                                        released_allocations: 1 });
    const s = await sessionRow(plan.sessionId);
    expect(s).toMatchObject({ phase: "closed", closed_reason: "MINIMUM_NOT_REACHED" });
    expect(s.closed_at.toISOString()).toBe(after);
    expect(await allocationRow(plan.allocationId)).toMatchObject({ status: "released" });
    expect(await code(close(plan.sessionId, plus(after, 60_000)))).toBe("NOT_READY");
    expect(await outbox("session.not_proceeding", "session_id", plan.sessionId)).toHaveLength(1);

    const mine = await okData(sila<{ facts: Record<string, boolean>; allocation: { status: string } }>(
      "get_my_plan", plan.organiser.personId, plan.planId));
    expect(mine.facts).toMatchObject({ closed: true, committed: false });
    expect(mine.allocation.status).toBe("released");
    expect(await code(withdraw(plan))).toBe("NOT_COMMITTED");
  });

  it("is a no-op when the minimum was reached", async () => {
    const plan = await committedPlan({ places: 16 });
    const fillBy = (await sessionRow(plan.sessionId)).fill_by.toISOString();
    const r = await errorOf(close(plan.sessionId, plus(fillBy, 60_000)));
    expect(r).toMatchObject({ code: "NOT_READY", details: { reason: "MINIMUM_REACHED" } });
    expect((await sessionRow(plan.sessionId)).phase).toBe("published");
    expect(await allocationRow(plan.allocationId)).toMatchObject({ status: "live" });
  });
});

describe("sila withdraw_plan", () => {
  it("releases a commitment below the minimum without touching the session schedule", async () => {
    const plan = await committedPlan({ places: 7 });
    const r = await okData(withdraw(plan));
    expect(r).toEqual({ outcome: "released", cancelled_scheduled_opening: false, committed_places: 0 });
    expect(await allocationRow(plan.allocationId)).toMatchObject({
      status: "withdrawn", withdrawal_reason: "Our coach is no longer available.", withdrawal_requested_at: null,
    });
    const mine = await okData(sila<{ facts: Record<string, boolean>; allocation: { status: string } }>(
      "get_my_plan", plan.organiser.personId, plan.planId));
    expect(mine.facts).toMatchObject({ committed: false, closed: false });
    expect(mine.allocation.status).toBe("withdrawn");
    expect(await code(withdraw(plan))).toBe("NOT_COMMITTED");
  });

  it("cancels the scheduled opening and reopens intake when the minimum breaks", async () => {
    const { a, b } = await twoClubs();
    const r = await okData(withdraw(b));
    expect(r).toEqual({ outcome: "released", cancelled_scheduled_opening: true, committed_places: 7 });
    expect(await sessionRow(a.sessionId)).toMatchObject({ minimum_reached_at: null, payment_scheduled_for: null,
                                                          payment_opening_blocked_reason: null });
    const view = await okData(sila<{ intake_open: boolean; committed_places: number }>("get_public_session",
                                                                                       a.sessionId));
    expect(view).toMatchObject({ intake_open: true, committed_places: 7 });
    const other = await okData(sila<{ facts: Record<string, boolean> }>("get_my_plan", a.organiser.personId,
                                                                          a.planId));
    expect(other.facts).toMatchObject({ committed: true, minimumReached: false });

    // A new club can now commit and the minimum is stamped afresh.
    const c = await approvedPlan({ session: { sessionId: a.sessionId, venue: a.venue }, places: 9 });
    const again = await okData(sila<{ reaches_minimum: boolean }>("commit_plan", c.organiser.personId, key(),
                                                                  c.planId, 9, 1));
    expect(again.reaches_minimum).toBe(true);
  });

  it("asks the venue to review a withdrawal after payment opened and keeps the places", async () => {
    const plan = await scheduledSession();
    await okData(release(plan.sessionId, inWindow(), at(6), at(7)));
    const opened = await sessionRow(plan.sessionId);
    const idem = key();
    const version = await planVersion(plan.planId);
    const r = await withdraw(plan, { reason: "Club trip cancelled.", idem, version });
    expect(r).toMatchObject({ ok: true, data: { outcome: "venue_review", cancelled_scheduled_opening: false,
                                                committed_places: 16 } });
    const again = await withdraw(plan, { reason: "Club trip cancelled.", idem, version });
    expect(again).toMatchObject({ ok: true, replayed: true, data: { outcome: "venue_review" } });
    const allocation = await allocationRow(plan.allocationId);
    expect(allocation).toMatchObject({ status: "live", withdrawal_reason: "Club trip cancelled." });
    expect(allocation.withdrawal_requested_at).toBeInstanceOf(Date);
    const s = await sessionRow(plan.sessionId);
    expect(s.payment_opened_at).toEqual(opened.payment_opened_at);
    expect(s.minimum_reached_at).toEqual(opened.minimum_reached_at);
    expect(await outbox("withdrawal.review", "allocation_id", plan.allocationId)).toHaveLength(1);
  });

  it("refuses a withdrawal prepared before payment opened", async () => {
    const plan = await scheduledSession();
    const seen = await planVersion(plan.planId);
    await okData(release(plan.sessionId, inWindow(), at(6), at(7)));
    const r = await errorOf(withdraw(plan, { version: seen }));
    expect(r).toMatchObject({ code: "VERSION_CONFLICT", details: { version: seen + 1 } });
    expect(await allocationRow(plan.allocationId)).toMatchObject({ status: "live", withdrawal_requested_at: null,
                                                                   withdrawal_reason: null });
    expect(await planVersion(plan.planId)).toBe(seen + 1);
    expect(await outbox("withdrawal.review", "allocation_id", plan.allocationId)).toHaveLength(0);

    const before = await committedPlan({ places: 7 });
    expect(await code(withdraw(before, { version: (await planVersion(before.planId)) - 1 })))
      .toBe("VERSION_CONFLICT");
    expect(await allocationRow(before.allocationId)).toMatchObject({ status: "live" });
  });

  it("lets only the organiser withdraw and requires a reason", async () => {
    const plan = await committedPlan({ places: 7 });
    const stranger = await makePerson(`${randomUUID()}@test.example`);
    for (const actor of [plan.venue.coordinator, plan.venue.operator, stranger]) {
      expect(await code(withdraw(plan, { reason: "No", actor: actor.personId }))).toBe("NOT_FOUND");
    }
    expect(await code(sila("withdraw_plan", plan.organiser.personId, key(), randomUUID(), 1, "No")))
      .toBe("NOT_FOUND");
    expect(await code(withdraw(plan, { reason: "  " }))).toBe("INVALID_FIELDS");
    expect(await code(withdraw(plan, { reason: "x".repeat(501) }))).toBe("INVALID_FIELDS");
    expect(await allocationRow(plan.allocationId)).toMatchObject({ status: "live" });
    const approved = await approvedPlan({ places: 7 });
    expect(await code(withdraw(approved))).toBe("NOT_COMMITTED");
  });
});

type WorkList = Record<"to_schedule" | "to_release" | "to_reschedule" | "to_close", { id: string }[]>;

describe("sila list_session_work", () => {
  const work = async (now?: string) =>
    okData(internal<WorkList>("sila.list_session_work(coalesce($1::timestamptz, now()), 100000)", [now ?? null]));
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it("stops offering a session for release once it has closed", async () => {
    const scheduledFor = opening(-2);
    const { sessionId } = await publishedSession({ fill_by: at(-3), payment_scheduled_for: scheduledFor });
    const before = await work(inWindow(scheduledFor));
    expect(ids(before.to_release)).toContain(sessionId);
    expect(ids(before.to_close)).toContain(sessionId);
    await okData(close(sessionId, inWindow(scheduledFor)));
    const after = await work(inWindow(scheduledFor));
    expect(ids(after.to_release)).not.toContain(sessionId);
    expect(ids(after.to_close)).not.toContain(sessionId);
    expect(ids((await work()).to_reschedule)).not.toContain(sessionId);
  });

  it("offers a missed opening for rescheduling, not release, and skips it while paused", async () => {
    const scheduledFor = opening(-2);
    const plan = await scheduledSession(scheduledFor);
    await setPaused(plan.sessionId, true);
    const paused = await work(london(-2, 12, 31));
    expect(ids(paused.to_release)).not.toContain(plan.sessionId);
    expect(ids(paused.to_reschedule)).not.toContain(plan.sessionId);
    await setPaused(plan.sessionId, false);
    expect(ids((await work(london(-2, 12, 30))).to_release)).toContain(plan.sessionId);
    const missed = await work(london(-2, 12, 31));
    expect(ids(missed.to_release)).not.toContain(plan.sessionId);
    expect(ids(missed.to_reschedule)).toContain(plan.sessionId);
  });

  it("returns the fields the worker needs", async () => {
    const plan = await committedPlan({ places: 16 });
    const row = (await work()).to_schedule.find((r) => r.id === plan.sessionId);
    expect(row).toMatchObject({ id: plan.sessionId, minimum_reached_at: expect.any(String),
                                covered_dates: [], decision_by: expect.any(String), payment_window_days: 5,
                                payment_scheduled_for: null });
  });
});

describe("runSilaTick", () => {
  process.env.DATABASE_URL ??= APP_URL;

  // The release and block paths need the real clock inside 11:45-12:30 London;
  // they are covered with explicit times above and by tests/unit/sila-worker.test.ts.
  it("schedules, reschedules missed openings and closes overdue sessions, and is idempotent", async () => {
    const { runSilaTick } = await import("@/lib/sila/commands/worker");
    const covered = Array.from({ length: 40 }, (_, i) => toLocal(new Date(Date.now() + (i - 5) * DAY_MS)).date);
    const toSchedule = await committedPlan({ session: await publishedSession({ covered_dates: covered }),
                                             places: 16 });
    // Paused through its 11:45 window two days ago, then unpaused.
    const missed = await scheduledSession(opening(-2), { covered_dates: covered });
    await setPaused(missed.sessionId, true);
    await setPaused(missed.sessionId, false);
    const toClose = await committedPlan({ places: 7 });
    await admin.query("update sila.sessions set fill_by = now() - interval '1 minute' where id = $1",
                      [toClose.sessionId]);

    const tickAt = new Date();
    const first = await runSilaTick();
    expect(first.scheduled).toBeGreaterThanOrEqual(1);
    expect(first.rescheduled).toBeGreaterThanOrEqual(1);
    expect(first.closed).toBeGreaterThanOrEqual(1);

    const scheduled = await sessionRow(toSchedule.sessionId);
    const expected = scheduledPaymentOpening(scheduled.minimum_reached_at, scottishVenueCalendar(), new Set(covered));
    expect(scheduled.payment_scheduled_for?.getTime()).toBe(expected!.getTime());

    const moved = await sessionRow(missed.sessionId);
    const next = scheduledPaymentOpening(tickAt, scottishVenueCalendar(), new Set(covered))!;
    expect(moved.payment_scheduled_for.getTime()).toBe(next.getTime());
    expect(toLocal(moved.payment_scheduled_for)).toMatchObject({ hour: 11, minute: 45 });
    expect(moved.payment_scheduled_for.getTime()).toBeGreaterThan(tickAt.getTime());
    expect(moved.payment_opened_at).toBeNull();

    expect(await sessionRow(toClose.sessionId)).toMatchObject({ phase: "closed", closed_reason: "MINIMUM_NOT_REACHED" });

    const tracked = [toSchedule, missed, toClose];
    const snapshot = await Promise.all(tracked.map((p) => sessionRow(p.sessionId)));
    await runSilaTick();
    const again = await Promise.all(tracked.map((p) => sessionRow(p.sessionId)));
    expect(again).toEqual(snapshot);
    expect(await outbox("payment.opened", "allocation_id", missed.allocationId)).toHaveLength(0);
    expect(await outbox("payment.rescheduled", "session_id", missed.sessionId)).toHaveLength(1);
    expect(await outbox("session.not_proceeding", "session_id", toClose.sessionId)).toHaveLength(1);
  });
});

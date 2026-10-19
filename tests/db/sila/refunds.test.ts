import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, app, committedPlan, key, makePerson, openedSession, okData, sila } from "./fixtures";

afterAll(async () => { await Promise.all([admin.end(), app.end()]); });
const calendar = "scotland-2026-2027.v1+closures.none";
async function version(id: string): Promise<number> {
  const { rows } = await admin.query("select version from sila.sessions where id=$1", [id]);
  return rows[0].version;
}
async function received(session: Awaited<ReturnType<typeof openedSession>>, amount = 6125) {
  const plan = session.plans[0]!;
  return okData(sila("record_receipt", session.venue.finance.personId, key(), plan.allocationId, "deposit", amount,
    new Date(Date.now() - 60000).toISOString(), randomUUID(), "Synthetic bank receipt"));
}
async function close(session: Awaited<ReturnType<typeof openedSession>>, closureKey = key()) {
  return sila("close_session", session.venue.coordinator.personId, closureKey, session.sessionId,
    await version(session.sessionId), "unconfirmed", "Synthetic session cannot confirm");
}
async function refund(session: Awaited<ReturnType<typeof openedSession>>, amount: number, opts: { idem?: string; ref?: string; expected?: number; actor?: string } = {}) {
  return sila<{ refund: { due_minor: number; status: string }; version: number }>("record_refund",
    opts.actor ?? session.venue.finance.personId, opts.idem ?? key(), session.plans[0]!.allocationId,
    opts.expected ?? await version(session.sessionId), amount, opts.ref ?? randomUUID(),
    new Date().toISOString(), "Synthetic evidence of the venue return");
}

describe("session closure and refunds (§17, §18, §24, §27)", () => {
  it("matches the pure five-business-day calendar across holidays and DST", async () => {
    const { rows } = await admin.query("select sila.refund_target($1,$2,$3) as target", ["2026-11-12T12:00:00Z", calendar, randomUUID()]);
    expect(rows[0].target.toISOString()).toBe("2026-11-19T12:00:00.000Z");
  });

  it("closes once, releases places, preserves money, and exposes only the caller's refund", async () => {
    const session = await openedSession({ places: [7, 9], session: { calendar_version: calendar } });
    await received(session);
    const before = await version(session.sessionId);
    const idem = key();
    const args = [session.venue.coordinator.personId, idem, session.sessionId, before, "unconfirmed", "No final approval"];
    expect((await sila("close_session", ...args)).ok).toBe(true);
    expect(await sila("close_session", ...args)).toMatchObject({ ok: true, replayed: true });
    expect(await sila("close_session", session.venue.coordinator.personId, key(), session.sessionId, before,
      "unconfirmed", "Old form")).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    const { rows } = await admin.query("select phase, (select count(*)::int from sila.allocations where session_id=$1 and status='live') as live from sila.sessions where id=$1", [session.sessionId]);
    expect(rows[0]).toEqual({ phase: "closed", live: 0 });
    const a = await okData(sila<{ refund: { due_minor: number; status: string } }>("get_my_plan", session.plans[0]!.organiser.personId, session.plans[0]!.planId));
    const b = await okData(sila<{ refund: { due_minor: number; status: string } }>("get_my_plan", session.plans[1]!.organiser.personId, session.plans[1]!.planId));
    expect(a.refund).toMatchObject({ due_minor: 6125, status: "refund_due" });
    expect(b.refund).toMatchObject({ due_minor: 0, status: "no_payment_received" });
    expect(await sila("get_my_plan", session.plans[1]!.organiser.personId, session.plans[0]!.planId)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("keeps late payments after closure and includes them in the full refund due", async () => {
    const session = await openedSession({ session: { calendar_version: calendar } });
    await okData(close(session));
    await received(session, 14000);
    const view = await okData(sila<{ refund: { due_minor: number } }>("get_my_plan", session.plans[0]!.organiser.personId, session.plans[0]!.planId));
    expect(view.refund.due_minor).toBe(14000);
  });

  it("tracks unexpected money after an unfilled session closes without payment opening", async () => {
    const p = await committedPlan({ places: 7 });
    await admin.query("update sila.sessions set fill_by=now()-interval '1 second',calendar_version=$2 where id=$1", [p.sessionId,calendar]);
    await okData(sila("close_unfilled_session",p.sessionId));
    await okData(sila("record_receipt",p.venue.finance.personId,key(),p.allocationId,"deposit",6125,
      new Date(Date.now()-1000).toISOString(),key(),"Unexpected synthetic funds after unfilled closure"));
    const view = await okData(sila<{ refund: { due_minor: number } }>("get_my_plan",p.organiser.personId,p.planId));
    expect(view.refund.due_minor).toBe(6125);
    await okData(sila("record_refund",p.venue.finance.personId,key(),p.allocationId,
      await version(p.sessionId),6125,key(),new Date().toISOString(),"Synthetic actual return"));
  });

  it("still stops intake if the calendar needs resolution, retaining the refund task", async () => {
    const session = await openedSession({ session: { calendar_version: "unregistered-calendar" } });
    await received(session);
    expect(await close(session)).toMatchObject({ ok: true, data: { refund_target_at: null } });
    const view = await okData(sila<{ refund: { due_minor: number; target_at: null } }>("get_my_plan", session.plans[0]!.organiser.personId, session.plans[0]!.planId));
    expect(view.refund).toMatchObject({ due_minor: 6125, target_at: null });
  });

  it("returns deposit and balance in full for venue fault while retaining the confirmed snapshot", async () => {
    const session = await openedSession({ session: { calendar_version: calendar } });
    await received(session, 14000);
    const booking = await okData(sila<{ booking_id: string }>("confirm_session", session.venue.coordinator.personId,
      key(), session.sessionId, await version(session.sessionId), true));
    await okData(sila("record_receipt", session.venue.finance.personId, key(), session.plans[0]!.allocationId,
      "balance", 42000, new Date(Date.now() - 1000).toISOString(), randomUUID(), "Synthetic balance"));
    await okData(sila("close_session", session.venue.coordinator.personId, key(), session.sessionId,
      await version(session.sessionId), "venue_fault", "The venue cannot deliver"));
    const view = await okData(sila<{ refund: { due_minor: number } }>("get_my_plan", session.plans[0]!.organiser.personId, session.plans[0]!.planId));
    expect(view.refund.due_minor).toBe(56000);
    const { rows } = await admin.query("select id from sila.bookings where id=$1", [booking.booking_id]);
    expect(rows).toHaveLength(1);
  });

  it("allows only venue finance to verify a return; operator cannot close or refund", async () => {
    const session = await openedSession({ session: { calendar_version: calendar } });
    await received(session); await okData(close(session));
    for (const actor of [session.venue.coordinator.personId, session.venue.operator.personId,
      session.plans[0]!.organiser.personId, (await makePerson(`${randomUUID()}@test.example`)).personId]) {
      expect(await refund(session, 100, { actor })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    }
    expect(await sila("close_session", session.venue.operator.personId, key(), session.sessionId,
      await version(session.sessionId), "unconfirmed", "Operator attempt")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("verifies partial returns, deduplicates references, replays a key and blocks over-refunds", async () => {
    const session = await openedSession({ session: { calendar_version: calendar } });
    await received(session); await okData(close(session));
    const before = await version(session.sessionId); const idem = key(); const returned = new Date().toISOString();
    const args = [session.venue.finance.personId, idem, session.plans[0]!.allocationId, before, 1000, " refund-a ", returned, "Synthetic evidence"];
    expect(await sila("record_refund", ...args)).toMatchObject({ ok: true, data: { refund: { due_minor: 5125, status: "refund_due" } } });
    expect(await sila("record_refund", ...args)).toMatchObject({ ok: true, replayed: true });
    expect(await refund(session, 1000, { ref: "REFUND-A" })).toMatchObject({ ok: false, error: { code: "DUPLICATE_RECEIPT" } });
    expect(await refund(session, 6000)).toMatchObject({ ok: false, error: { code: "NOT_READY" } });
    expect(await refund(session, 5125)).toMatchObject({ ok: true, data: { refund: { due_minor: 0, status: "refunded" } } });
    await expect(admin.query("update sila.refund_entries set amount_minor=1 where allocation_id=$1", [session.plans[0]!.allocationId])).rejects.toThrow();
  });

  it("serialises two finance returns and concurrent receipt/closure without losing money", async () => {
    const session = await openedSession({ session: { calendar_version: calendar } });
    const results = await Promise.all([received(session), okData(close(session))]);
    expect(results).toHaveLength(2);
    const expected = await version(session.sessionId);
    const returns = await Promise.all([refund(session, 6125, { expected }), refund(session, 6125, { expected })]);
    expect(returns.filter((r) => r.ok)).toHaveLength(1);
    expect(returns.filter((r) => !r.ok)).toMatchObject([{ error: { code: "VERSION_CONFLICT" } }]);
  });

  it("closes after the final decision and leaves receipt/confirmation facts intact", async () => {
    const session = await openedSession({ session: { calendar_version: calendar } });
    await received(session);
    await admin.query("update sila.sessions set decision_by=clock_timestamp()-interval '1 second' where id=$1", [session.sessionId]);
    await okData(sila("close_decision_sessions"));
    const { rows } = await admin.query("select phase, confirmed_at from sila.sessions where id=$1", [session.sessionId]);
    expect(rows[0]).toEqual({ phase: "closed", confirmed_at: null });
    expect(await sila("confirm_session", session.venue.coordinator.personId, key(), session.sessionId,
      await version(session.sessionId), true)).toMatchObject({ ok: false, error: { code: "SESSION_NOT_OPEN" } });
    const view = await okData(sila<{ refund: { due_minor: number } }>("get_my_plan", session.plans[0]!.organiser.personId, session.plans[0]!.planId));
    expect(view.refund.due_minor).toBe(6125);
  });
});

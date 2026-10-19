import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { ApiResult } from "@/lib/db/api";
import {
  admin, app, committedPlan, key, londonAt, makeOperator, makePerson, okData, openedSession, publishedSession, sila,
  type OpenedSession,
} from "./fixtures";

afterAll(async () => {
  await Promise.all([admin.end(), app.end(), globalThis.__scbPool?.end()]);
});

const HOUR_MS = 3_600_000;
const plus = (iso: string | Date, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

async function errorOf(p: Promise<ApiResult<unknown>>) {
  const r = await p;
  if (r.ok) throw new Error(`Expected an error envelope, got ${JSON.stringify(r.data)}`);
  return r.error;
}

/** Calls an internal clocked `sila.*` function through the admin pool. */
async function internal<T = Record<string, unknown>>(call: string, args: unknown[]): Promise<ApiResult<T>> {
  const { rows } = await admin.query<{ result: ApiResult<T> }>(`select ${call} as result`, args);
  return rows[0]!.result;
}

interface Report { report_id: string; allocation_id: string; kind: string; amount_minor: number; reference: string }
interface Receipt {
  entry_id: string; allocation_id: string; session_id: string; kind: string; amount_minor: number;
  receipt_id: string; received_at: string; verified_at: string; timely: boolean;
  verified_deposit_minor: number; verified_balance_minor: number;
}
interface Confirmed { booking_id: string; booking_ref: string; session_id: string; version: number }
interface Blocker { code: string; allocation_id?: string }
interface MyPlan {
  facts: Record<string, boolean>;
  payment: Record<string, unknown> & { reports: unknown[] };
  booking: { booking_ref: string } | null;
  allocation: Record<string, unknown> | null;
}
interface VenueAllocation {
  allocation_id: string; plan_id: string; plan_ref: string; club_name: string; places: number; status: string;
  total_minor: number; deposit_minor: number; balance_minor: number;
  verified_deposit_minor: number; verified_balance_minor: number;
  reports: Record<string, unknown>[]; receipts: Record<string, unknown>[];
}
interface VenueView { allocations: VenueAllocation[]; booking: { booking_ref: string } | null; session: { version: number } }

type Plan = OpenedSession["plans"][number];

const report = (actor: string, allocationId: string, options: { kind?: string; amount?: number; reference?: string;
                                                                 idem?: string } = {}) =>
  sila<Report>("report_payment", actor, options.idem ?? key(), allocationId, options.kind ?? "deposit",
               options.amount ?? 14000, options.reference ?? "BACS 12 Nov");

/** Records a receipt through the API wrapper (database clock). */
const receipt = (actor: string, allocationId: string, options: {
  kind?: string; amount?: number; receivedAt?: string; receiptId?: string; evidence?: string | null; idem?: string;
} = {}) =>
  sila<Receipt>("record_receipt", actor, options.idem ?? key(), allocationId, options.kind ?? "deposit",
                options.amount ?? 14000, options.receivedAt ?? ago(HOUR_MS),
                options.receiptId ?? `RC-${randomUUID().slice(0, 8)}`,
                options.evidence === undefined ? "Bank statement line" : options.evidence);

/** Records a receipt through the internal function with an explicit verification clock. */
const receiptAt = (now: string, actor: string, allocationId: string, amount: number, receivedAt: string,
                   receiptId = `RC-${randomUUID().slice(0, 8)}`) =>
  internal<Receipt>(
    "sila.record_receipt($1::uuid, $2::text, $3::uuid, $4::text, $5::int, $6::timestamptz, $7::text, $8::text, " +
    "$9::timestamptz)",
    [actor, key(), allocationId, "deposit", amount, receivedAt, receiptId, null, now]);

const sessionVersion = async (sessionId: string): Promise<number> =>
  (await admin.query("select version from sila.sessions where id = $1", [sessionId])).rows[0].version;

/** Confirms as the venue coordinator at the session's current version unless overridden. */
async function confirm(s: OpenedSession, options: { diary?: boolean; idem?: string; actor?: string; version?: number } = {}) {
  const version = options.version ?? (await sessionVersion(s.sessionId));
  return sila<Confirmed>("confirm_session", options.actor ?? s.venue.coordinator.personId, options.idem ?? key(),
                         s.sessionId, version, options.diary ?? true);
}

/** Records each plan's full deposit as the venue finance member. */
async function verifyDeposits(s: OpenedSession, plans: Plan[] = s.plans) {
  for (const p of plans) {
    const { rows } = await admin.query("select deposit_minor from sila.allocations where id = $1", [p.allocationId]);
    await okData(receipt(s.venue.finance.personId, p.allocationId, { amount: Number(rows[0].deposit_minor) }));
  }
}

const entries = async (allocationId: string) =>
  (await admin.query("select * from sila.financial_entries where allocation_id = $1", [allocationId])).rows;
const bookings = async (sessionId: string) =>
  (await admin.query("select * from sila.bookings where session_id = $1", [sessionId])).rows;
const outbox = async (topic: string, payloadKey: string, id: string) =>
  (await admin.query("select * from sila.outbox where topic = $1 and payload ->> $2 = $3", [topic, payloadKey, id]))
    .rows;

describe("sila report_payment", () => {
  it("refuses a report before payment opens", async () => {
    const plan = await committedPlan({ places: 16 });
    expect(await errorOf(report(plan.organiser.personId, plan.allocationId))).toMatchObject({ code: "PAYMENT_NOT_OPEN" });
  });

  it("records the organiser's report without creating a financial entry", async () => {
    const s = await openedSession();
    const [plan] = s.plans;
    const r = await okData(report(plan!.organiser.personId, plan!.allocationId, { reference: "  BACS 12 Nov  " }));
    expect(r).toMatchObject({ allocation_id: plan!.allocationId, kind: "deposit", amount_minor: 14000,
                              reference: "BACS 12 Nov" });
    expect(await entries(plan!.allocationId)).toHaveLength(0);
    const queued = await outbox("payment.reported", "report_id", r.report_id);
    expect(queued).toHaveLength(1);
    expect(Object.keys(queued[0].payload).sort()).toEqual(["allocation_id", "plan_id", "report_id", "session_id"]);

    const mine = await okData(sila<MyPlan>("get_my_plan", plan!.organiser.personId, plan!.planId));
    expect(mine.facts).toMatchObject({ paymentOpened: true, ownPaymentReported: true, ownDepositVerified: false });
    expect(mine.payment.reports).toEqual([expect.objectContaining({ amount_minor: 14000, reference: "BACS 12 Nov" })]);
    expect(mine.payment.verified_deposit_minor).toBe(0);
  });

  it("accepts reports only from the plan's organiser and validates the fields", async () => {
    const s = await openedSession();
    const [plan] = s.plans;
    const stranger = await makePerson(`${randomUUID()}@test.example`);
    expect(await errorOf(report(stranger.personId, plan!.allocationId))).toMatchObject({ code: "NOT_FOUND" });
    expect(await errorOf(report(s.venue.coordinator.personId, plan!.allocationId))).toMatchObject({ code: "NOT_FOUND" });
    const bad = await errorOf(report(plan!.organiser.personId, plan!.allocationId,
                                     { kind: "tip", amount: 0, reference: " " }));
    expect(bad.code).toBe("INVALID_FIELDS");
    expect(Object.keys(bad.details!.field_errors as object).sort()).toEqual(["amount_minor", "kind", "reference"]);
  });
});

describe("sila record_receipt", () => {
  it("lets venue finance or coordinator record a receipt, never the organiser or an operator", async () => {
    const s = await openedSession();
    const [plan] = s.plans;
    const operator = await makeOperator(`${randomUUID()}@test.example`);
    expect(await errorOf(receipt(plan!.organiser.personId, plan!.allocationId))).toMatchObject({ code: "NOT_FOUND" });
    expect(await errorOf(receipt(operator.personId, plan!.allocationId))).toMatchObject({ code: "NOT_FOUND" });
    expect(await errorOf(receipt(s.venue.operator.personId, plan!.allocationId))).toMatchObject({ code: "NOT_FOUND" });
    expect(await entries(plan!.allocationId)).toHaveLength(0);

    const r = await okData(receipt(s.venue.finance.personId, plan!.allocationId, { amount: 4000 }));
    expect(r).toMatchObject({ allocation_id: plan!.allocationId, session_id: s.sessionId, amount_minor: 4000,
                              verified_deposit_minor: 4000, verified_balance_minor: 0, timely: true });
    await okData(receipt(s.venue.coordinator.personId, plan!.allocationId, { amount: 10000 }));
    const rows = await entries(plan!.allocationId);
    expect(rows).toHaveLength(2);
    expect(rows.map((e) => e.entry_type)).toEqual(["receipt", "receipt"]);
    expect(rows.map((e) => e.currency)).toEqual(["GBP", "GBP"]);
  });

  it("offers no sila_api function other than record_receipt that verifies a payment", async () => {
    const { rows } = await admin.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'sila_api' and (p.proname ~ 'verif|receipt|financial|ledger')`);
    expect(rows.map((r) => r.proname)).toEqual(["record_receipt"]);
  });

  it("refuses a receipt before payment opens", async () => {
    const plan = await committedPlan({ places: 16 });
    expect(await errorOf(receipt(plan.venue.finance.personId, plan.allocationId)))
      .toMatchObject({ code: "PAYMENT_NOT_OPEN" });
  });

  it("validates amount, kind, receipt id, evidence and a received_at that is not in the future", async () => {
    const s = await openedSession();
    const [plan] = s.plans;
    const bad = await errorOf(receipt(s.venue.finance.personId, plan!.allocationId, {
      kind: "tip", amount: 0, receivedAt: plus(new Date(), HOUR_MS), receiptId: "   ", evidence: "x".repeat(1001),
    }));
    expect(bad.code).toBe("INVALID_FIELDS");
    expect(Object.keys(bad.details!.field_errors as object).sort())
      .toEqual(["amount_minor", "evidence", "kind", "receipt_id", "received_at"]);
    const missing = await errorOf(sila("record_receipt", s.venue.finance.personId, key(), plan!.allocationId,
                                       "deposit", 100, null, "RC-1", null));
    expect(Object.keys(missing.details!.field_errors as object)).toEqual(["received_at"]);
    expect(await entries(plan!.allocationId)).toHaveLength(0);
  });

  it("treats a receipt id differing only in case or spaces as a duplicate within the venue", async () => {
    const s = await openedSession({ places: [7, 9] });
    const [a, b] = s.plans;
    const id = `rc-${randomUUID().slice(0, 8)}`;
    await okData(receipt(s.venue.finance.personId, a!.allocationId, { amount: 6125, receiptId: id }));
    const dup = await errorOf(receipt(s.venue.finance.personId, b!.allocationId,
                                      { amount: 7875, receiptId: `  ${id.toUpperCase()} ` }));
    expect(dup.code).toBe("DUPLICATE_RECEIPT");
    expect(await entries(b!.allocationId)).toHaveLength(0);

    // Another venue may use the same identifier.
    const other = await openedSession();
    await okData(receipt(other.venue.finance.personId, other.plans[0]!.allocationId, { receiptId: id }));
  });

  it("replays the same key to the same entry", async () => {
    const s = await openedSession();
    const [plan] = s.plans;
    const idem = key();
    const options = { idem, receivedAt: ago(2 * HOUR_MS), receiptId: `RC-${randomUUID().slice(0, 8)}` };
    const first = await sila<Receipt>("record_receipt", s.venue.finance.personId, idem, plan!.allocationId, "deposit",
                                      14000, options.receivedAt, options.receiptId, "Statement");
    const again = await sila<Receipt>("record_receipt", s.venue.finance.personId, idem, plan!.allocationId, "deposit",
                                      14000, options.receivedAt, options.receiptId, "Statement");
    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.replayed).toBe(true);
    expect(again.data.entry_id).toBe(first.data.entry_id);
    expect(await entries(plan!.allocationId)).toHaveLength(1);
  });

  it("judges timeliness by received_at, even when staff verify a day after pay-by", async () => {
    const payBy = londonAt(2, 12, 0);
    const s = await openedSession({ payBy, verifyBy: londonAt(3, 12, 0) });
    const [plan] = s.plans;
    const receivedAt = londonAt(2, 11, 0);
    const verifiedAt = londonAt(3, 11, 0);
    const r = await okData(receiptAt(verifiedAt, s.venue.finance.personId, plan!.allocationId, 14000, receivedAt));
    expect(r.timely).toBe(true);
    expect(new Date(r.verified_at).toISOString()).toBe(verifiedAt);
    expect(new Date(r.received_at).toISOString()).toBe(receivedAt);
    const [row] = await entries(plan!.allocationId);
    expect(row.verified_at.toISOString()).toBe(verifiedAt);

    const late = await okData(receiptAt(verifiedAt, s.venue.finance.personId, plan!.allocationId, 100,
                                        londonAt(2, 12, 1)));
    expect(late.timely).toBe(false);
  });

  it("keeps financial entries append-only", async () => {
    const s = await openedSession();
    const [plan] = s.plans;
    const r = await okData(receipt(s.venue.finance.personId, plan!.allocationId));
    await expect(admin.query("update sila.financial_entries set amount_minor = 1 where id = $1", [r.entry_id]))
      .rejects.toThrow(/append-only/);
    await expect(admin.query("delete from sila.financial_entries where id = $1", [r.entry_id]))
      .rejects.toThrow(/append-only/);
    const [row] = await entries(plan!.allocationId);
    expect(Number(row.amount_minor)).toBe(14000);

    // A correction is a new entry that references the original.
    await admin.query(
      `insert into sila.financial_entries (venue_id, allocation_id, kind, entry_type, amount_minor, actor_id,
                                           corrects_entry_id)
       values ($1, $2, 'deposit', 'correction', -14000, $3, $4)`,
      [s.venue.venueId, plan!.allocationId, s.venue.finance.personId, r.entry_id]);
    const view = await okData(sila<VenueView>("get_venue_session", s.venue.finance.personId, s.sessionId));
    expect(view.allocations[0]!.verified_deposit_minor).toBe(0);
  });
});

describe("sila confirm_session", () => {
  it("returns DEPOSIT_NOT_VERIFIED for the unverified club and keeps the receipt already saved", async () => {
    const s = await openedSession({ places: [7, 9] });
    const [a, b] = s.plans;
    await verifyDeposits(s, [a!]);
    const blocked = await errorOf(confirm(s));
    expect(blocked.code).toBe("NOT_READY");
    expect(blocked.details!.blockers).toEqual([{ code: "DEPOSIT_NOT_VERIFIED", allocation_id: b!.allocationId }]);
    expect(await entries(a!.allocationId)).toHaveLength(1);
    expect(await bookings(s.sessionId)).toHaveLength(0);

    const mineA = await okData(sila<MyPlan>("get_my_plan", a!.organiser.personId, a!.planId));
    expect(mineA.facts).toMatchObject({ ownDepositVerified: true, allDepositsVerified: false, confirmed: false });
    expect(mineA.payment.verified_deposit_minor).toBe(6125);
  });

  it("names an expired resource hold", async () => {
    const s = await openedSession();
    await verifyDeposits(s);
    await admin.query("update sila.sessions set hold_expires_at = $2 where id = $1", [s.sessionId, ago(60_000)]);
    const blocked = await errorOf(confirm(s));
    expect(blocked.details!.blockers).toEqual([{ code: "RESOURCE_HOLD_EXPIRED" }]);
  });

  it("requires the external diary check", async () => {
    const s = await openedSession();
    await verifyDeposits(s);
    const blocked = await errorOf(confirm(s, { diary: false }));
    expect(blocked).toMatchObject({ code: "NOT_READY", details: { blockers: [{ code: "DIARY_NOT_CHECKED" }] } });
  });

  it("lists blockers in confirmationBlockers order and judges deadlines by the given clock", async () => {
    const session = await publishedSession();
    const plan = await committedPlan({ session, places: 8 });
    const s: OpenedSession = { sessionId: session.sessionId, venue: session.venue, plans: [plan], paymentOpenedAt: "",
                               payBy: "", verifyBy: "" };
    const decisionBy = (await admin.query("select decision_by from sila.sessions where id = $1", [s.sessionId]))
      .rows[0].decision_by as Date;
    const r = await internal(
      "sila.confirm_session($1::uuid, $2::text, $3::uuid, $4::int, $5::boolean, $6::timestamptz)",
      [s.venue.coordinator.personId, key(), s.sessionId, await sessionVersion(s.sessionId), false,
       plus(decisionBy, 60_000)]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.details!.blockers).toEqual([
      { code: "PAYMENT_NOT_OPENED" }, { code: "MINIMUM_NOT_MET" },
      { code: "DEPOSIT_NOT_VERIFIED", allocation_id: plan.allocationId },
      { code: "RESOURCE_HOLD_EXPIRED" }, { code: "DIARY_NOT_CHECKED" }, { code: "DECISION_DEADLINE_PASSED" },
    ]);
  });

  it("refuses a stale session version", async () => {
    const s = await openedSession();
    await verifyDeposits(s);
    const stale = await errorOf(confirm(s, { version: (await sessionVersion(s.sessionId)) - 1 }));
    expect(stale.code).toBe("VERSION_CONFLICT");
  });

  it("does not let a finance member, organiser or operator confirm", async () => {
    const s = await openedSession();
    await verifyDeposits(s);
    for (const actor of [s.venue.finance.personId, s.plans[0]!.organiser.personId, s.venue.operator.personId]) {
      expect(await errorOf(confirm(s, { actor }))).toMatchObject({ code: "NOT_FOUND" });
    }
    expect(await bookings(s.sessionId)).toHaveLength(0);
  });

  it("confirms once every prerequisite holds and never creates a second booking", async () => {
    const s = await openedSession({ places: [7, 9] });
    const [a, b] = s.plans;
    await verifyDeposits(s);
    const before = await sessionVersion(s.sessionId);
    const idem = key();
    const r = await okData(confirm(s, { idem }));
    expect(r.booking_ref).toMatch(/^SL\d{4,}$/);
    expect(r.version).toBe(before + 1);

    const session = (await admin.query("select * from sila.sessions where id = $1", [s.sessionId])).rows[0];
    expect(session.phase).toBe("confirmed");
    expect(session.confirmed_at).not.toBeNull();
    const [booking] = await bookings(s.sessionId);
    expect("SL" + booking.booking_number).toBe(r.booking_ref);
    expect(booking.diary_checked_at).not.toBeNull();
    expect(booking.snapshot).toMatchObject({ session: { minimum: 16, price_minor: 3500 } });
    expect(booking.snapshot.groups).toHaveLength(2);
    const groups = (await admin.query("select * from sila.booking_groups where booking_id = $1 order by places",
                                      [booking.id])).rows;
    expect(groups.map((g) => [g.allocation_id, Number(g.deposit_minor), Number(g.deposit_verified_minor)])).toEqual([
      [a!.allocationId, 6125, 6125], [b!.allocationId, 7875, 7875],
    ]);
    expect(await outbox("booking.confirmed", "booking_id", r.booking_id)).toHaveLength(1);

    const mine = await okData(sila<MyPlan>("get_my_plan", b!.organiser.personId, b!.planId));
    expect(mine.facts).toMatchObject({ confirmed: true, allDepositsVerified: true, ownDepositVerified: true });
    expect(mine.booking).toEqual({ booking_ref: r.booking_ref });

    const again = await errorOf(confirm(s));
    expect(again.code).toBe("SESSION_NOT_OPEN");
    const replay = await confirm(s, { idem, version: before });
    expect(replay.ok && replay.replayed && replay.data.booking_ref).toBe(r.booking_ref);
    expect(await bookings(s.sessionId)).toHaveLength(1);
  });
});

describe("sila payment read models", () => {
  it("shows the payment route only after opening and only the organiser's own payment facts", async () => {
    const route = "Pay Synthetic Venue Ltd, sort code 00-00-00, account 00000000, reference your plan number.";
    const pending = await committedPlan({ places: 16, session: await publishedSession({ payment_route: route }) });
    const before = await okData(sila<MyPlan>("get_my_plan", pending.organiser.personId, pending.planId));
    expect(before.payment.payment_route).toBeNull();
    expect(before.booking).toBeNull();

    const s = await openedSession({ places: [7, 9], session: { payment_route: route } });
    const [a, b] = s.plans;
    await okData(report(b!.organiser.personId, b!.allocationId, { amount: 7875, reference: "B-REF" }));
    await verifyDeposits(s, [b!]);
    const mineA = await okData(sila<MyPlan>("get_my_plan", a!.organiser.personId, a!.planId));
    expect(mineA.payment.payment_route).toBe(route);
    expect(mineA.payment.reports).toEqual([]);
    expect(mineA.payment.verified_deposit_minor).toBe(0);
    expect(mineA.facts).toMatchObject({ ownPaymentReported: false, ownDepositVerified: false,
                                        allDepositsVerified: false });
    expect(JSON.stringify(mineA)).not.toContain("B-REF");
    expect(JSON.stringify(mineA)).not.toContain("7875");
  });

  it("lists allocations with reports, receipts and verified totals for venue members and operators only", async () => {
    const s = await openedSession({ places: [7, 9] });
    const [a, b] = s.plans;
    await okData(report(a!.organiser.personId, a!.allocationId, { amount: 6125, reference: "A-REF" }));
    await verifyDeposits(s, [a!]);
    for (const actor of [s.venue.finance.personId, s.venue.coordinator.personId, s.venue.operator.personId]) {
      const view = await okData(sila<VenueView>("get_venue_session", actor, s.sessionId));
      expect(view.booking).toBeNull();
      const byId = Object.fromEntries(view.allocations.map((x) => [x.allocation_id, x]));
      expect(byId[a!.allocationId]).toMatchObject({
        plan_id: a!.planId, plan_ref: a!.planRef, places: 7, status: "live", total_minor: 24500, deposit_minor: 6125,
        balance_minor: 18375, verified_deposit_minor: 6125, verified_balance_minor: 0,
        reports: [expect.objectContaining({ amount_minor: 6125, reference: "A-REF" })],
        receipts: [expect.objectContaining({ amount_minor: 6125, kind: "deposit", timely: true })],
      });
      expect(byId[b!.allocationId]).toMatchObject({ verified_deposit_minor: 0, reports: [], receipts: [] });
    }
    expect(await errorOf(sila("get_venue_session", a!.organiser.personId, s.sessionId)))
      .toMatchObject({ code: "NOT_FOUND" });
  });
});

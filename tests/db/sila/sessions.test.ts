import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ApiResult } from "@/lib/db/api";
import { admin, app, key, makeVenue, okData, publishedSession, sila, type TestVenue } from "./fixtures";

afterAll(async () => {
  await Promise.all([admin.end(), app.end()]);
});

const DAY_MS = 86_400_000;
/** Whole days from the start of this test run, so equal offsets give equal instants. */
const BASE = Date.now();
const at = (days: number, extraMs = 0) => new Date(BASE + days * DAY_MS + extraMs).toISOString();

/** A draft patch whose values pass the database's publication sanity checks. */
function draft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Printmaking for clubs",
    description: "Two hours in the print room.",
    starts_at: at(30),
    ends_at: at(30, 2 * 3_600_000),
    price_minor: 3500,
    minimum: 16,
    capacity: 20,
    fill_by: at(7),
    decision_by: at(14),
    balance_due_at: at(15),
    resource_name: "Print room",
    hold_expires_at: at(14),
    hold_checked_by: "coordinator",
    covered_dates: ["2026-11-04", "2026-11-05"],
    venue_terms_version: "venue-v1",
    venue_terms_text: "Synthetic venue terms.",
    platform_terms_version: "platform-v1",
    access_facts_reviewed: true,
    run_at_minimum_approved: true,
    payment_route: "Bank transfer to the venue.",
    ...overrides,
  };
}

async function errorOf(p: Promise<ApiResult<unknown>>) {
  const r = await p;
  if (r.ok) throw new Error("Expected an error envelope");
  return r.error;
}

async function code(p: Promise<ApiResult<unknown>>): Promise<string> {
  const r = await p;
  return r.ok ? "OK" : r.error.code;
}

interface Saved { session_id: string; version: number }
interface VenueView { session: Record<string, unknown>; venue: Record<string, unknown>; roles: string[] }

async function saveDraft(v: TestVenue, overrides: Record<string, unknown> = {}): Promise<Saved> {
  return okData(sila<Saved>("save_session_draft", v.coordinator.personId, key(), v.venueId, null, null,
                            draft(overrides)));
}

let venueA: TestVenue;
let venueB: TestVenue;

beforeAll(async () => {
  [venueA, venueB] = await Promise.all([makeVenue(), makeVenue()]);
});

describe("sila session drafts", () => {
  it("a coordinator saves then updates a draft, and a repeated save replays", async () => {
    const idem = key();
    const created = await sila<Saved>("save_session_draft", venueA.coordinator.personId, idem, venueA.venueId,
                                      null, null, draft());
    expect(created.ok && created.data.version).toBe(1);
    const sessionId = created.ok ? created.data.session_id : "";

    const replay = await sila<Saved>("save_session_draft", venueA.coordinator.personId, idem, venueA.venueId,
                                     null, null, draft());
    expect(replay).toMatchObject({ ok: true, replayed: true, data: { session_id: sessionId, version: 1 } });

    const updated = await okData(sila<Saved>("save_session_draft", venueA.coordinator.personId, key(),
                                             venueA.venueId, sessionId, 1, { title: "Linocut evening" }));
    expect(updated).toEqual({ session_id: sessionId, version: 2 });

    const view = await okData(sila<VenueView>("get_venue_session", venueA.coordinator.personId, sessionId));
    expect(view.session).toMatchObject({ title: "Linocut evening", phase: "draft", version: 2, price_minor: 3500,
                                         covered_dates: ["2026-11-04", "2026-11-05"], max_clubs: 2,
                                         deposit_bp: 2500, payment_window_days: 5 });
    expect(view.session.hold_checked_at).toEqual(expect.any(String));
    expect(view.venue).toMatchObject({ id: venueA.venueId, contact_email: "venue@test.example" });
    expect(view.roles).toEqual(["coordinator"]);
  });

  it("a stale expected_version is a VERSION_CONFLICT", async () => {
    const { session_id } = await saveDraft(venueA);
    await okData(sila("save_session_draft", venueA.coordinator.personId, key(), venueA.venueId, session_id, 1,
                      { minimum: 12 }));
    expect(await code(sila("save_session_draft", venueA.coordinator.personId, key(), venueA.venueId, session_id, 1,
                           { minimum: 10 }))).toBe("VERSION_CONFLICT");
  });

  it("returns INVALID_FIELDS for bad values, missing required fields and lifecycle fields", async () => {
    const err = await errorOf(sila("save_session_draft", venueA.coordinator.personId, key(), venueA.venueId, null,
                                   null, draft({ title: "ab", price_minor: -1, capacity: "twenty",
                                                 starts_at: "2026-11-19 18:00", covered_dates: ["2026-02-30"],
                                                 phase: "published", fill_by: null })));
    expect(err.code).toBe("INVALID_FIELDS");
    const fields = (err.details as { field_errors: Record<string, string[]> }).field_errors;
    expect(Object.keys(fields).sort()).toEqual(
      ["capacity", "covered_dates", "fill_by", "phase", "price_minor", "starts_at", "title"]);
  });

  it("only coordinators and operators save drafts", async () => {
    expect(await code(sila("save_session_draft", venueA.finance.personId, key(), venueA.venueId, null, null,
                           draft()))).toBe("NOT_FOUND");
    expect(await code(sila("save_session_draft", venueA.operator.personId, key(), venueA.venueId, null, null,
                           draft()))).toBe("OK");
    expect(await code(sila("save_session_draft", venueB.coordinator.personId, key(), venueA.venueId, null, null,
                           draft()))).toBe("NOT_FOUND");
  });
});

describe("sila session publication", () => {
  it("finance and operators cannot publish", async () => {
    const { session_id } = await saveDraft(venueA);
    expect(await code(sila("publish_session", venueA.finance.personId, key(), session_id, 1, "cal-v1")))
      .toBe("NOT_FOUND");
    expect(await code(sila("publish_session", venueA.operator.personId, key(), session_id, 1, "cal-v1")))
      .toBe("NOT_FOUND");
  });

  it("a hold that ends before the decision is NOT_READY", async () => {
    const { session_id } = await saveDraft(venueA, { hold_expires_at: at(13) });
    const err = await errorOf(sila("publish_session", venueA.coordinator.personId, key(), session_id, 1, "cal-v1"));
    expect(err.code).toBe("NOT_READY");
    expect(err.details).toEqual({ blockers: ["RESOURCE_HOLD_TOO_SHORT"] });
  });

  it("checks the deadline order and terms", async () => {
    const { session_id } = await saveDraft(venueA, {
      fill_by: at(14), decision_by: at(14), platform_terms_version: null, run_at_minimum_approved: false });
    const err = await errorOf(sila("publish_session", venueA.coordinator.personId, key(), session_id, 1, "cal-v1"));
    expect(err.code).toBe("NOT_READY");
    expect((err.details as { blockers: string[] }).blockers.sort())
      .toEqual(["FILL_BY_TOO_LATE", "PLATFORM_TERMS_MISSING", "RUN_AT_MINIMUM_UNAPPROVED"]);
  });

  it("publishes once, then refuses draft edits", async () => {
    const { session_id } = await saveDraft(venueA);
    const idem = key();
    const published = await okData(sila<{ session_id: string; version: number; published_at: string }>(
      "publish_session", venueA.coordinator.personId, idem, session_id, 1, "cal-v1"));
    expect(published).toMatchObject({ session_id, version: 2, published_at: expect.any(String) });
    expect(await sila("publish_session", venueA.coordinator.personId, idem, session_id, 1, "cal-v1"))
      .toMatchObject({ ok: true, replayed: true, data: published });

    const view = await okData(sila<VenueView>("get_venue_session", venueA.coordinator.personId, session_id));
    expect(view.session).toMatchObject({ phase: "published", calendar_version: "cal-v1", version: 2 });
    expect(view.session.published_at).toEqual(expect.any(String));

    expect(await code(sila("save_session_draft", venueA.coordinator.personId, key(), venueA.venueId, session_id, 2,
                           { title: "Changed after publication" }))).toBe("NOT_DRAFT");
    expect(await code(sila("publish_session", venueA.coordinator.personId, key(), session_id, 2, "cal-v1")))
      .toBe("NOT_DRAFT");

    const { rows } = await admin.query(
      "select command from sila.audit_events where entity_id = $1 order by id", [session_id]);
    expect(rows.map((r) => r.command)).toEqual(["save_session_draft", "publish_session"]);
  });
});

describe("sila public session view", () => {
  it("hides drafts and shows only public fields", async () => {
    const { session_id: draftId } = await saveDraft(venueA);
    expect(await code(sila("get_public_session", draftId))).toBe("NOT_FOUND");
    expect(await code(sila("get_public_session", randomUUID()))).toBe("NOT_FOUND");

    const { sessionId } = await publishedSession({ venue: venueA });
    const view = await okData(sila<Record<string, unknown>>("get_public_session", sessionId));
    expect(view).toMatchObject({
      id: sessionId, title: "Printmaking for clubs", phase: "published", price_minor: 3500, minimum: 16,
      capacity: 20, max_clubs: 2, deposit_bp: 2500, intake_open: true, committed_places: 0,
      venue: { name: expect.any(String), address: "1 Test Street, Glasgow",
               access_facts: "Step-free entrance on the side street.", contact_email: "venue@test.example",
               contact_phone: "0141 000 0000" },
    });
    for (const hidden of ["venue_terms_text", "covered_dates", "payment_route", "created_by", "hold_checked_by",
                          "venue_id", "version", "intake_paused_reason"]) {
      expect(view, hidden).not.toHaveProperty(hidden);
    }
    expect(Object.keys(view.venue as object).sort())
      .toEqual(["access_facts", "address", "contact_email", "contact_phone", "name"]);
  });
});

describe("sila session isolation", () => {
  it("another venue's coordinator gets a neutral NOT_FOUND", async () => {
    const { sessionId } = await publishedSession({ venue: venueA });
    const read = await errorOf(sila("get_venue_session", venueB.coordinator.personId, sessionId));
    expect(read).toMatchObject({ code: "NOT_FOUND", details: {} });
    expect(await code(sila("list_venue_sessions", venueB.coordinator.personId, venueA.venueId))).toBe("NOT_FOUND");
    expect(await code(sila("set_session_intake", venueB.coordinator.personId, key(), sessionId, true, "Closed", 1)))
      .toBe("NOT_FOUND");
    expect(await code(sila("publish_session", venueB.coordinator.personId, key(), sessionId, 1, "cal-v1")))
      .toBe("NOT_FOUND");
  });

  it("members and operators list their venue's sessions", async () => {
    const v = await makeVenue();
    const { session_id } = await saveDraft(v);
    const { sessionId } = await publishedSession({ venue: v });
    for (const actor of [v.coordinator, v.finance, v.operator]) {
      const { sessions } = await okData(sila<{ sessions: { id: string }[] }>("list_venue_sessions", actor.personId,
                                                                               v.venueId));
      expect(sessions.map((s) => s.id).sort()).toEqual([session_id, sessionId].sort());
    }
  });

  it("the app login cannot read session tables directly", async () => {
    await expect(app.query("select * from sila.sessions limit 1")).rejects.toThrow(/permission denied/);
  });
});

describe("sila session intake", () => {
  it("pausing needs a reason and closes intake in the public view", async () => {
    const { sessionId, venue } = await publishedSession({ venue: venueA });
    const missing = await errorOf(sila("set_session_intake", venue.coordinator.personId, key(), sessionId, true,
                                       "   ", 1));
    expect(missing.code).toBe("INVALID_FIELDS");
    expect(missing.details).toEqual({ field_errors: { reason: [expect.any(String)] } });
    expect(await code(sila("set_session_intake", venue.finance.personId, key(), sessionId, true, "Closed", 1)))
      .toBe("NOT_FOUND");

    const paused = await okData(sila<{ intake_paused: boolean; version: number }>(
      "set_session_intake", venue.operator.personId, key(), sessionId, true, "Instructor unwell", 1));
    expect(paused).toMatchObject({ intake_paused: true, version: 2 });
    expect(await okData(sila<{ intake_open: boolean }>("get_public_session", sessionId)))
      .toMatchObject({ intake_open: false });

    await okData(sila("set_session_intake", venue.coordinator.personId, key(), sessionId, false, null, 2));
    expect(await okData(sila<{ intake_open: boolean }>("get_public_session", sessionId)))
      .toMatchObject({ intake_open: true });
    const { rows } = await admin.query(
      "select command, reason from sila.audit_events where entity_id = $1 order by id", [sessionId]);
    expect(rows).toEqual([
      { command: "set_session_intake", reason: "Instructor unwell" },
      { command: "set_session_intake", reason: null },
    ]);
  });

  it("cannot pause a draft", async () => {
    const { session_id } = await saveDraft(venueA);
    expect(await code(sila("set_session_intake", venueA.coordinator.personId, key(), session_id, true, "Closed", 1)))
      .toBe("SESSION_NOT_OPEN");
  });

  it("rejects stale intake changes and replays the same key after the version advances (§24)", async () => {
    const { sessionId, venue } = await publishedSession();
    const idem = key();
    const pause = () => sila("set_session_intake", venue.operator.personId, idem,
      sessionId, true, "Checking the room", 1);
    await okData(pause());
    expect(await pause()).toMatchObject({ ok: true, replayed: true, data: { version: 2 } });
    expect(await errorOf(sila("set_session_intake", venue.operator.personId, key(),
      sessionId, false, null, 1))).toMatchObject({ code: "VERSION_CONFLICT", details: { current_version: 2 } });
    expect(await errorOf(sila("set_session_intake", venue.operator.personId, idem,
      sessionId, true, "Checking the room", 2))).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(await errorOf(sila("set_session_intake", venue.operator.personId, key(),
      sessionId, false, null, null))).toMatchObject({ code: "VERSION_CONFLICT" });
    expect(await okData(sila("get_venue_session", venue.coordinator.personId, sessionId)))
      .toMatchObject({ session: { version: 2, intake_paused: true } });
  });

  it("serialises two changes from the same version and applies only one (§24)", async () => {
    const { sessionId, venue } = await publishedSession();
    const results = await Promise.all([
      sila("set_session_intake", venue.operator.personId, key(), sessionId, true, "Checking room", 1),
      sila("set_session_intake", venue.coordinator.personId, key(), sessionId, true, "Checking staffing", 1),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.error.code)).toEqual(["VERSION_CONFLICT"]);
    const { rows } = await admin.query(
      "select version from sila.audit_events where entity_id = $1 and command = 'set_session_intake'", [sessionId]);
    expect(rows).toEqual([{ version: 2 }]);
  });

  it("concurrent retries with the same key mutate once (§24)", async () => {
    const { sessionId, venue } = await publishedSession();
    const idem = key();
    const pause = () => sila("set_session_intake", venue.operator.personId, idem,
      sessionId, true, "Checking the room", 1);
    const results = await Promise.all([pause(), pause()]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && r.replayed)).toHaveLength(1);
    const { rows } = await admin.query(
      "select count(*)::int as n from sila.audit_events where entity_id = $1 and command = 'set_session_intake'",
      [sessionId]);
    expect(rows).toEqual([{ n: 1 }]);
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, app, key, makeOperator, makePerson, makeVenue, okData, sila, submittedPlan } from "./fixtures";

afterAll(async () => {
  await Promise.all([admin.end(), app.end()]);
});

async function errorCode(p: ReturnType<typeof sila>) {
  const result = await p;
  return result.ok ? "OK" : result.error.code;
}

interface Context {
  is_operator: boolean;
  venues: { id: string; roles: string[] }[];
}

describe("scoped operations access (§19, §22)", () => {
  it("venue creation grants only the creator scope and does not list every venue", async () => {
    const [a, b] = await Promise.all([makeVenue(), makeVenue()]);
    const unscoped = await makeOperator(`${randomUUID()}@test.example`);
    expect(await okData(sila<Context>("get_my_context", a.operator.personId)))
      .toMatchObject({ is_operator: true, venues: [{ id: a.venueId, roles: ["operator"] }] });
    expect(await okData(sila<Context>("get_my_context", unscoped.personId)))
      .toMatchObject({ is_operator: true, venues: [] });
    for (const operator of [a.operator, unscoped]) {
      expect(await errorCode(sila("list_venue_sessions", operator.personId, b.venueId))).toBe("NOT_FOUND");
      expect(await errorCode(sila("save_session_draft", operator.personId, key(), b.venueId, null, null, {})))
        .toBe("NOT_FOUND");
      expect(await errorCode(sila("add_venue_member", operator.personId, key(), b.venueId,
        `${randomUUID()}@test.example`, "coordinator"))).toBe("NOT_FOUND");
    }
    const { rows } = await admin.query(
      "select command, actor, reason from sila.audit_events where venue_id = $1 and command = 'grant_operator_scope'",
      [a.venueId]);
    expect(rows).toEqual([{ command: "grant_operator_scope", actor: a.operator.personId,
      reason: "Venue created by this operator" }]);
  });

  it("scoped operator private reads and messages are audited; another venue is neutral 404", async () => {
    const plan = await submittedPlan();
    const { operator } = plan.venue;
    const other = await makeVenue();
    const session = await okData(sila<{ roles: string[] }>("get_venue_session", operator.personId, plan.sessionId));
    expect(session.roles).toEqual(["operator"]);
    await okData(sila("list_venue_sessions", operator.personId, plan.venue.venueId));
    await okData(sila("list_session_requests", operator.personId, plan.sessionId));
    await okData(sila("post_plan_message", operator.personId, key(), plan.planId, "Checking with the venue."));
    expect(await errorCode(sila("get_venue_session", other.operator.personId, plan.sessionId))).toBe("NOT_FOUND");
    expect(await errorCode(sila("list_session_requests", other.operator.personId, plan.sessionId))).toBe("NOT_FOUND");
    expect(await errorCode(sila("post_plan_message", other.operator.personId, key(), plan.planId, "Unrelated.")))
      .toBe("NOT_FOUND");
    expect(await errorCode(sila("set_session_intake", other.operator.personId, key(), plan.sessionId,
      true, "Unrelated.", 1))).toBe("NOT_FOUND");
    const { rows } = await admin.query(
      "select command, reason from sila.audit_events where venue_id = $1 and actor = $2 order by id",
      [plan.venue.venueId, operator.personId]);
    expect(rows).toEqual(expect.arrayContaining([
      { command: "get_venue_session", reason: "Scoped operator access" },
      { command: "list_venue_sessions", reason: "Scoped operator access" },
      { command: "list_session_requests", reason: "Scoped operator access" },
      { command: "post_plan_message", reason: null },
    ]));
  });

  it("revoking a venue scope blocks the next protected read, command and old-key replay", async () => {
    const plan = await submittedPlan();
    const { operator, venueId } = plan.venue;
    const idem = key();
    const pause = () => sila("set_session_intake", operator.personId, idem, plan.sessionId, true, "Room check", 1);
    await okData(pause());
    await admin.query(
      "update sila.operator_venue_scopes set revoked_at = now(), revoked_by = $2, revoked_reason = $3 " +
      "where venue_id = $1 and email = $4 and revoked_at is null",
      [venueId, plan.venue.coordinator.personId, "Support assignment ended", operator.email]);
    expect((await okData(sila<Context>("get_my_context", operator.personId))).venues).toEqual([]);
    expect(await errorCode(sila("get_venue_session", operator.personId, plan.sessionId))).toBe("NOT_FOUND");
    expect(await errorCode(sila("list_venue_sessions", operator.personId, venueId))).toBe("NOT_FOUND");
    expect(await errorCode(sila("list_session_requests", operator.personId, plan.sessionId))).toBe("NOT_FOUND");
    expect(await errorCode(sila("post_plan_message", operator.personId, key(), plan.planId, "Cannot send.")))
      .toBe("NOT_FOUND");
    expect(await errorCode(pause())).toBe("NOT_FOUND");
    expect(await errorCode(sila("set_session_intake", operator.personId, key(), plan.sessionId, false, null, 2)))
      .toBe("NOT_FOUND");
    expect(await errorCode(sila("add_venue_member", operator.personId, key(), venueId,
      `${randomUUID()}@test.example`, "finance"))).toBe("NOT_FOUND");
    const { rows } = await admin.query(
      "select actor, reason, version from sila.audit_events where venue_id = $1 and command = 'revoke_operator_scope'",
      [venueId]);
    expect(rows).toEqual([{ actor: plan.venue.coordinator.personId, reason: "Support assignment ended", version: 2 }]);
    // The venue's own permissions remain live after the support assignment ends.
    await okData(sila("get_venue_session", plan.venue.coordinator.personId, plan.sessionId));
  });

  it("revoking the global operator role blocks live scopes on the next call", async () => {
    const plan = await submittedPlan();
    await admin.query("update sila.operators set revoked_at = now() where email = $1", [plan.venue.operator.email]);
    expect(await okData(sila<Context>("get_my_context", plan.venue.operator.personId)))
      .toMatchObject({ is_operator: false, venues: [] });
    expect(await errorCode(sila("get_venue_session", plan.venue.operator.personId, plan.sessionId))).toBe("NOT_FOUND");
    expect(await errorCode(sila("set_session_intake", plan.venue.operator.personId, key(), plan.sessionId,
      true, "Room check", 1))).toBe("NOT_FOUND");
  });

  it("requires both a live global role and a venue scope, and denies app table access", async () => {
    const venue = await makeVenue();
    const person = await makePerson(`${randomUUID()}@test.example`);
    await expect(admin.query(
      "insert into sila.operator_venue_scopes (email, venue_id, granted_reason) values ($1, $2, $3)",
      [person.email, venue.venueId, "Invalid unregistered operator"]))
      .rejects.toThrow(/foreign key/);
    await expect(app.query("select * from sila.operator_venue_scopes")).rejects.toThrow(/permission denied/);
    await expect(app.query("select sila.is_venue_operator($1, $2)", [venue.operator.personId, venue.venueId]))
      .rejects.toThrow(/permission denied/);
    const { rows } = await admin.query(
      "select to_regprocedure('sila_api.set_session_intake(uuid,text,uuid,boolean,text)') as legacy");
    expect(rows[0].legacy).toBeNull();
  });
});

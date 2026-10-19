import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, app, key, makeOperator, makePerson, okData, sila } from "./fixtures";

afterAll(async () => {
  await Promise.all([admin.end(), app.end()]);
});

interface Context {
  person_id: string;
  email: string;
  is_operator: boolean;
  venues: { id: string; name: string; roles: string[] }[];
}

async function errorCode(p: ReturnType<typeof sila>): Promise<string> {
  const r = await p;
  return r.ok ? "OK" : r.error.code;
}

async function createVenue(operatorId: string, name = `Venue ${randomUUID().slice(0, 8)}`, idem = key()) {
  return sila<{ venue_id: string }>("create_venue", operatorId, idem, name, "1 Test Street, London",
                                    "Step-free entrance on the side street.", "venue@test.example", "020 0000 0000");
}

describe("sila identity", () => {
  it("ensure_person is idempotent per auth user", async () => {
    const email = `Mixed-${randomUUID()}@Test.Example`;
    const person = await makePerson(email);
    expect(person.email).toBe(email.toLowerCase());
    const again = await okData(sila<{ person_id: string; email: string }>("ensure_person", person.authUserId));
    expect(again.person_id).toBe(person.personId);
    expect(again.email).toBe(email.toLowerCase());
    const { rows } = await admin.query("select count(*)::int as n from sila.people where auth_user_id = $1",
                                       [person.authUserId]);
    expect(rows[0].n).toBe(1);
  });

  it("ensure_person rejects an unconfirmed email", async () => {
    const authUserId = randomUUID();
    await admin.query(
      `insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                               raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, null,
               '{}', '{}', now(), now())`,
      [authUserId, `${randomUUID()}@test.example`]);
    expect(await errorCode(sila("ensure_person", authUserId))).toBe("AUTH_REQUIRED");
    expect(await errorCode(sila("ensure_person", randomUUID()))).toBe("AUTH_REQUIRED");
  });

  it("invited email gets the coordinator role case-insensitively", async () => {
    const operator = await makeOperator(`${randomUUID()}@test.example`);
    const { venue_id } = await okData(createVenue(operator.personId));
    const local = `Coordinator-${randomUUID()}`;
    await okData(sila("add_venue_member", operator.personId, key(), venue_id, `  ${local}@Venue.Example `,
                      "coordinator"));
    const coordinator = await makePerson(`${local.toLowerCase()}@venue.example`);
    const ctx = await okData(sila<Context>("get_my_context", coordinator.personId));
    expect(ctx.is_operator).toBe(false);
    expect(ctx.venues).toEqual([{ id: venue_id, name: expect.any(String), roles: ["coordinator"] }]);
  });

  it("revoked member loses the role on the next call", async () => {
    const operator = await makeOperator(`${randomUUID()}@test.example`);
    const { venue_id } = await okData(createVenue(operator.personId));
    const member = await makePerson(`${randomUUID()}@test.example`);
    await okData(sila("add_venue_member", operator.personId, key(), venue_id, member.email, "finance"));
    expect((await okData(sila<Context>("get_my_context", member.personId))).venues).toHaveLength(1);

    const revoked = await okData(sila<{ revoked: boolean }>("revoke_venue_member", operator.personId, key(),
                                                            venue_id, member.email.toUpperCase(), "finance"));
    expect(revoked).toEqual({ revoked: true });
    expect((await okData(sila<Context>("get_my_context", member.personId))).venues).toEqual([]);
  });

  it("only operators create venues", async () => {
    const stranger = await makePerson(`${randomUUID()}@test.example`);
    expect(await errorCode(createVenue(stranger.personId))).toBe("NOT_FOUND");
    const operator = await makeOperator(`${randomUUID()}@test.example`);
    expect((await okData(sila<Context>("get_my_context", operator.personId))).is_operator).toBe(true);
    await okData(createVenue(operator.personId));
  });

  it("a coordinator of venue A cannot add members to venue B", async () => {
    const operator = await makeOperator(`${randomUUID()}@test.example`);
    const a = await okData(createVenue(operator.personId));
    const b = await okData(createVenue(operator.personId));
    const coordinator = await makePerson(`${randomUUID()}@test.example`);
    await okData(sila("add_venue_member", operator.personId, key(), a.venue_id, coordinator.email, "coordinator"));

    // Within their own venue the coordinator may invite; elsewhere it is neutral NOT_FOUND.
    await okData(sila("add_venue_member", coordinator.personId, key(), a.venue_id,
                      `${randomUUID()}@test.example`, "finance"));
    expect(await errorCode(sila("add_venue_member", coordinator.personId, key(), b.venue_id,
                                `${randomUUID()}@test.example`, "coordinator"))).toBe("NOT_FOUND");
    expect(await errorCode(sila("revoke_venue_member", coordinator.personId, key(), b.venue_id,
                                operator.email, "coordinator"))).toBe("NOT_FOUND");
    expect(await errorCode(sila("add_venue_member", coordinator.personId, key(), randomUUID(),
                                `${randomUUID()}@test.example`, "coordinator"))).toBe("NOT_FOUND");
  });

  it("create_venue replays and conflicts", async () => {
    const operator = await makeOperator(`${randomUUID()}@test.example`);
    const idem = key();
    const first = await createVenue(operator.personId, "Replay Hall", idem);
    expect(first.ok && first.replayed).toBeFalsy();
    const second = await createVenue(operator.personId, "Replay Hall", idem);
    expect(second.ok).toBe(true);
    expect(second.ok && second.replayed).toBe(true);
    expect(second.ok && first.ok && second.data.venue_id).toBe(first.ok && first.data.venue_id);
    expect(await errorCode(createVenue(operator.personId, "Different Hall", idem))).toBe("IDEMPOTENCY_CONFLICT");
    const { rows } = await admin.query("select count(*)::int as n from sila.venues where created_by = $1",
                                       [operator.personId]);
    expect(rows[0].n).toBe(1);
  });

  it("rejects invalid venue fields", async () => {
    const operator = await makeOperator(`${randomUUID()}@test.example`);
    const r = await createVenue(operator.personId, "X");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_FIELDS");
    expect(!r.ok && r.error.details).toMatchObject({ field_errors: { name: [expect.any(String)] } });
  });

  it("app login has no table access", async () => {
    await expect(app.query("select * from sila.venues")).rejects.toThrow(/permission denied/);
    await expect(app.query("select sila.is_operator($1)", [randomUUID()])).rejects.toThrow(/permission denied/);
  });
});

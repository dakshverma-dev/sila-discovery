import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callApi, type ApiResult } from "@/lib/db/api";
import { admin, api, APP_URL, app, code, inDays, key, ok, type Demo } from "./helpers";

/*
 * T11 at the documented scale: 50 concurrent reservation attempts against a
 * slot with fewer remaining seats, plus duplicate participants and an
 * idempotent replay. Uses its own pool so attempts really run in parallel.
 */

const wide = [{ start_at: inDays(1), end_at: inDays(60) }];
const racers = new Pool({ connectionString: APP_URL, max: 50 });
let demo: Demo;

function definition() {
  const people = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ key: `${prefix}_${i}`, display_name: `${prefix} ${i}` }));
  const slotStart = new Date(Date.now() + 30 * 86_400_000);
  return {
    name: "Concurrency sandbox",
    expires_in_hours: 1,
    users: [{ key: "manager", display_name: "Manager" }, { key: "org_a", display_name: "Org A" },
            { key: "org_b", display_name: "Org B" }, ...people("a", 35), ...people("b", 35)],
    venue: { name: "Test venue (fictional)", manager: "manager" },
    experiences: [{
      key: "exp", title: "Free talk (fictional)", description: "Test", access_support: [],
      anchors: [{ entity_id: "SYN_1", mapping_reason: "Test", label: "Synthetic" }],
      quote: { fixed_pence: 0, variable_pence: 0, platform_fee_pence: 0, ticket_pence: 0,
               minimum_venue_charge_pence: 0, venue_min_seats: 2 },
      slots: [{ key: "slot", start_at: slotStart.toISOString(),
                end_at: new Date(slotStart.getTime() + 3_600_000).toISOString(), capacity: 30 }],
    }],
    communities: ["a", "b"].map((g) => ({
      key: g, name: `Group ${g}`, public_summary: "", organiser: `org_${g}`,
      participants: Array.from({ length: 35 }, (_, i) => `${g}_${i}`),
      brief: { budget_pence: 0, expected_seats: 35, availability: wide, sharing_choice: "WILLING_TO_SHARE",
               external_query_consent: false, access_requirements: [] },
    })),
  };
}

let proposalId: string;
let versionId: string;

beforeAll(async () => {
  demo = await ok<Demo>(api("create_demo_workspace", definition()));
  const { rows } = await admin.query("select id from scb.quotes where experience_id = $1", [demo.experiences.exp]);
  const draft = await ok<{ proposal_id: string; proposal_version_id: string }>(api("save_draft",
    demo.users.org_a, demo.workspace_id, demo.slots.slot, rows[0].id, [demo.groups.a, demo.groups.b], 2,
    "synthetic", {}, null, randomUUID()));
  proposalId = draft.proposal_id;
  const pub = await ok<{ proposal_version_id: string }>(api("publish_proposal", demo.users.manager, proposalId,
    inDays(20), randomUUID(), key()));
  versionId = pub.proposal_version_id;
  for (const g of ["a", "b"]) {
    await ok(api("respond_to_proposal", demo.users[`org_${g}`], proposalId, versionId, 1, demo.groups[g],
                 "ACCEPT", null, null, randomUUID(), key()));
  }
});

afterAll(async () => {
  await admin.query("update scb.workspaces set expires_at = now() - interval '1 second' where id = $1",
                    [demo.workspace_id]);
  await admin.query("select scb_api.purge_expired_demos()");
  await Promise.all([racers.end(), admin.end(), app.end()]);
});

describe("50 concurrent reservations for 30 seats (T11)", () => {
  it("never exceeds capacity, never double-books a person and replays one key once", async () => {
    // 45 distinct people, plus the same person three more times (two new keys and one replay).
    const attempts: Array<{ user: string; group: string; idem: string }> = [];
    for (let i = 0; i < 23; i++) attempts.push({ user: demo.users[`a_${i}`]!, group: demo.groups.a!, idem: key() });
    for (let i = 0; i < 22; i++) attempts.push({ user: demo.users[`b_${i}`]!, group: demo.groups.b!, idem: key() });
    const repeatKey = key();
    const dup = demo.users.a_30!;
    attempts.push({ user: dup, group: demo.groups.a!, idem: repeatKey });
    attempts.push({ user: dup, group: demo.groups.a!, idem: repeatKey });
    attempts.push({ user: dup, group: demo.groups.a!, idem: key() });
    attempts.push({ user: dup, group: demo.groups.a!, idem: key() });
    for (let i = 31; i < 33; i++) attempts.push({ user: demo.users[`a_${i}`]!, group: demo.groups.a!, idem: key() });
    expect(attempts).toHaveLength(51);

    const results = await Promise.all(attempts.map((a) =>
      callApi<{ reservation_id: string }>("reserve_seat",
        [a.user, proposalId, versionId, 1, a.group, true, true, randomUUID(), a.idem], racers)));
    const codes = results.map((r: ApiResult<unknown>) => (r.ok ? "OK" : r.error.code));
    const allowed = new Set(["OK", "CAPACITY_EXCEEDED", "ALREADY_RESERVED"]);
    expect(codes.every((c) => allowed.has(c))).toBe(true);

    const { rows } = await admin.query(
      `select count(*)::int as active, count(distinct participant_id)::int as people
       from scb.reservations where proposal_version_id = $1 and status = 'RESERVED'`, [versionId]);
    expect(rows[0]).toEqual({ active: 30, people: 30 });
    const { rows: dupRows } = await admin.query(
      "select count(*)::int as n from scb.reservations where participant_id = $1 and status = 'RESERVED'", [dup]);
    expect(dupRows[0].n).toBeLessThanOrEqual(1);

    // The two requests sharing one key resolve to the same outcome.
    const [x, y] = [results[45]!, results[46]!];
    expect(x.ok === y.ok).toBe(true);
    if (x.ok && y.ok) expect(x.data.reservation_id).toBe(y.data.reservation_id);
  });
});

describe("confirmation guards (T12)", () => {
  it("refuses to confirm on a stale quote even when seats and acceptances are in place", async () => {
    expect(await code(api("create_quote", demo.users.manager, demo.experiences.exp, 0, 0, 0, 100, 0, 2, randomUUID())))
      .toBe("OK");
    const r = await api("confirm_booking", demo.users.manager, proposalId, 1, randomUUID(), key());
    expect(r.ok ? "OK" : r.error.code).toBe("NOT_READY");
    expect(!r.ok && (r.error.details as { blockers: string[] }).blockers).toContain("QUOTE_NOT_CURRENT");
  });
});

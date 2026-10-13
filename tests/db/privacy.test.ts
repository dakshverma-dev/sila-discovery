import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptAll, admin, api, app, code, createDemo, ok, people, proposalState, publish, reserve, saveCuratorDraft,
  type Demo,
} from "./helpers";

let demo: Demo;

beforeAll(async () => {
  demo = await createDemo();
});

afterAll(async () => {
  await admin.query("update scb.workspaces set expires_at = now() - interval '1 second' where id = $1",
                    [demo.workspace_id]);
  await admin.query("select scb_api.purge_expired_demos()");
  await Promise.all([admin.end(), app.end()]);
});

describe("consents (R16)", () => {
  it("records accept and revoke as separate, audited events", async () => {
    const person = people(demo, "book_club")[1]!;
    expect(await code(api("record_consent", person, demo.workspace_id, "EXTERNAL_TASTE_QUERY", "2026-10", true,
                          randomUUID()))).toBe("OK");
    expect(await code(api("record_consent", person, demo.workspace_id, "EXTERNAL_TASTE_QUERY", "2026-10", false,
                          randomUUID()))).toBe("OK");
    const { rows } = await admin.query(
      "select accepted_at is not null as a, revoked_at is not null as r from scb.consents where user_id = $1 order by created_at",
      [person]);
    expect(rows).toEqual([{ a: true, r: false }, { a: false, r: true }]);
    expect(await code(api("record_consent", person, demo.workspace_id, "MARKETING", "2026-10", true, randomUUID())))
      .toBe("VALIDATION_FAILED");
  });

  it("does not let a stranger record consent in another workspace", async () => {
    const other = await createDemo();
    expect(await code(api("record_consent", other.users.venue_manager, demo.workspace_id, "SHARED_SESSION", "v1",
                          true, randomUUID()))).toBe("NOT_FOUND");
  });
});

describe("export (R16)", () => {
  it("contains only the requester's own records", async () => {
    const data = await ok<{ user: { id: string }; group_memberships: unknown[]; briefs_authored: unknown[] }>(
      api("export_my_data", demo.users.org_book));
    expect(data.user.id).toBe(demo.users.org_book);
    expect(data.briefs_authored.length).toBeGreaterThan(0);
    const text = JSON.stringify(data);
    // Another group's brief details never appear.
    expect(text).not.toContain(demo.groups.film_society);
  });
});

describe("account deletion (R16, D20)", () => {
  it("withdraws pre-confirmation seats, recomputes readiness and revokes access", async () => {
    const draft = await saveCuratorDraft(demo);
    const pub = await publish(demo, draft.proposal_id);
    await acceptAll(demo, draft.proposal_id, pub.proposal_version_id);
    const seats: string[] = [];
    for (const g of ["book_club", "film_society", "makers_group"]) {
      for (const p of people(demo, g)) {
        if (seats.length === 24) break; // exactly the threshold, so one withdrawal drops below it
        const r = await reserve(demo, p, draft.proposal_id, pub.proposal_version_id, g);
        if (r.ok) seats.push(p);
      }
    }
    expect(await proposalState(draft.proposal_id)).toBe("READY");

    const leaving = seats[10]!;
    const result = await ok<{ withdrawn_reservations: number }>(api("delete_my_account", leaving, randomUUID()));
    expect(result.withdrawn_reservations).toBe(1);
    expect(await proposalState(draft.proposal_id)).toBe("OPEN");

    const { rows } = await admin.query("select display_name, deleted_at is not null as gone from scb.users where id = $1",
                                       [leaving]);
    expect(rows[0]).toEqual({ display_name: "Deleted member", gone: true });
    const valid = await app.query("select scb_api.demo_persona_valid($1, $2) as v", [demo.workspace_id, leaving]);
    expect(valid.rows[0].v).toBe(false);
    expect(await code(api("export_my_data", leaving))).toBe("AUTH_REQUIRED");
    expect(await code(api("delete_my_account", leaving, randomUUID()))).toBe("AUTH_REQUIRED");
  });

  it("clears an organiser's optional private meanings", async () => {
    const { rows: b } = await admin.query(
      "select * from scb.group_briefs where group_id = $1 order by version desc limit 1", [demo.groups.makers_group]);
    const brief = b[0];
    const { json } = await import("@/lib/db/api");
    await ok(api("save_group_brief", demo.users.org_makers, demo.groups.makers_group, brief.budget_pence,
      brief.expected_seats, json(brief.availability), brief.sharing_choice, true, brief.access_requirements,
      json([{ input_label: "A private reference", declared_meaning: "Something personal" }]), randomUUID()));
    await ok(api("delete_my_account", demo.users.org_makers, randomUUID()));
    const { rows } = await admin.query(
      `select r.declared_meaning from scb.group_references r join scb.group_briefs b on b.id = r.brief_id
       where b.group_id = $1`, [demo.groups.makers_group]);
    expect(rows.every((r) => r.declared_meaning === null)).toBe(true);
  });
});

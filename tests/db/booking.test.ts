import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requiredSeats } from "@/lib/domain/economics";
import { buildDemoDefinition } from "@/lib/demo/catalogue";
import {
  acceptAll, admin, api, app, code, COALITION, createDemo, currentQuoteId, inDays, key, ok, people,
  proposalState, publish, reserve, saveCuratorDraft, type Demo,
} from "./helpers";

let demo: Demo;
let other: Demo;

beforeAll(async () => {
  demo = await createDemo();
  other = await createDemo();
});

afterAll(async () => {
  await admin.query("update scb.workspaces set expires_at = now() - interval '1 second' where id = any($1)",
                    [[demo.workspace_id, other.workspace_id]]);
  await app.query("select scb_api.purge_expired_demos()").catch(() => undefined);
  await admin.query("select scb_api.purge_expired_demos()");
  await Promise.all([admin.end(), app.end()]);
});

/** Fills seats from the coalition's people until `count` are reserved. */
async function fillSeats(proposalId: string, versionId: string, count: number, version = 1) {
  const ids: string[] = [];
  for (const g of COALITION) {
    for (const person of people(demo, g)) {
      if (ids.length >= count) return ids;
      const r = await reserve(demo, person, proposalId, versionId, g, version);
      if (!r.ok) throw new Error(r.error.code);
      ids.push(r.data.reservation_id);
    }
  }
  return ids;
}

async function freshOpenProposal() {
  // Each test uses its own slot so proposals never compete for the same hold.
  await admin.query(
    `update scb.proposals set state = 'CANCELLED' where workspace_id = $1 and state in ('OPEN','READY','CONFIRMED')`,
    [demo.workspace_id]);
  await admin.query(`update scb.slots set status = 'AVAILABLE' where workspace_id = $1`, [demo.workspace_id]);
  await admin.query(`update scb.reservations set status = 'CANCELLED' where workspace_id = $1 and status = 'RESERVED'`,
                    [demo.workspace_id]);
  const draft = await saveCuratorDraft(demo);
  const pub = await publish(demo, draft.proposal_id);
  return { proposalId: draft.proposal_id, versionId: pub.proposal_version_id };
}

describe("database quote arithmetic", () => {
  it("matches the TypeScript requiredSeats implementation", async () => {
    const cases = [
      [30000, 500, 0, 200, 2000, 10, 30],
      [30000, 500, 0, 200, 700, 10, 30],
      [0, 0, 0, 0, 0, 2, 30],
      [0, 100, 5000, 0, 600, 1, 40],
      [12000, 400, 0, 100, 1500, 8, 20],
    ];
    for (const [fixed, variable, minCharge, fee, ticket, minSeats, capacity] of cases) {
      const { rows } = await admin.query("select scb.required_seats($1,$2,$3,$4,$5,$6,$7) as n",
        [fixed, variable, minCharge, fee, ticket, minSeats, capacity]);
      const ts = requiredSeats({ id: "q", version: 1, currency: "GBP", fixed_pence: fixed!, variable_pence: variable!,
        minimum_venue_charge_pence: minCharge!, platform_fee_pence: fee!, ticket_pence: ticket!,
        venue_min_seats: minSeats! }, capacity!);
      expect(rows[0].n).toBe(ts);
    }
  });
});

describe("full reservation lifecycle (T09-T13)", () => {
  it("goes from draft to venue-confirmed with individual seats", async () => {
    const draft = await saveCuratorDraft(demo);
    expect(await proposalState(draft.proposal_id)).toBe("DRAFT");

    const pub = await publish(demo, draft.proposal_id);
    expect(pub.version).toBe(1);
    expect(await proposalState(draft.proposal_id)).toBe("OPEN");

    // Organiser acceptance alone never creates seats (BR10).
    await acceptAll(demo, draft.proposal_id, pub.proposal_version_id);
    expect(await proposalState(draft.proposal_id)).toBe("OPEN");
    expect(await code(api("confirm_booking", demo.users.venue_manager, draft.proposal_id, 1, randomUUID(), key())))
      .toBe("NOT_READY");

    await fillSeats(draft.proposal_id, pub.proposal_version_id, 23);
    expect(await proposalState(draft.proposal_id)).toBe("OPEN");
    await fillSeats(draft.proposal_id, pub.proposal_version_id, 0); // no-op guard
    const last = await reserve(demo, people(demo, "makers_group")[6]!, draft.proposal_id,
                               pub.proposal_version_id, "makers_group");
    expect(last.ok && last.data.state).toBe("READY");

    const confirmed = await ok(api("confirm_booking", demo.users.venue_manager, draft.proposal_id, 1,
                                   randomUUID(), key()));
    expect(confirmed).toMatchObject({ state: "CONFIRMED", payment_status: "NOT_COLLECTED" });
    const { rows } = await admin.query("select status from scb.slots where id = $1", [demo.slots.curator_session_1]);
    expect(rows[0].status).toBe("BOOKED");

    // After confirmation, withdrawal is routed to the venue (BR13).
    const { rows: seat } = await admin.query(
      "select id, participant_id from scb.reservations where proposal_version_id = $1 and status = 'RESERVED' limit 1",
      [pub.proposal_version_id]);
    expect(await code(api("withdraw_seat", seat[0].participant_id, seat[0].id, randomUUID(), key())))
      .toBe("PROPOSAL_CLOSED");

    expect(await code(api("complete_proposal", demo.users.venue_manager, draft.proposal_id, randomUUID(), key())))
      .toBe("OK");
  });
});

describe("authorisation (T01, T18)", () => {
  it("hides drafts from participants and everything from other workspaces", async () => {
    const { proposalId } = await (async () => {
      await admin.query(`update scb.proposals set state = 'CANCELLED' where workspace_id = $1 and state <> 'CANCELLED'`,
                        [demo.workspace_id]);
      await admin.query(`update scb.slots set status = 'AVAILABLE' where workspace_id = $1`, [demo.workspace_id]);
      const d = await saveCuratorDraft(demo);
      return { proposalId: d.proposal_id };
    })();
    const participant = people(demo, "book_club")[1]!;
    expect(await code(api("get_proposal_detail", participant, proposalId))).toBe("NOT_FOUND");
    expect(await code(api("get_proposal_detail", demo.users.org_book, proposalId))).toBe("OK");
    expect(await code(api("get_proposal_detail", demo.users.org_walk, proposalId))).toBe("NOT_FOUND");
    expect(await code(api("get_proposal_detail", other.users.venue_manager, proposalId))).toBe("NOT_FOUND");
    expect(await code(api("get_workspace_overview", other.users.venue_manager, demo.workspace_id))).toBe("NOT_FOUND");
    expect(await code(api("publish_proposal", other.users.venue_manager, proposalId, inDays(7), randomUUID(), key())))
      .toBe("NOT_FOUND");
  });

  it("lets only the venue manager publish and confirm", async () => {
    await admin.query(`update scb.proposals set state = 'CANCELLED' where workspace_id = $1 and state <> 'CANCELLED'`,
                      [demo.workspace_id]);
    await admin.query(`update scb.slots set status = 'AVAILABLE' where workspace_id = $1`, [demo.workspace_id]);
    const draft = await saveCuratorDraft(demo);
    expect(await code(api("publish_proposal", demo.users.org_book, draft.proposal_id, inDays(7), randomUUID(), key())))
      .toBe("FORBIDDEN");
    await publish(demo, draft.proposal_id);
    expect(await code(api("confirm_booking", demo.users.org_book, draft.proposal_id, 1, randomUUID(), key())))
      .toBe("FORBIDDEN");
    expect(await code(api("cancel_proposal", demo.users.org_film, draft.proposal_id, "not allowed", randomUUID(), key())))
      .toBe("FORBIDDEN");
  });

  it("does not let an organiser answer for another group or a stranger reserve", async () => {
    const { proposalId, versionId } = await freshOpenProposal();
    expect(await code(api("respond_to_proposal", demo.users.org_book, proposalId, versionId, 1,
                          demo.groups.film_society, "ACCEPT", null, null, randomUUID(), key()))).toBe("FORBIDDEN");
    const walker = people(demo, "walking_group")[1]!;
    expect(await code(reserve(demo, walker, proposalId, versionId, "book_club"))).toBe("NOT_FOUND");
    // A film-society member cannot reserve through the book club.
    await acceptAll(demo, proposalId, versionId);
    expect(await code(reserve(demo, people(demo, "film_society")[2]!, proposalId, versionId, "book_club")))
      .toBe("FORBIDDEN");
  });

  it("never shows another group's member list or private brief in the proposal view", async () => {
    const { proposalId } = await freshOpenProposal();
    const view = await ok<Record<string, unknown>>(api("get_proposal_detail", people(demo, "film_society")[1]!, proposalId));
    const text = JSON.stringify(view);
    expect(text).not.toContain("budget_pence");
    expect(text).not.toContain("availability");
    expect(text).not.toContain(people(demo, "book_club")[1]!);
    expect(view.rationale).toBeNull();
    expect(view.readiness_blockers).toBeNull();
    expect(view.payment_status).toBe("NOT_COLLECTED");
  });
});

describe("reservation guards (T10-T12)", () => {
  it("requires organiser acceptance, adult declaration and shared-session consent", async () => {
    const { proposalId, versionId } = await freshOpenProposal();
    const person = people(demo, "book_club")[1]!;
    expect(await code(reserve(demo, person, proposalId, versionId, "book_club"))).toBe("NOT_READY");
    await acceptAll(demo, proposalId, versionId);
    expect(await code(api("reserve_seat", person, proposalId, versionId, 1, demo.groups.book_club,
                          true, false, randomUUID(), key()))).toBe("VALIDATION_FAILED");
    expect(await code(api("reserve_seat", person, proposalId, versionId, 1, demo.groups.book_club,
                          false, true, randomUUID(), key()))).toBe("VALIDATION_FAILED");
  });

  it("gives one person one seat, replays idempotently and rejects key reuse", async () => {
    const { proposalId, versionId } = await freshOpenProposal();
    await acceptAll(demo, proposalId, versionId);
    const person = people(demo, "book_club")[2]!;
    const idem = key();
    const first = await reserve(demo, person, proposalId, versionId, "book_club", 1, idem);
    const replay = await reserve(demo, person, proposalId, versionId, "book_club", 1, idem);
    expect(first.ok && replay.ok && replay.data.reservation_id).toBe(first.ok && first.data.reservation_id);
    expect(replay.ok && replay.replayed).toBe(true);
    expect(await code(reserve(demo, person, proposalId, versionId, "book_club"))).toBe("ALREADY_RESERVED");
    expect(await code(api("reserve_seat", person, proposalId, versionId, 1, demo.groups.film_society,
                          true, true, randomUUID(), idem))).toBe("IDEMPOTENCY_CONFLICT");
    const { rows } = await admin.query(
      "select count(*)::int as n from scb.reservations where participant_id = $1 and status = 'RESERVED'", [person]);
    expect(rows[0].n).toBe(1);
  });

  it("rejects a stale version number", async () => {
    const { proposalId, versionId } = await freshOpenProposal();
    await acceptAll(demo, proposalId, versionId);
    expect(await code(reserve(demo, people(demo, "book_club")[1]!, proposalId, versionId, "book_club", 2)))
      .toBe("VERSION_CONFLICT");
  });

  it("returns READY to OPEN when a seat is withdrawn, so stale readiness cannot be confirmed", async () => {
    const { proposalId, versionId } = await freshOpenProposal();
    await acceptAll(demo, proposalId, versionId);
    const seats = await fillSeats(proposalId, versionId, 24);
    expect(await proposalState(proposalId)).toBe("READY");
    const { rows } = await admin.query("select participant_id from scb.reservations where id = $1", [seats[0]]);
    expect(await code(api("withdraw_seat", rows[0].participant_id, seats[0], randomUUID(), key()))).toBe("OK");
    expect(await proposalState(proposalId)).toBe("OPEN");
    expect(await code(api("confirm_booking", demo.users.venue_manager, proposalId, 1, randomUUID(), key())))
      .toBe("NOT_READY");
  });

  it("an organiser reversing to DECLINE makes the proposal not ready", async () => {
    const { proposalId, versionId } = await freshOpenProposal();
    await acceptAll(demo, proposalId, versionId);
    await fillSeats(proposalId, versionId, 24);
    expect(await proposalState(proposalId)).toBe("READY");
    await ok(api("respond_to_proposal", demo.users.org_film, proposalId, versionId, 1, demo.groups.film_society,
                 "DECLINE", "TIME", "Clashes with our screening", randomUUID(), key()));
    expect(await proposalState(proposalId)).toBe("OPEN");
  });
});

describe("last-seat race (T11)", () => {
  it("lets exactly one of many concurrent attempts take the final seat", async () => {
    const { proposalId, versionId } = await freshOpenProposal();
    await acceptAll(demo, proposalId, versionId);
    await admin.query("update scb.slots set capacity = 25 where id = $1", [demo.slots.curator_session_1]);
    try {
      await fillSeats(proposalId, versionId, 24);
      // Five people who do not yet hold a seat race for the single remaining one.
      const { rows } = await admin.query(
        `select gm.user_id, g.id as group_id from scb.group_memberships gm join scb.groups g on g.id = gm.group_id
         where g.id = any($1) and not exists (select 1 from scb.reservations r where r.participant_id = gm.user_id
           and r.status = 'RESERVED') limit 5`,
        [COALITION.map((g) => demo.groups[g])]);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const results = await Promise.all(rows.map((r) =>
        api("reserve_seat", r.user_id, proposalId, versionId, 1, r.group_id, true, true, randomUUID(), key())));
      const codes = results.map((r) => (r.ok ? "OK" : r.error.code));
      expect(codes.filter((c) => c === "OK")).toHaveLength(1);
      expect(codes.filter((c) => c !== "OK").every((c) => c === "CAPACITY_EXCEEDED")).toBe(true);
      const { rows: count } = await admin.query(
        "select count(*)::int as n from scb.reservations where proposal_version_id = $1 and status = 'RESERVED'",
        [versionId]);
      expect(count[0].n).toBe(25);
    } finally {
      await admin.query("update scb.slots set capacity = 30 where id = $1", [demo.slots.curator_session_1]);
    }
  });

  it("lets only one of two concurrent confirmations succeed", async () => {
    const { proposalId, versionId } = await freshOpenProposal();
    await acceptAll(demo, proposalId, versionId);
    await fillSeats(proposalId, versionId, 24);
    const results = await Promise.all([0, 1].map(() =>
      api("confirm_booking", demo.users.venue_manager, proposalId, 1, randomUUID(), key())));
    const codes = results.map((r) => (r.ok ? "OK" : r.error.code)).sort();
    expect(codes).toEqual(["OK", "PROPOSAL_CLOSED"]);
  });
});

describe("revisions, expiry and cancellation (T13, T14)", () => {
  it("a material revision invalidates old decisions and seats", async () => {
    const { proposalId, versionId } = await freshOpenProposal();
    await acceptAll(demo, proposalId, versionId);
    const seats = await fillSeats(proposalId, versionId, 5);
    const newQuote = await ok<{ quote_id: string }>(api("create_quote", demo.users.venue_manager,
      demo.experiences.curator_session, 30000, 500, 200, 1900, 0, 10, randomUUID()));
    // The old quote is no longer current, so the old version cannot become ready.
    const revised = await ok<{ proposal_version_id: string; version: number; released_reservations: number }>(
      api("revise_proposal", demo.users.venue_manager, proposalId, 1, newQuote.quote_id, inDays(6), randomUUID(), key()));
    expect(revised.version).toBe(2);
    expect(revised.released_reservations).toBe(seats.length);
    const { rows } = await admin.query("select distinct status from scb.reservations where id = any($1)", [seats]);
    expect(rows.map((r) => r.status)).toEqual(["INVALIDATED"]);
    // Old version terms are rejected; new terms need fresh acceptance.
    expect(await code(reserve(demo, people(demo, "book_club")[3]!, proposalId, versionId, "book_club", 1)))
      .toBe("VERSION_CONFLICT");
    expect(await code(reserve(demo, people(demo, "book_club")[3]!, proposalId, revised.proposal_version_id,
                              "book_club", 2))).toBe("NOT_READY");
    // Published terms are immutable at the database level.
    await expect(admin.query("update scb.proposal_versions set required_seats = 1 where id = $1", [versionId]))
      .rejects.toThrow(/IMMUTABLE_RECORD/);
  });

  it("expires at the database deadline and releases the slot", async () => {
    await admin.query(`update scb.proposals set state = 'CANCELLED' where workspace_id = $1 and state <> 'CANCELLED'`,
                      [demo.workspace_id]);
    await admin.query(`update scb.slots set status = 'AVAILABLE' where workspace_id = $1`, [demo.workspace_id]);
    const draft = await saveCuratorDraft(demo);
    const pub = await publish(demo, draft.proposal_id, new Date(Date.now() + 1500).toISOString());
    await acceptAll(demo, draft.proposal_id, pub.proposal_version_id);
    const seat = await reserve(demo, people(demo, "book_club")[1]!, draft.proposal_id, pub.proposal_version_id, "book_club");
    expect(seat.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 1700));
    expect(await code(reserve(demo, people(demo, "book_club")[2]!, draft.proposal_id, pub.proposal_version_id,
                              "book_club"))).toBe("PROPOSAL_EXPIRED");
    const { rows } = await admin.query("select scb_api.expire_proposals() as n");
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
    expect(await proposalState(draft.proposal_id)).toBe("EXPIRED");
    const { rows: slot } = await admin.query("select status from scb.slots where id = $1", [demo.slots.curator_session_1]);
    expect(slot[0].status).toBe("AVAILABLE");
    const { rows: again } = await admin.query("select scb_api.expire_proposals() as n");
    expect(again[0].n).toBe(0);
  });

  it("requires a reason to cancel and records an audit event", async () => {
    const { proposalId } = await freshOpenProposal();
    expect(await code(api("cancel_proposal", demo.users.venue_manager, proposalId, "", randomUUID(), key())))
      .toBe("VALIDATION_FAILED");
    expect(await code(api("cancel_proposal", demo.users.operator, proposalId, "Venue closure", randomUUID(), key())))
      .toBe("OK");
    const { rows } = await admin.query(
      "select metadata from scb.audit_events where object_id = $1 and action = 'proposal.cancelled'", [proposalId]);
    expect(rows[0].metadata.reason).toBe("Venue closure");
  });

  it("refuses to publish a second proposal on a held slot (BR08)", async () => {
    await freshOpenProposal();
    const second = await saveCuratorDraft(demo);
    expect(await code(api("publish_proposal", demo.users.venue_manager, second.proposal_id, inDays(7),
                          randomUUID(), key()))).toBe("SLOT_UNAVAILABLE");
  });

  it("refuses to publish when a group's sharing choice blocks the coalition", async () => {
    await admin.query(`update scb.proposals set state = 'CANCELLED' where workspace_id = $1 and state <> 'CANCELLED'`,
                      [demo.workspace_id]);
    await admin.query(`update scb.slots set status = 'AVAILABLE' where workspace_id = $1`, [demo.workspace_id]);
    const quote = await currentQuoteId(demo, "curator_session");
    const { rows } = await admin.query("select scb.quote_required_seats($1, 30) as n", [quote]);
    const draft = await ok<{ proposal_id: string }>(api("save_draft", demo.users.org_book, demo.workspace_id,
      demo.slots.curator_session_1, quote, [demo.groups.book_club, demo.groups.walking_group], rows[0].n, "synthetic",
      {}, null, randomUUID()));
    const r = await api("publish_proposal", demo.users.venue_manager, draft.proposal_id, inDays(7), randomUUID(), key());
    expect(r.ok ? "OK" : r.error.code).toBe("NOT_READY");
  });
});

describe("privilege boundary", () => {
  it("gives the application login no direct table access", async () => {
    await expect(app.query("select * from scb.reservations limit 1")).rejects.toThrow(/permission denied/);
    await expect(app.query("update scb.slots set capacity = 999")).rejects.toThrow(/permission denied/);
  });

  it("does not expose guarded functions to browser roles", async () => {
    const client = await admin.connect();
    try {
      for (const role of ["anon", "authenticated"]) {
        await client.query(`set role ${role}`);
        await expect(client.query("select scb_api.get_actor_context(gen_random_uuid())"))
          .rejects.toThrow(/permission denied/);
        await client.query("reset role");
      }
    } finally {
      client.release();
    }
  });

  it("keeps quotes immutable", async () => {
    await expect(admin.query("update scb.quotes set ticket_pence = 1 where experience_id = $1",
                             [demo.experiences.curator_session])).rejects.toThrow(/IMMUTABLE_RECORD/);
  });

  it("limits demo personas to their own unexpired sandbox", async () => {
    const valid = await app.query("select scb_api.demo_persona_valid($1, $2) as v",
                                  [demo.workspace_id, demo.users.venue_manager]);
    const crossed = await app.query("select scb_api.demo_persona_valid($1, $2) as v",
                                    [demo.workspace_id, other.users.venue_manager]);
    expect(valid.rows[0].v).toBe(true);
    expect(crossed.rows[0].v).toBe(false);
    expect(buildDemoDefinition().venue.name).toMatch(/fictional/);
  });
});

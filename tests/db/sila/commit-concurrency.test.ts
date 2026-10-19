import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, app, approvedPlan, key, publishedSession, sila, type TestPlan } from "./fixtures";

afterAll(async () => {
  await Promise.all([admin.end(), app.end()]);
});

const CLUBS = 100;
let session: Awaited<ReturnType<typeof publishedSession>>;
const plans: TestPlan[] = [];

beforeAll(async () => {
  session = await publishedSession({ capacity: 20, minimum: 16, max_clubs: 2 });
  // Each plan has its own organiser and a venue approval for 10 places; created in small batches.
  for (let i = 0; i < CLUBS; i += 10) {
    plans.push(...(await Promise.all(Array.from({ length: 10 }, (_, j) =>
      approvedPlan({ session, places: 10, clubName: `Club ${i + j + 1}` })))));
  }
}, 180_000);

describe("sila commit_plan under contention", () => {
  it("lets exactly two of 100 approved clubs commit and reaches the minimum once", async () => {
    const results = await Promise.all(plans.map((p) =>
      sila("commit_plan", p.organiser.personId, key(), p.planId, 10, 1)));

    const ok = results.filter((r) => r.ok);
    const codes = results.flatMap((r) => (r.ok ? [] : [r.error.code]));
    expect(ok).toHaveLength(2);
    expect(codes).toHaveLength(CLUBS - 2);
    expect(codes.every((c) => c === "CLUB_LIMIT_REACHED" || c === "MINIMUM_ALREADY_REACHED")).toBe(true);

    const live = await admin.query<{ places: number }>(
      "select places from sila.allocations where session_id = $1 and status = 'live'", [session.sessionId]);
    expect(live.rows).toHaveLength(2);
    expect(live.rows.reduce((sum, r) => sum + r.places, 0)).toBe(20);

    const { rows: [s] } = await admin.query("select minimum_reached_at from sila.sessions where id = $1",
                                            [session.sessionId]);
    expect(s.minimum_reached_at).not.toBeNull();
    const reached = ok.filter((r) => r.ok && (r.data as { reaches_minimum: boolean }).reaches_minimum);
    expect(reached).toHaveLength(1);
    const minimumAudit = await admin.query(
      "select count(*)::int as n from sila.audit_events where command = 'minimum_reached' and entity_id = $1",
      [session.sessionId]);
    expect(minimumAudit.rows[0].n).toBe(1);

    const outbox = await admin.query(
      "select count(*)::int as n from sila.outbox where topic = 'payment.schedule' and payload->>'session_id' = $1",
      [session.sessionId]);
    expect(outbox.rows[0].n).toBe(1);
  }, 120_000);
});

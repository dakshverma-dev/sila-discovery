import { afterAll, describe, expect, it } from "vitest";
import { admin, app, key, makePerson, openedSession, okData, sila } from "./fixtures";
import type { PracticalSummary } from "@/lib/sila/commands/practical-summary";

afterAll(async () => { await Promise.all([admin.end(), app.end()]); });
async function confirmed() {
  const s = await openedSession({ places: [7, 9], session: { calendar_version: "scotland-2026-2027.v1+closures.none" } });
  for (const p of s.plans) await okData(sila("record_receipt", s.venue.finance.personId, key(), p.allocationId,
    "deposit", p === s.plans[0] ? 6125 : 7875, new Date(Date.now()-1000).toISOString(), key(), "Private evidence not for export"));
  const { rows } = await admin.query("select version from sila.sessions where id=$1", [s.sessionId]);
  await okData(sila("confirm_session", s.venue.coordinator.personId, key(), s.sessionId, rows[0].version, true));
  return s;
}

describe("private offline practical summaries (§17, §19, §27)", () => {
  it("includes only the organiser's club, permits venue/scoped operator, excludes evidence", async () => {
    const s = await confirmed();
    const own = await okData(sila<PracticalSummary>("get_practical_summary", s.plans[0]!.organiser.personId, s.sessionId));
    expect(own.groups).toHaveLength(1);
    expect(own.groups[0]).toMatchObject({ places: 7, deposit_minor: 6125 });
    expect(JSON.stringify(own)).not.toContain("Private evidence");
    for (const p of [s.venue.coordinator, s.venue.finance, s.venue.operator]) {
      const all = await okData(sila<PracticalSummary>("get_practical_summary", p.personId, s.sessionId));
      expect(all.groups).toHaveLength(2);
    }
    const other = await makePerson(`${key()}@test.example`);
    expect(await sila("get_practical_summary", other.personId, s.sessionId)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    await admin.query("update sila.operator_venue_scopes set revoked_at=now(),revoked_reason='Rehearsal revocation' where venue_id=$1", [s.venue.venueId]);
    expect(await sila("get_practical_summary", s.venue.operator.personId, s.sessionId)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("retains confirmed amounts but states current cancellation; no unconfirmed export", async () => {
    const s = await confirmed();
    const { rows } = await admin.query("select version from sila.sessions where id=$1", [s.sessionId]);
    await okData(sila("close_session", s.venue.coordinator.personId, key(), s.sessionId, rows[0].version, "venue_fault", "Synthetic venue closure"));
    const summary = await okData(sila<PracticalSummary>("get_practical_summary", s.plans[0]!.organiser.personId, s.sessionId));
    expect(summary).toMatchObject({ phase: "cancelled", closed_reason: "Synthetic venue closure" });
    expect(summary.groups[0]!.places).toBe(7);
    const unconfirmed = await openedSession();
    expect(await sila("get_practical_summary", unconfirmed.venue.coordinator.personId, unconfirmed.sessionId)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

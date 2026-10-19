import { describe, expect, it } from "vitest";
import { admin, approvedPlan, committedPlan, okData, sila, submittedPlan } from "./fixtures";

interface Terms {
  terms_version: number;
  venue_terms_version: string | null;
  venue_terms_text: string | null;
  platform_terms_version: string | null;
  balance_due_at: string;
  payment_window_days: number;
  allocation_id: string | null;
  released_places: number;
}

const viewOf = (plan: { organiser: { personId: string }; planId: string }) =>
  okData(sila<{ terms: Terms }>("get_my_plan", plan.organiser.personId, plan.planId));

describe("get_my_plan terms (organiser screens)", () => {
  it("shows the agreed terms and no allocation id before commitment", async () => {
    const plan = await submittedPlan();
    const { terms } = await viewOf(plan);
    expect(terms).toMatchObject({
      terms_version: 1,
      venue_terms_version: "venue-v1",
      venue_terms_text: "Synthetic venue terms for tests.",
      platform_terms_version: "platform-v1",
      payment_window_days: 5,
      allocation_id: null,
      released_places: 0,
    });
    expect(Number.isNaN(new Date(terms.balance_due_at).getTime())).toBe(false);
  });

  it("returns only the caller's own live allocation id", async () => {
    const a = await committedPlan({ places: 7 });
    const b = await committedPlan({ session: { sessionId: a.sessionId, venue: a.venue }, places: 9 });
    const mineA = (await viewOf(a)).terms.allocation_id;
    const mineB = (await viewOf(b)).terms.allocation_id;
    expect(mineA).toBe(a.allocationId);
    expect(mineB).toBe(b.allocationId);
    expect(mineA).not.toBe(mineB);
  });

  it("counts the places released when the session closed below its minimum", async () => {
    const plan = await approvedPlan({ places: 7 });
    await okData(
      sila("commit_plan", plan.organiser.personId, `commit-${plan.planId}`, plan.planId, 7, 1),
    );
    await admin.query("update sila.sessions set fill_by = now() - interval '1 hour' where id = $1", [plan.sessionId]);
    await okData(sila("close_unfilled_session", plan.sessionId));
    const { terms } = await viewOf(plan);
    expect(terms.released_places).toBe(7);
    expect(terms.allocation_id).toBeNull();
  });
});

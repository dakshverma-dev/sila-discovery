import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanFacts } from "@/lib/sila/status";

const callSila = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sila/db", () => ({ callSila }));

const { getMyPlan, listMyPlans, submitPlan } = await import("@/lib/sila/commands/plans");

const actor = { personId: "00000000-0000-4000-8000-0000000000aa", email: "o@test.example" };
const facts = (overrides: Partial<PlanFacts> = {}): PlanFacts => ({
  submitted: true, approved: false, committed: false, closed: false, minimumReached: false,
  openingBlocked: false, paymentOpened: false, ownPaymentReported: false, ownDepositVerified: false,
  allDepositsVerified: false, confirmed: false, balanceDefaultEstablished: false, amendmentPending: false,
  ...overrides,
});

beforeEach(() => callSila.mockReset());

describe("plan commands", () => {
  it("passes submit_plan arguments in the database order", async () => {
    callSila.mockResolvedValueOnce({ ok: true, data: { plan_id: "p1", plan_ref: "PL1001" } });
    await submitPlan(actor, "key-12345678", { sessionId: "s1", clubName: "Walkers", places: 6, source: "referral" });
    expect(callSila).toHaveBeenCalledWith("submit_plan", [actor.personId, "key-12345678", "s1", "Walkers", 6,
                                                          "referral"]);
  });

  it("derives the viewer status from the database facts", async () => {
    callSila.mockResolvedValueOnce({ ok: true, data: { plan: {}, session: {}, messages: [], facts: facts() } });
    const open = await getMyPlan(actor, "p1");
    expect(open.ok && open.data.status).toBe("waiting_for_venue_approval");

    callSila.mockResolvedValueOnce({ ok: true, data: { plan: {}, session: {}, messages: [],
                                                       facts: facts({ closed: true }) } });
    const closed = await getMyPlan(actor, "p1");
    expect(closed.ok && closed.data.status).toBe("not_proceeding");
  });

  it("passes errors through unchanged", async () => {
    const notFound = { ok: false, error: { code: "NOT_FOUND", message: "Not found.", retryable: false } };
    callSila.mockResolvedValueOnce(notFound);
    expect(await getMyPlan(actor, "p1")).toEqual(notFound);
  });

  it("adds a derived status to each listed plan", async () => {
    callSila.mockResolvedValueOnce({ ok: true, data: { plans: [{ id: "p1", status: "declined",
                                                                 facts: facts({ closed: true }) }] } });
    const r = await listMyPlans(actor);
    expect(r.ok && r.data.plans[0]).toMatchObject({ status: "declined", plan_status: "not_proceeding" });
  });
});

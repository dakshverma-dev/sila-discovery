import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callSila = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sila/db", () => ({ callSila }));

const { runSilaTick } = await import("@/lib/sila/commands/worker");
const { POST } = await import("@/app/api/v1/internal/sila-tick/route");

const DAY_MS = 86_400_000;
const SCHEDULED = new Date(Date.now() - 60_000).toISOString();
const work = (id: string, decisionInDays = 14) => ({
  id, minimum_reached_at: new Date().toISOString(), covered_dates: [],
  decision_by: new Date(Date.now() + decisionInDays * DAY_MS).toISOString(), payment_window_days: 5,
  payment_scheduled_for: SCHEDULED,
});
const ok = (data: unknown) => ({ ok: true, data });

beforeEach(() => {
  callSila.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("runSilaTick", () => {
  it("keeps going when one session fails and counts only real changes", async () => {
    callSila.mockImplementation(async (fn: string, args: unknown[]) => {
      const id = args[0];
      switch (fn) {
        case "close_decision_sessions": return ok({ closed: 0, blocked: 0 });
        case "list_session_work":
          return ok({ to_schedule: [], to_release: [work("bad"), work("good"), work("late", 3), work("again")],
                      to_reschedule: [work("m1"), work("m2")], to_close: [work("c1"), work("c2")] });
        case "reschedule_payment_opening":
          return ok({ payment_scheduled_for: null, blocked_reason: "NO_COVERAGE", rescheduled: id === "m1" });
        case "release_payment_opening":
          if (id === "bad") throw new Error("connection reset");
          return ok({ payment_opened_at: "x", pay_by: "y", verify_by: "z", opened: id === "good" });
        case "block_payment_opening":
          return ok({ blocked_reason: "VERIFY_AFTER_DECISION", blocked: true });
        case "close_unfilled_session":
          return id === "c1" ? ok({ session_id: id, released_allocations: 1 })
            : { ok: false, error: { code: "NOT_READY", message: "", retryable: false } };
        default:
          throw new Error(`unexpected ${fn}`);
      }
    });
    expect(await runSilaTick()).toEqual({ scheduled: 0, rescheduled: 1, released: 1, blocked: 1, closed: 1 });
    const m1 = work("m1");
    expect(callSila).toHaveBeenCalledWith("reschedule_payment_opening",
                                          ["m1", m1.payment_scheduled_for, null, "NO_COVERAGE"]);
    expect(callSila).toHaveBeenCalledWith("block_payment_opening", ["late", "VERIFY_AFTER_DECISION"]);
    const released = callSila.mock.calls.filter(([fn]) => fn === "release_payment_opening").map(([, a]) => a[0]);
    expect(released).toEqual(["bad", "good", "again"]);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/v1/internal/sila-tick", () => {
  const secret = "s".repeat(40);
  beforeEach(() => vi.stubEnv("WORKER_TRIGGER_SECRET", secret));
  afterEach(() => vi.unstubAllEnvs());

  it("refuses a request without the worker secret", async () => {
    const attempts: Record<string, string>[] = [{}, { authorization: "Bearer wrong" },
                                                { authorization: `Bearer ${secret}x` }];
    for (const headers of attempts) {
      const res = await POST(new Request("http://localhost/api/v1/internal/sila-tick", { method: "POST", headers }),
                             undefined);
      expect(res.status).toBe(401);
    }
    expect(callSila).not.toHaveBeenCalled();
  });

  it("runs one pass and returns the counts", async () => {
    callSila.mockImplementation(async (fn: string) => fn === "close_decision_sessions"
      ? ok({ closed: 0, blocked: 0 }) : ok({ to_schedule: [], to_release: [], to_reschedule: [], to_close: [] }));
    const res = await POST(new Request("http://localhost/api/v1/internal/sila-tick", {
      method: "POST", headers: { authorization: `Bearer ${secret}` } }), undefined);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ scheduled: 0, rescheduled: 0, released: 0, blocked: 0, closed: 0 });
  });
});

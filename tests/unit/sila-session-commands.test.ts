import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VenueSessionRow } from "@/lib/sila/forms";
import { fromLocal } from "@/lib/sila/time";

const callSila = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sila/db", () => ({ callSila }));

const { publishSession } = await import("@/lib/sila/commands/sessions");

const actor = { personId: "00000000-0000-4000-8000-0000000000aa", email: "c@test.example" };
const iso = (date: string, h: number) => fromLocal(date, h).toISOString();

function view(overrides: Partial<VenueSessionRow> = {}, roles = ["coordinator"]) {
  return {
    ok: true,
    data: {
      roles,
      venue: {},
      session: {
        id: "s1", phase: "draft", version: 3, title: "Printmaking for clubs",
        starts_at: iso("2026-11-19", 18), ends_at: iso("2026-11-19", 20), price_minor: 3500, minimum: 16,
        capacity: 20, max_clubs: 2, deposit_bp: 2500, payment_window_days: 5,
        fill_by: iso("2026-11-04", 12), decision_by: iso("2026-11-12", 12), balance_due_at: iso("2026-11-13", 12),
        hold_expires_at: iso("2026-11-12", 12), hold_checked_by: "coordinator",
        covered_dates: ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11",
                        "2026-11-12"],
        venue_terms_version: "venue-v1", platform_terms_version: "platform-v1",
        access_facts_reviewed: true, run_at_minimum_approved: true,
        ...overrides,
      },
    },
  };
}

beforeEach(() => callSila.mockReset());

describe("publishSession", () => {
  it("returns NOT_READY with blockers and never calls publish_session", async () => {
    callSila.mockResolvedValueOnce(view({ covered_dates: [] }));
    const r = await publishSession(actor, "key-12345678", "s1", 3);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("NOT_READY");
    expect(r.error.details).toMatchObject({
      blockers: expect.arrayContaining(["COVERAGE_MISSING", "FILL_BY_TOO_LATE"]),
      latest_fill_by: null,
    });
    expect(callSila).toHaveBeenCalledTimes(1);
  });

  it("publishes a ready draft with the calendar version", async () => {
    callSila.mockResolvedValueOnce(view()).mockResolvedValueOnce({ ok: true, data: { session_id: "s1" } });
    await publishSession(actor, "key-12345678", "s1", 3);
    expect(callSila).toHaveBeenLastCalledWith("publish_session",
      [actor.personId, "key-12345678", "s1", 3, expect.stringMatching(/^scotland-/)]);
  });

  it("leaves non-coordinators and stale versions to the database", async () => {
    callSila.mockResolvedValue(view({ covered_dates: [] }, ["finance"]));
    await publishSession(actor, "key-12345678", "s1", 3);
    expect(callSila).toHaveBeenLastCalledWith("publish_session", expect.any(Array));
    callSila.mockReset();
    callSila.mockResolvedValue(view({ covered_dates: [] }));
    await publishSession(actor, "key-12345678", "s1", 2);
    expect(callSila).toHaveBeenLastCalledWith("publish_session", expect.any(Array));
  });
});

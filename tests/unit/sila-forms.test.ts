import { describe, expect, it } from "vitest";
import { isBusinessDay, scottishVenueCalendar } from "@/lib/sila/calendar";
import {
  formatLondon,
  formatLondonDay,
  formatLondonRange,
  parseLondonDateTime,
  parseLondonReturnTime,
  sessionDraftSchema,
  toSessionDraft,
  type VenueSessionRow,
} from "@/lib/sila/forms";
import { checkPublication } from "@/lib/sila/session";
import { addDays, fromLocal } from "@/lib/sila/time";

const cal = scottishVenueCalendar();

function coveredBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isBusinessDay(cal, d)) out.push(d);
  return out;
}

const iso = (date: string, h: number, m = 0) => fromLocal(date, h, m).toISOString();

/** The §29 worked session as `get_venue_session` returns it. */
const referenceRow: VenueSessionRow = {
  id: "00000000-0000-4000-8000-000000000001",
  venue_id: "00000000-0000-4000-8000-000000000002",
  version: 1,
  phase: "draft",
  terms_version: 1,
  title: "Printmaking for clubs",
  description: null,
  inclusions: null,
  image_url: null,
  meeting_point: null,
  starts_at: iso("2026-11-19", 18),
  ends_at: iso("2026-11-19", 20),
  price_minor: 3500,
  minimum: 16,
  capacity: 20,
  max_clubs: 2,
  deposit_bp: 2500,
  payment_window_days: 5,
  fill_by: iso("2026-11-04", 12),
  decision_by: iso("2026-11-12", 12),
  balance_due_at: iso("2026-11-13", 12),
  resource_name: "Print room",
  hold_expires_at: iso("2026-11-12", 12),
  hold_checked_by: "coordinator",
  hold_checked_at: iso("2026-10-18", 10),
  covered_dates: coveredBetween("2026-11-04", "2026-11-12"),
  venue_terms_version: "venue-v1",
  venue_terms_text: "Venue terms.",
  platform_terms_version: "platform-v1",
  access_facts_reviewed: true,
  run_at_minimum_approved: true,
  payment_route: null,
  calendar_version: null,
  intake_paused: false,
  intake_paused_reason: null,
  minimum_reached_at: null,
  payment_scheduled_for: null,
  payment_opened_at: null,
  pay_by: null,
  verify_by: null,
  payment_opening_blocked_reason: null,
  published_at: null,
  closed_at: null,
  closed_reason: null,
  confirmed_at: null,
  created_by: null,
  updated_at: iso("2026-10-18", 10),
};

describe("parseLondonDateTime", () => {
  it("reads London summer time before the 25 October 2026 clock change", () => {
    expect(parseLondonDateTime("2026-10-22T12:00")?.toISOString()).toBe("2026-10-22T11:00:00.000Z");
  });

  it("reads London winter time after the clock change", () => {
    expect(parseLondonDateTime("2026-11-04T12:00")?.toISOString()).toBe("2026-11-04T12:00:00.000Z");
  });

  it("accepts only YYYY-MM-DDTHH:mm for a real date and time", () => {
    for (const bad of ["2026-11-04 12:00", "", "2026-02-30T12:00", "2026-11-04T24:00", "2026-11-04T12:60",
                       "2026-11-04T12:00:00", "2026-11-04T12:00Z", " 2026-11-04T12:00"]) {
      expect(parseLondonDateTime(bad), bad).toBeNull();
    }
  });

  it("rejects a wall time that does not exist in London (spring gap)", () => {
    expect(parseLondonDateTime("2027-03-28T01:30")).toBeNull();
  });
});

describe("parseLondonReturnTime (§18)", () => {
  it("retains actual return seconds in London summer and winter time", () => {
    expect(parseLondonReturnTime("2026-10-22T12:00:37")?.toISOString()).toBe("2026-10-22T11:00:37.000Z");
    expect(parseLondonReturnTime("2026-11-04T12:00:59")?.toISOString()).toBe("2026-11-04T12:00:59.000Z");
    expect(parseLondonReturnTime("2026-11-04T12:00")?.toISOString()).toBe("2026-11-04T12:00:00.000Z");
  });
  it("rejects invalid seconds, dates and skipped London wall times", () => {
    for (const value of ["2026-11-04T12:00:60", "2026-02-30T12:00:01", "2027-03-28T01:30:02", "2026-11-04T12:00:01Z"]) {
      expect(parseLondonReturnTime(value)).toBeNull();
    }
  });
});

describe("sessionDraftSchema", () => {
  it("converts London wall times and pounds to the stored draft", () => {
    const parsed = sessionDraftSchema.parse({
      title: "  Printmaking for clubs ",
      starts_at: "2026-11-19T18:00",
      fill_by: "2026-11-04T12:00",
      price: "35.00",
      minimum: "16",
      capacity: 20,
      covered_dates: ["2026-11-05", "2026-11-04", "2026-11-04"],
      description: "",
      access_facts_reviewed: true,
    });
    expect(parsed).toEqual({
      title: "Printmaking for clubs",
      starts_at: "2026-11-19T18:00:00.000Z",
      fill_by: "2026-11-04T12:00:00.000Z",
      price_minor: 3500,
      minimum: 16,
      capacity: 20,
      covered_dates: ["2026-11-04", "2026-11-05"],
      description: null,
      access_facts_reviewed: true,
    });
  });

  it("reports field errors for bad values and unknown or lifecycle fields", () => {
    const r = sessionDraftSchema.safeParse({
      starts_at: "2026-11-19 18:00",
      price: "35.555",
      covered_dates: ["2026-02-30"],
      phase: "published",
    });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join(".") || String(i.message));
    expect(paths).toEqual(expect.arrayContaining(["starts_at", "price", "covered_dates.0"]));
    expect(r.success ? [] : r.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
  });
});

describe("toSessionDraft", () => {
  it("maps the §29 row so it passes the publication gates", () => {
    const draft = toSessionDraft(referenceRow);
    expect(draft.startsAt.toISOString()).toBe("2026-11-19T18:00:00.000Z");
    expect(draft.coveredDates).toEqual(coveredBetween("2026-11-04", "2026-11-12"));
    expect(checkPublication(draft, cal).blockers).toEqual([]);
  });

  it("keeps a missing hold as a blocker", () => {
    const draft = toSessionDraft({ ...referenceRow, hold_expires_at: null, hold_checked_by: null });
    expect(checkPublication(draft, cal).blockers).toContain("RESOURCE_HOLD_MISSING");
  });
});

describe("formatLondon", () => {
  it("writes a London time with weekday, day, month and 24-hour clock", () => {
    expect(formatLondon(new Date("2026-11-04T12:00:00Z"))).toBe("Wednesday 4 November at 12:00 London");
    expect(formatLondon(new Date("2026-10-22T11:00:00Z"))).toBe("Thursday 22 October at 12:00 London");
  });

  it("follows the clock change on 25 October 2026", () => {
    expect(formatLondon(new Date("2026-10-25T00:30:00Z"))).toBe("Sunday 25 October at 01:30 London");
    expect(formatLondon(new Date("2026-10-25T01:30:00Z"))).toBe("Sunday 25 October at 01:30 London");
    expect(formatLondon(new Date("2026-10-25T23:59:00Z"))).toBe("Sunday 25 October at 23:59 London");
  });

  it("formats a day and a time range for a session", () => {
    expect(formatLondonDay(new Date("2026-11-19T18:00:00Z"))).toBe("Thursday 19 November");
    expect(formatLondonRange(new Date("2026-11-19T18:00:00Z"), new Date("2026-11-19T20:00:00Z"))).toBe(
      "18:00 to 20:00",
    );
  });
});

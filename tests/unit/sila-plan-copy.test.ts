import { describe, expect, it } from "vitest";
import { depositDueView as committed, planView as view } from "./support/plan-view";
import {
  commitGate,
  conditionalClubUpdate,
  depositOutstanding,
  fieldErrorsFrom,
  planErrorMessage,
  poundsInput,
  practicalDetails,
  requestClosedMessage,
  treasurerInstructions,
} from "@/lib/sila/plan-copy";

const NOW = new Date("2026-10-20T10:00:00Z");


describe("planErrorMessage", () => {
  it("maps rejection codes to plain language", () => {
    expect(planErrorMessage("STALE_TERMS")).toBe("The session's terms changed. Review the new terms before committing.");
    const filled = "This session has filled. Your details are kept — ask the venue about another session.";
    for (const code of ["MINIMUM_ALREADY_REACHED", "CLUB_LIMIT_REACHED", "CAPACITY_EXCEEDED"]) {
      expect(planErrorMessage(code)).toBe(filled);
    }
    expect(planErrorMessage("FILL_DEADLINE_PASSED")).toMatch(/fill-by time has passed/);
    expect(planErrorMessage("INTAKE_PAUSED")).toMatch(/paused/);
    expect(planErrorMessage("VERSION_CONFLICT")).toMatch(/reloaded/);
  });

  it("uses a generic retry line for idempotency conflicts and unknown codes", () => {
    expect(planErrorMessage("IDEMPOTENCY_CONFLICT")).toBe("That did not go through. Please try again.");
    expect(planErrorMessage("SOMETHING_NEW")).toBe("That did not go through. Please try again.");
    expect(planErrorMessage(undefined)).toBe("That did not go through. Please try again.");
  });
});

describe("fieldErrorsFrom", () => {
  it("takes the first message per field", () => {
    expect(fieldErrorsFrom({ field_errors: { club_name: ["Use 1 to 120 characters."], places: "No" } })).toEqual({
      club_name: "Use 1 to 120 characters.",
      places: "No",
    });
    expect(fieldErrorsFrom(undefined)).toEqual({});
  });
});

describe("commitGate", () => {
  it("opens for an approved club on a session that still takes commitments", () => {
    expect(commitGate(view(), NOW)).toEqual({ open: true });
  });

  it("closes with the filled message when the minimum is reached or the places no longer fit", () => {
    const filled = "This session has filled before you committed. Your details are kept — ask the venue about another session.";
    expect(commitGate(view({ committed_places: 16, intake_open: false }), NOW)).toEqual({ open: false, message: filled });
    expect(commitGate(view({ committed_places: 14 }), NOW)).toEqual({ open: false, message: filled });
  });

  it("names the passed fill-by time and a venue pause separately", () => {
    const late = commitGate(view({ intake_open: false, fill_by: "2026-10-19T12:00:00+00:00" }), NOW);
    expect(late).toMatchObject({ open: false });
    expect(late.open ? "" : late.message).toMatch(/fill-by time has passed/);
    const paused = commitGate(view({ intake_open: false }), NOW);
    expect(paused.open ? "" : paused.message).toMatch(/paused/);
  });
});

describe("requestClosedMessage", () => {
  const open = { phase: "published", intake_open: true, fill_by: "2026-11-04T12:00:00+00:00", committed_places: 3, minimum: 16 } as const;
  it("is null while intake is open and explains each way it closes", () => {
    expect(requestClosedMessage(open, NOW)).toBeNull();
    expect(requestClosedMessage({ ...open, intake_open: false, committed_places: 16 }, NOW)).toMatch(/reached its minimum/);
    expect(requestClosedMessage({ ...open, intake_open: false }, NOW)).toMatch(/paused/);
    expect(requestClosedMessage({ ...open, intake_open: false, fill_by: "2026-10-01T12:00:00+00:00" }, NOW)).toMatch(/fill-by/);
    expect(requestClosedMessage({ ...open, intake_open: false, phase: "closed" }, NOW)).toMatch(/not taking/);
  });
});

describe("copied texts", () => {
  it("builds a conditional club update without the organiser email or another club's data", () => {
    const text = conditionalClubUpdate(
      view({ committed_places: 12 }, { allocation: { ...committed.allocation!, status: "live" }, status: "waiting_for_more_places" }),
    );
    expect(text).toContain("Club A: conditional plan for Printmaking at Edinburgh Print Studio");
    expect(text).toContain("7 places are conditionally committed");
    expect(text).toContain("4 more needed");
    expect(text).toContain("Wednesday 4 November at 12:00 London");
    expect(text).toContain("No deposit is due yet.");
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/confirmed/i);
  });

  it("builds practical details with the booking reference and the venue's public contact only", () => {
    const text = practicalDetails({ ...committed, booking: { booking_ref: "SL1042" }, status: "confirmed" });
    expect(text).toContain("Booking SL1042");
    expect(text).toContain("Meet at: Main reception");
    expect(text).toContain("Venue email: hello@venue.example");
    expect(text).toContain("Thursday 19 November · 18:00 to 20:00");
  });

  it("builds treasurer instructions with the outstanding deposit, deadline, reference and later balance", () => {
    const text = treasurerInstructions(committed, new Date("2026-11-13T12:00:00Z"));
    expect(text).toContain("Amount: GBP 61.25");
    expect(text).toContain("Pay Edinburgh Print Studio directly.");
    expect(text).toContain("Tuesday 10 November at 12:00 London");
    expect(text).toContain("Payment reference: PL1042");
    expect(text).toContain("Payment details: Sort code 00-00-00, account 00000000");
    expect(text).toContain("later balance is GBP 183.75");
    expect(text).not.toMatch(/@/);
  });
});

describe("deposit helpers", () => {
  it("subtracts a verified deposit and formats pence for an input", () => {
    expect(depositOutstanding(committed)).toBe(6125);
    expect(depositOutstanding({ ...committed, payment: { ...committed.payment, verified_deposit_minor: 6125 } })).toBe(0);
    expect(poundsInput(6125)).toBe("61.25");
    expect(poundsInput(500)).toBe("5.00");
  });
});

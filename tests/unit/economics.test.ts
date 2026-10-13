import { describe, expect, it } from "vitest";
import { quotedEconomics, requiredSeats } from "@/lib/domain/economics";
import { formatGbp, parsePounds } from "@/lib/domain/money";
import { syntheticOffer, SYNTHETIC_EXPECTED } from "@/lib/demo/synthetic-fixture";
import type { Quote } from "@/lib/domain/types";

const quote = syntheticOffer().quote;

describe("quote economics (D13)", () => {
  it("finds the first self-funding seat count for the fixture", () => {
    expect(requiredSeats(quote, 30)).toBe(SYNTHETIC_EXPECTED.required_seats);
  });

  it("reports the fixture's quoted totals at planned attendance", () => {
    const e = quotedEconomics(quote, SYNTHETIC_EXPECTED.planned_seats);
    expect(e.revenue_pence).toBe(SYNTHETIC_EXPECTED.quoted_revenue_pence);
    expect(e.total_cost_pence).toBe(SYNTHETIC_EXPECTED.quoted_total_cost_pence);
    expect(e.surplus_pence).toBe(SYNTHETIC_EXPECTED.quoted_surplus_pence);
  });

  it("returns null when the ticket can never cover the cost", () => {
    expect(requiredSeats({ ...quote, ticket_pence: 700 }, 30)).toBeNull();
  });

  it("returns null when capacity is below the venue minimum", () => {
    expect(requiredSeats(quote, quote.venue_min_seats - 1)).toBeNull();
  });

  it("treats a zero-cost session as feasible at the venue minimum", () => {
    const free: Quote = {
      ...quote,
      fixed_pence: 0,
      variable_pence: 0,
      minimum_venue_charge_pence: 0,
      platform_fee_pence: 0,
      ticket_pence: 0,
      venue_min_seats: 2,
    };
    expect(requiredSeats(free, 30)).toBe(2);
  });

  it("applies the minimum venue charge when it exceeds the per-seat cost", () => {
    const q = { ...quote, fixed_pence: 0, variable_pence: 100, minimum_venue_charge_pence: 5000 };
    expect(quotedEconomics(q, 10).venue_charge_pence).toBe(5000);
    expect(quotedEconomics(q, 60).venue_charge_pence).toBe(6000);
  });

  it("rejects fractional or negative money", () => {
    expect(() => requiredSeats({ ...quote, ticket_pence: 19.5 }, 30)).toThrow(RangeError);
    expect(() => requiredSeats({ ...quote, fixed_pence: -1 }, 30)).toThrow(RangeError);
  });
});

describe("money helpers", () => {
  it("formats pence as GBP", () => {
    expect(formatGbp(2000)).toBe("£20.00");
  });

  it("parses whole pennies and rejects invalid input", () => {
    expect(parsePounds("12.5")).toBe(1250);
    expect(parsePounds("£3.07")).toBe(307);
    expect(parsePounds("-1")).toBeNull();
    expect(parsePounds("1.234")).toBeNull();
    expect(parsePounds("abc")).toBeNull();
  });
});

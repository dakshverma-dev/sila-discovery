import { assertPence } from "./money";
import type { Pence, Quote } from "./types";

export interface QuotedEconomics {
  seats: number;
  revenue_pence: Pence;
  venue_charge_pence: Pence;
  total_cost_pence: Pence;
  surplus_pence: number;
}

function validateQuote(quote: Quote): void {
  assertPence(quote.fixed_pence, "fixed_pence");
  assertPence(quote.variable_pence, "variable_pence");
  assertPence(quote.platform_fee_pence, "platform_fee_pence");
  assertPence(quote.ticket_pence, "ticket_pence");
  assertPence(quote.minimum_venue_charge_pence, "minimum_venue_charge_pence");
  if (!Number.isSafeInteger(quote.venue_min_seats) || quote.venue_min_seats < 1) {
    throw new RangeError("venue_min_seats must be a positive integer");
  }
  if (quote.currency !== "GBP") throw new RangeError("Only GBP quotes are supported");
}

/** All-in quoted economics for N seats (D13). Indicative only; nothing is collected. */
export function quotedEconomics(quote: Quote, seats: number): QuotedEconomics {
  validateQuote(quote);
  const venueCharge = Math.max(
    quote.fixed_pence + quote.variable_pence * seats,
    quote.minimum_venue_charge_pence,
  );
  const totalCost = venueCharge + quote.platform_fee_pence * seats;
  const revenue = quote.ticket_pence * seats;
  return {
    seats,
    revenue_pence: revenue,
    venue_charge_pence: venueCharge,
    total_cost_pence: totalCost,
    surplus_pence: revenue - totalCost,
  };
}

/**
 * First seat count from venue_min_seats through capacity at which quoted ticket
 * revenue covers the all-in cost. Null means the quote is infeasible for this slot.
 */
export function requiredSeats(quote: Quote, capacity: number): number | null {
  validateQuote(quote);
  for (let n = quote.venue_min_seats; n <= capacity; n++) {
    if (quotedEconomics(quote, n).surplus_pence >= 0) return n;
  }
  return null;
}

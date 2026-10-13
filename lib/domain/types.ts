/** Shared domain types. Money is always integer GBP pence (BR02). */

export type Pence = number;

export const PAYMENT_STATUS = "NOT_COLLECTED" as const;
export type PaymentStatus = typeof PAYMENT_STATUS;

export type SourceMode = "live" | "cached" | "synthetic" | "unavailable";

export type ProposalState =
  | "DRAFT"
  | "OPEN"
  | "READY"
  | "CONFIRMED"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

export type SharingChoice = "WILLING_TO_SHARE" | "PRIVATE_ONLY" | "ASK_FIRST";

/** Exact UTC interval, ISO-8601 with offset. */
export interface TimeWindow {
  start_at: string;
  end_at: string;
}

export interface Quote {
  id: string;
  version: number;
  fixed_pence: Pence;
  variable_pence: Pence;
  platform_fee_pence: Pence;
  ticket_pence: Pence;
  minimum_venue_charge_pence: Pence;
  venue_min_seats: number;
  currency: "GBP";
}

export interface Slot extends TimeWindow {
  id: string;
  experience_id: string;
  capacity: number;
}

export interface Experience {
  id: string;
  title: string;
  approved: boolean;
  access_support: readonly string[];
  /** Venue-reviewed book-domain anchor entity IDs (1 to 3). */
  anchor_entity_ids: readonly string[];
}

/** A frozen group brief snapshot as seen by the solver. */
export interface GroupBrief {
  group_id: string;
  expected_seats: number;
  budget_pence: Pence;
  sharing: SharingChoice;
  access_requirements: readonly string[];
  availability: readonly TimeWindow[];
}

/** One catalogue offer: an approved experience with its current quote and slots. */
export interface Offer {
  experience: Experience;
  quote: Quote;
  slots: readonly Slot[];
}

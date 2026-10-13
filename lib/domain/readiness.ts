/** Readiness predicate from D14. Evaluated with database time in the real transaction. */

export interface ReadinessInput {
  /** One entry per included group: true only if it accepted the current version. */
  organiser_acceptances: readonly boolean[];
  /** Individual active reservations; organiser headcount estimates never count (BR10). */
  active_seats: number;
  required_seats: number;
  capacity: number;
  now: Date;
  reservation_deadline: Date;
  quote_is_current: boolean;
  slot_held_by_proposal: boolean;
}

export type ReadinessBlocker =
  | "NO_INCLUDED_GROUPS"
  | "ORGANISER_ACCEPTANCE_MISSING"
  | "SEATS_BELOW_REQUIRED"
  | "SEATS_EXCEED_CAPACITY"
  | "DEADLINE_PASSED"
  | "QUOTE_NOT_CURRENT"
  | "SLOT_NOT_HELD";

export function readiness(input: ReadinessInput): { ready: boolean; blockers: ReadinessBlocker[] } {
  const blockers: ReadinessBlocker[] = [];
  if (input.organiser_acceptances.length === 0) blockers.push("NO_INCLUDED_GROUPS");
  else if (!input.organiser_acceptances.every(Boolean)) blockers.push("ORGANISER_ACCEPTANCE_MISSING");
  if (input.active_seats < input.required_seats) blockers.push("SEATS_BELOW_REQUIRED");
  if (input.active_seats > input.capacity) blockers.push("SEATS_EXCEED_CAPACITY");
  if (input.now.getTime() >= input.reservation_deadline.getTime()) blockers.push("DEADLINE_PASSED");
  if (!input.quote_is_current) blockers.push("QUOTE_NOT_CURRENT");
  if (!input.slot_held_by_proposal) blockers.push("SLOT_NOT_HELD");
  return { ready: blockers.length === 0, blockers };
}

import type { ProposalState } from "./types";

/**
 * Allowed proposal transitions (D14 state machine). Guards such as deadlines,
 * capacity and authority are enforced by the database transaction; this table
 * only rejects transitions that are never valid.
 */
const TRANSITIONS: Readonly<Record<ProposalState, readonly ProposalState[]>> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["READY", "EXPIRED", "CANCELLED"],
  READY: ["OPEN", "CONFIRMED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["CANCELLED", "COMPLETED"],
  COMPLETED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canTransition(from: ProposalState, to: ProposalState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** States in which a proposal holds its slot (BR08). */
export function holdsSlot(state: ProposalState): boolean {
  return state === "OPEN" || state === "READY" || state === "CONFIRMED";
}

export function isTerminal(state: ProposalState): boolean {
  return TRANSITIONS[state].length === 0;
}

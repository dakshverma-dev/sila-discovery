import type { Experience, GroupBrief, Quote, Slot, TimeWindow } from "./types";

/** Per-group hard-constraint failures for one slot (BR03 to BR06). */
export type GroupBlocker =
  | "SHARING_NOT_CONSENTED"
  | "BUDGET_BELOW_PRICE"
  | "TIME_UNAVAILABLE"
  | "ACCESS_UNSUPPORTED";

function toMillis(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid timestamp: ${iso}`);
  return ms;
}

export function assertValidWindow(window: TimeWindow): void {
  if (toMillis(window.start_at) >= toMillis(window.end_at)) {
    throw new RangeError("start_at must be before end_at");
  }
}

/** True when one exact availability window fully contains the slot (BR04). */
export function coversSlot(availability: readonly TimeWindow[], slot: TimeWindow): boolean {
  const start = toMillis(slot.start_at);
  const end = toMillis(slot.end_at);
  return availability.some(
    (w) => toMillis(w.start_at) <= start && toMillis(w.end_at) >= end,
  );
}

export function groupBlockers(
  group: GroupBrief,
  experience: Experience,
  quote: Quote,
  slot: Slot,
): GroupBlocker[] {
  const blockers: GroupBlocker[] = [];
  // Only an explicit "willing to share" is solver-eligible (D17); "ask first" is not consent.
  if (group.sharing !== "WILLING_TO_SHARE") blockers.push("SHARING_NOT_CONSENTED");
  if (group.budget_pence < quote.ticket_pence) blockers.push("BUDGET_BELOW_PRICE");
  if (!coversSlot(group.availability, slot)) blockers.push("TIME_UNAVAILABLE");
  // Unknown support is blocked: every declared requirement must be explicitly supported.
  const supported = new Set(experience.access_support);
  if (!group.access_requirements.every((r) => supported.has(r))) {
    blockers.push("ACCESS_UNSUPPORTED");
  }
  return blockers;
}

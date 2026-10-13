import type { GroupBlocker } from "@/lib/domain/feasibility";
import type { SlotBlocker } from "@/lib/domain/solver";
import type { SourceMode } from "@/lib/domain/types";
import type { UnknownReason } from "@/lib/domain/utility";

/** Product microcopy from D17. Wording must never imply payment or a guaranteed ticket. */
export const COPY = {
  reserveAction: "Reserve one seat",
  paymentBoundary:
    "No payment is collected here. Your reservation records your intention to attend at the displayed price.",
  ready: "Enough seats are reserved. The venue still needs to confirm.",
  confirmed: "The venue has approved this reservation booking. Payment has not been collected.",
  qlooOutage:
    "Cultural suggestions are unavailable. You can review the venue catalogue or try again later.",
  unknownAccess:
    "The venue needs to confirm this requirement before we can suggest the session.",
  demoBanner: "Judge sandbox. Venues, groups and bookings are illustrative.",
} as const;

export const GROUP_BLOCKER_COPY: Record<GroupBlocker, string> = {
  SHARING_NOT_CONSENTED: "Has not chosen to share a session with other groups.",
  BUDGET_BELOW_PRICE: "The all-in ticket price is above this group's per-person maximum.",
  TIME_UNAVAILABLE: "None of this group's available times covers the whole session.",
  ACCESS_UNSUPPORTED: COPY.unknownAccess,
};

export const SLOT_BLOCKER_COPY: Record<SlotBlocker, string> = {
  EXPERIENCE_NOT_APPROVED: "The programme has not been approved by the venue.",
  QUOTE_INFEASIBLE: "The quoted ticket price cannot cover the venue's costs within capacity.",
  TOO_FEW_ELIGIBLE_GROUPS: "Fewer than two groups meet every requirement for this session.",
  SEATS_BELOW_REQUIRED: "No eligible combination of groups expects enough attendees.",
  CAPACITY_NEEDS_CLARIFICATION:
    "Some combinations exceed capacity. Organisers would need to confirm smaller attendance.",
};

export const UNKNOWN_REASON_COPY: Record<UnknownReason, string> = {
  EMPTY_RESULT: "No cultural evidence was returned for this group.",
  DUPLICATE_RESULT: "The evidence contained duplicates and needs review.",
  UNIVERSE_TOO_SMALL: "Too few anchors to compare.",
  INCOMPLETE_UNIVERSE: "Evidence did not cover every anchor, so the fit is unknown.",
  UNEXPECTED_ENTITY: "Evidence referenced an unapproved anchor and needs review.",
  NO_EXPERIENCE_ANCHORS: "This programme has no approved cultural anchors.",
};

export const SOURCE_MODE_COPY: Record<SourceMode, string> = {
  live: "Live Qloo evidence",
  cached: "Cached Qloo evidence",
  synthetic: "Synthetic evidence (illustrative, not from Qloo)",
  unavailable: "Cultural evidence unavailable",
};

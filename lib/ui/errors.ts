/** User-facing messages for application error codes (D16, D20). */
export const ERROR_COPY: Record<string, string> = {
  VALIDATION_FAILED: "Some details need attention. Check the form and try again.",
  AUTH_REQUIRED: "Your sandbox session has ended. Start a new one to continue.",
  FORBIDDEN: "This persona cannot take that action.",
  NOT_FOUND: "That item is not available to this persona.",
  VERSION_CONFLICT: "The proposal terms have changed. Review the latest version before acting.",
  CAPACITY_EXCEEDED: "No seat was reserved: the session is already full.",
  NOT_READY: "This step is not available yet. Check the readiness list below.",
  IDEMPOTENCY_CONFLICT: "That request was already used for something else. Reload the page and try again.",
  PROPOSAL_EXPIRED: "The reservation deadline has passed, so no change was made.",
  PROPOSAL_CLOSED: "This proposal is no longer open for that action.",
  ALREADY_RESERVED: "You already hold a seat for this session.",
  SLOT_UNAVAILABLE: "Another proposal already holds this session.",
  NEEDS_INPUT: "The group brief is missing required details.",
  NO_FEASIBLE_COALITION: "No shared session meets every group's requirements.",
  RATE_LIMITED: "Please wait a moment before trying again.",
  QLOO_UNAVAILABLE: "Cultural suggestions are unavailable. You can review the venue catalogue or try again later.",
  PROVIDER_SCHEMA_CHANGED: "Cultural suggestions are unavailable while we check a provider change.",
  JOB_DEADLINE_EXCEEDED: "Finding suggestions took too long. Try again.",
  SANDBOX_EXPIRED: "That sandbox has expired or was not found. Start a new one.",
  DATABASE_UNAVAILABLE: "The service is temporarily unavailable. Nothing was changed; please try again.",
};

export const NOTICE_COPY: Record<string, string> = {
  SANDBOX_STARTED: "Your private judge sandbox is ready. Everything in it is fictional and expires within 24 hours.",
  PERSONA_SWITCHED: "You are now acting as a different persona.",
  REVIEW_REQUESTED: "Sent to the venue for review. Nothing is published until the venue manager publishes it.",
  PUBLISHED: "Published. Organisers can now accept these exact terms.",
  REVISED: "Revised terms published. Earlier decisions and seats no longer apply; everyone must act again.",
  ACCEPTED: "Your group accepted the current terms. This does not reserve any seats.",
  DECLINED: "Your group declined the current terms.",
  RESERVED: "One seat reserved. No payment is collected here.",
  WITHDRAWN: "Your seat has been released.",
  CONFIRMED: "The venue has approved this reservation booking. Payment has not been collected.",
  CANCELLED: "The proposal was cancelled and the reason recorded.",
  COMPLETED: "Delivery recorded.",
  BRIEF_SAVED: "Saved as a new brief version. Earlier suggestions keep the version they were based on.",
  REFERENCE_RESOLVED: "Reference linked to the selected Qloo entity.",
  SIMULATED: "Simulated actions ran for the fictional personas through the same guarded rules.",
};

export function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return ERROR_COPY[code] ?? "Something went wrong. Nothing was changed; please try again.";
}

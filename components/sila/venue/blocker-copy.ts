import type { PublicationBlocker } from "@/lib/sila/session";
import type { ConfirmationBlocker } from "@/lib/sila/confirmation";

export const PUBLICATION_COPY: Record<PublicationBlocker, string> = {
  TITLE_LENGTH: "Use an activity title of 3 to 100 characters.",
  END_NOT_AFTER_START: "The session must end after it starts.",
  DURATION_OUT_OF_RANGE: "The activity must last 30 to 480 minutes.",
  PRICE_NOT_POSITIVE: "Enter a positive, all-in price per person.",
  MINIMUM_NOT_POSITIVE: "Enter a positive headcount minimum.",
  MINIMUM_ABOVE_CAPACITY: "The minimum cannot exceed capacity.",
  CLUB_LIMIT_OUT_OF_RANGE: "Allow one or two clubs.",
  DEPOSIT_OUT_OF_RANGE: "Choose a deposit above 0% and at most 100%.",
  PAYMENT_WINDOW_TOO_SHORT: "Allow at least five calendar days for payment.",
  DECISION_NOT_BUSINESS_NOON: "Set the final decision to business-day noon in London.",
  FINAL_NOTICE_TOO_SHORT: "Allow at least seven calendar days between the final decision and event.",
  FILL_BY_NOT_BUSINESS_NOON: "Set fill-by to business-day noon in London.",
  FILL_BY_TOO_LATE: "Move fill-by earlier to allow the staffed release, payment window and verification.",
  BALANCE_NOT_AFTER_DECISION: "Set the balance deadline after the final decision.",
  BALANCE_REMEDY_TOO_LATE: "Move the balance deadline earlier to allow notice, payment remedy and verification before the event.",
  RESOURCE_HOLD_MISSING: "Name the resource, who checked it and its hold expiry.",
  RESOURCE_HOLD_TOO_SHORT: "Hold the resource through the final decision.",
  COVERAGE_MISSING: "Approve staffed coverage for opening and each operational deadline.",
  VENUE_TERMS_MISSING: "Add reviewed, versioned venue terms.",
  PLATFORM_TERMS_MISSING: "Add the approved platform terms version.",
  ACCESS_FACTS_UNREVIEWED: "Review the venue terms and public access facts.",
  RUN_AT_MINIMUM_UNAPPROVED: "The venue must approve running at the minimum without public top-ups.",
};
export const CONFIRMATION_COPY: Record<ConfirmationBlocker, string> = {
  PAYMENT_NOT_OPENED: "Payment has not opened.",
  MINIMUM_NOT_MET: "Current commitments no longer reach the minimum.",
  DEPOSIT_NOT_VERIFIED: "A club's required deposit is not yet verified.",
  RESOURCE_HOLD_EXPIRED: "The resource hold has expired. Arrange a current venue check.",
  DIARY_NOT_CHECKED: "Check the external venue diary before confirming.",
  DECISION_DEADLINE_PASSED: "The final decision deadline has passed. Resolve with the venue.",
};

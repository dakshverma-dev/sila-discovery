import type { MyPlanView } from "@/lib/sila/commands/plans";
import type { PublicSession } from "@/lib/sila/commands/sessions";
import { formatLondon, formatLondonDay, formatLondonRange } from "@/lib/sila/forms";
import { formatGBP } from "@/lib/sila/money";

/**
 * Plain-language copy for the organiser screens: error messages, the commit
 * gate and the text behind the "Copy ..." buttons. Pure, so it can be tested
 * without a browser. Nothing here reads another club's data: the copied texts
 * are built from this plan, the public session and the venue's public facts.
 */

const FILLED = "This session has filled. Your details are kept — ask the venue about another session.";

const ERROR_COPY: Record<string, string> = {
  STALE_TERMS: "The session's terms changed. Review the new terms before committing.",
  MINIMUM_ALREADY_REACHED: FILLED,
  CLUB_LIMIT_REACHED: FILLED,
  CAPACITY_EXCEEDED: FILLED,
  SECOND_CLUB_BELOW_MINIMUM:
    "The last club's places must bring the session to its minimum. Ask the venue about a different quantity.",
  FILL_DEADLINE_PASSED: "The fill-by time has passed. Your details are kept — ask the venue about another session.",
  INTAKE_PAUSED: "The venue has paused new requests and commitments for now. Your details are kept.",
  SESSION_NOT_OPEN: "This session is not taking requests or commitments.",
  WAIT_EXCEEDS_LIMIT:
    "The final decision is more than 21 days away, which is longer than the maximum wait. Ask the venue about another session.",
  QUANTITY_NOT_APPROVED: "Commit exactly the number of places the venue approved. Ask for a different quantity instead.",
  NOT_APPROVED: "The venue has not approved places for your club yet.",
  ALREADY_COMMITTED: "Your club has already committed its places.",
  NOT_COMMITTED: "Your club has no committed places to withdraw.",
  PAYMENT_NOT_OPEN: "Payment has not opened for this session yet.",
  VERSION_CONFLICT: "This plan changed while you were looking at it. The page has been reloaded; check it and try again.",
  IDEMPOTENCY_CONFLICT: "That did not go through. Please try again.",
  INVALID_FIELDS: "Check the highlighted fields.",
  NOT_FOUND: "We could not find that.",
  AUTH_REQUIRED: "Sign in to continue.",
};

/** The inline message for a rejected command; unknown codes get a safe generic line. */
export function planErrorMessage(code: string | null | undefined): string {
  return (code && ERROR_COPY[code]) || "That did not go through. Please try again.";
}

/** First message per field from a rejection's `details.field_errors`. */
export function fieldErrorsFrom(details: Record<string, unknown> | undefined): Record<string, string> {
  const raw = details?.field_errors;
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [field, messages] of Object.entries(raw as Record<string, unknown>)) {
      const first = Array.isArray(messages) ? messages[0] : messages;
      if (typeof first === "string") out[field] = first;
    }
  }
  return out;
}

// ------------------------------------------------------------------ commit gate

export type CommitGate = { open: true } | { open: false; message: string };

/**
 * Whether an approved club may still be offered the commit button. The
 * database repeats the real checks under row locks; this stops an old plan
 * page from inviting a commitment the session can no longer take (§05).
 */
export function commitGate(view: MyPlanView, now: Date): CommitGate {
  const s = view.session;
  const approved = view.approval?.approved_places ?? 0;
  if (s.committed_places >= s.minimum || s.committed_places + approved > s.capacity) {
    return { open: false, message: "This session has filled before you committed. Your details are kept — ask the venue about another session." };
  }
  if (now.getTime() > new Date(s.fill_by).getTime()) return { open: false, message: ERROR_COPY.FILL_DEADLINE_PASSED! };
  if (!s.intake_open) {
    return { open: false, message: "The venue has paused new commitments for now. Your details are kept — ask the venue." };
  }
  return { open: true };
}

/** Why a public session is not taking new requests, or null while it is. */
export function requestClosedMessage(
  s: Pick<PublicSession, "phase" | "intake_open" | "fill_by" | "committed_places" | "minimum">,
  now: Date,
): string | null {
  if (s.intake_open) return null;
  if (s.phase !== "published") return ERROR_COPY.SESSION_NOT_OPEN!;
  if (now.getTime() > new Date(s.fill_by).getTime()) return ERROR_COPY.FILL_DEADLINE_PASSED!;
  if (s.committed_places >= s.minimum) return "This session has reached its minimum, so it is no longer taking requests.";
  return "The venue has paused new requests for now.";
}

// ------------------------------------------------------------------ small facts

/** A stored timestamp as "Wednesday 4 November at 12:00 London". */
export function london(iso: string): string {
  return formatLondon(new Date(iso));
}

/** Pence as a plain pounds string for an input, e.g. 6125 -> "61.25". */
export function poundsInput(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

export function placesStillNeeded(view: MyPlanView): number {
  return Math.max(view.session.minimum - view.session.committed_places, 0);
}

export function sessionWhen(view: MyPlanView): string {
  const s = view.session;
  return `${formatLondonDay(new Date(s.starts_at))} · ${formatLondonRange(new Date(s.starts_at), new Date(s.ends_at))}`;
}

/** What the club still owes of its deposit: the deposit less anything the venue has verified. */
export function depositOutstanding(view: MyPlanView): number {
  const deposit = view.allocation?.deposit_minor ?? 0;
  return Math.max(deposit - (view.payment.verified_deposit_minor ?? 0), 0);
}

// ------------------------------------------------------------------ copy buttons

/** For the organiser to forward to their members while the session is still conditional. */
export function conditionalClubUpdate(view: MyPlanView): string {
  const s = view.session;
  const places = view.allocation?.places ?? view.plan.requested_places;
  const needed = placesStillNeeded(view);
  return [
    `${view.plan.club_name}: conditional plan for ${s.title} at ${s.venue.name}`,
    sessionWhen(view),
    "",
    `${places} places are conditionally committed. Nothing is final: the session goes ahead only if it reaches ${s.minimum} places by ${formatLondon(new Date(s.fill_by))}.`,
    `Places so far: ${s.committed_places} of ${s.minimum} needed${needed > 0 ? ` (${needed} more needed)` : ""}. Maximum ${s.capacity}.`,
    `Final decision: ${formatLondon(new Date(s.decision_by))}.`,
    "",
    "No deposit is due yet. If the minimum is reached, payment opens at the next eligible midday and there are at least five calendar days to pay.",
  ].join("\n");
}

/** Booking details for members once the venue has confirmed. */
export function practicalDetails(view: MyPlanView): string {
  const s = view.session;
  const lines = [
    `${s.title} at ${s.venue.name}`,
    view.booking ? `Booking ${view.booking.booking_ref}` : null,
    sessionWhen(view),
    `${view.allocation?.places ?? view.plan.requested_places} places for ${view.plan.club_name}`,
    "",
    s.meeting_point ? `Meet at: ${s.meeting_point}` : null,
    `Address: ${s.venue.address}`,
    s.venue.access_facts ? `Access: ${s.venue.access_facts}` : null,
    s.venue.contact_phone ? `Venue phone: ${s.venue.contact_phone}` : null,
    s.venue.contact_email ? `Venue email: ${s.venue.contact_email}` : null,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

/** Everything a treasurer needs to pay the deposit. */
export function treasurerInstructions(view: MyPlanView, balanceDueAt: Date): string {
  const s = view.session;
  const a = view.allocation;
  const p = view.payment;
  const lines = [
    `Deposit for ${view.plan.club_name}: ${s.title}, ${sessionWhen(view)}`,
    `Pay ${s.venue.name} directly.`,
    `Amount: ${formatGBP(depositOutstanding(view))}`,
    p.pay_by ? `Pay by: ${formatLondon(new Date(p.pay_by))}. Bank transfer must reach the venue by then.` : null,
    `Payment reference: ${view.plan.plan_ref}`,
    p.payment_route ? `Payment details: ${p.payment_route}` : null,
    a
      ? `The later balance is ${formatGBP(a.balance_minor)}, due ${formatLondon(balanceDueAt)}.`
      : null,
    "After paying, the organiser reports the payment in Sila so the venue can check it.",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

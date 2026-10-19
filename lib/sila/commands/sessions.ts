import type { ApiResult } from "@/lib/db/api";
import type { SilaActor } from "@/lib/sila/auth";
import { scottishVenueCalendar } from "@/lib/sila/calendar";
import type { AllocationStatus } from "@/lib/sila/commands/plans";
import type { PaymentReport } from "@/lib/sila/commands/receipts";
import type { ObligationKind } from "@/lib/sila/confirmation";
import { callSila } from "@/lib/sila/db";
import { toSessionDraft, type SessionDraftPatch, type SessionPhase, type VenueSessionRow } from "@/lib/sila/forms";
import { checkPublication } from "@/lib/sila/session";
import type { LocalDate } from "@/lib/sila/time";

/** Server commands for dated sessions; shared by /api/v1/sila routes and venue pages. */

export interface SavedSession {
  session_id: string;
  version: number;
}

export interface VenueSessionView {
  refunds?: import("./refunds").AllocationRefund[];
  session: VenueSessionRow;
  venue: {
    id: string;
    name: string;
    address: string;
    time_zone: string;
    access_facts: string;
    contact_email: string | null;
    contact_phone: string | null;
  };
  /** Live venue memberships and the operator role only when scoped to this venue. */
  roles: ("coordinator" | "finance" | "operator")[];
  /** Every allocation on the session, live first, with its reports, ledger and verified totals. */
  allocations: VenueAllocation[];
  booking: { booking_id: string; booking_ref: string; confirmed_at: string; diary_checked_at: string } | null;
}

export interface LedgerEntry {
  entry_id: string;
  entry_type: "receipt" | "correction";
  kind: ObligationKind;
  /** GBP minor units; a correction may be negative. */
  amount_minor: number;
  currency: "GBP";
  receipt_id: string | null;
  received_at: string | null;
  verified_at: string;
  evidence: string | null;
  corrects_entry_id: string | null;
  /** received_at <= pay_by; null for a correction. */
  timely: boolean | null;
}

export interface VenueAllocation {
  allocation_id: string;
  plan_id: string;
  plan_ref: string;
  club_name: string;
  places: number;
  status: AllocationStatus;
  committed_at: string;
  total_minor: number;
  deposit_minor: number;
  balance_minor: number;
  verified_deposit_minor: number;
  verified_balance_minor: number;
  reports: PaymentReport[];
  receipts: LedgerEntry[];
}

export interface VenueSessionSummary {
  id: string;
  version: number;
  phase: SessionPhase;
  title: string;
  starts_at: string;
  ends_at: string;
  fill_by: string;
  decision_by: string;
  price_minor: number;
  minimum: number;
  capacity: number;
  intake_paused: boolean;
  published_at: string | null;
}

export interface PublishedSession {
  session_id: string;
  version: number;
  published_at: string;
}

export interface PublicSession {
  id: string;
  title: string;
  description: string | null;
  inclusions: string | null;
  meeting_point: string | null;
  starts_at: string;
  ends_at: string;
  price_minor: number;
  minimum: number;
  capacity: number;
  max_clubs: number;
  deposit_bp: number;
  fill_by: string;
  decision_by: string;
  phase: Extract<SessionPhase, "published" | "closed" | "confirmed">;
  intake_open: boolean;
  committed_places: number;
  venue: {
    name: string;
    address: string;
    access_facts: string;
    contact_email: string | null;
    contact_phone: string | null;
  };
}

export interface IntakeState {
  session_id: string;
  version: number;
  intake_paused: boolean;
}

export interface SaveSessionDraftInput {
  venueId: string;
  /** Null creates a new draft. */
  sessionId: string | null;
  /** Required when `sessionId` is set. */
  expectedVersion: number | null;
  draft: SessionDraftPatch;
}

export function saveSessionDraft(actor: SilaActor, key: string, input: SaveSessionDraftInput) {
  return callSila<SavedSession>("save_session_draft", [
    actor.personId,
    key,
    input.venueId,
    input.sessionId,
    input.expectedVersion,
    input.draft,
  ]);
}

export function getVenueSession(actor: SilaActor, sessionId: string) {
  return callSila<VenueSessionView>("get_venue_session", [actor.personId, sessionId]);
}

export function listVenueSessions(actor: SilaActor, venueId: string) {
  return callSila<{ sessions: VenueSessionSummary[] }>("list_venue_sessions", [actor.personId, venueId]);
}

export function getPublicSession(sessionId: string) {
  return callSila<PublicSession>("get_public_session", [sessionId]);
}

/**
 * Runs the full publication gates (§04, §13, §23) against the stored draft and
 * publishes only when there are no blockers; the database repeats the checks
 * it can under the row lock. Non-coordinators, already-published sessions and
 * stale versions go straight to the database, which returns NOT_FOUND,
 * NOT_DRAFT, VERSION_CONFLICT or the replayed original result.
 */
export async function publishSession(
  actor: SilaActor,
  key: string,
  sessionId: string,
  expectedVersion: number,
): Promise<ApiResult<PublishedSession>> {
  const loaded = await getVenueSession(actor, sessionId);
  if (!loaded.ok) return loaded;
  const { session, roles } = loaded.data;
  const cal = scottishVenueCalendar();

  if (roles.includes("coordinator") && session.phase === "draft" && session.version === expectedVersion) {
    const check = checkPublication(toSessionDraft(session), cal);
    if (check.blockers.length > 0) {
      return {
        ok: false,
        error: {
          code: "NOT_READY",
          message: "This session cannot be published yet.",
          retryable: false,
          details: {
            blockers: check.blockers,
            latest_fill_by: check.latestFillBy?.toISOString() ?? null,
            required_coverage: check.requiredCoverage satisfies LocalDate[],
          },
        },
      };
    }
  }
  return callSila<PublishedSession>("publish_session", [actor.personId, key, sessionId, expectedVersion, cal.version]);
}

export function setIntake(
  actor: SilaActor,
  key: string,
  sessionId: string,
  paused: boolean,
  reason: string | null,
  expectedVersion: number,
) {
  return callSila<IntakeState>("set_session_intake", [actor.personId, key, sessionId, paused, reason, expectedVersion]);
}

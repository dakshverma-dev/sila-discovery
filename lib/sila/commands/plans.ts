import type { ApiResult } from "@/lib/db/api";
import type { SilaActor } from "@/lib/sila/auth";
import type { PaymentReport } from "@/lib/sila/commands/receipts";
import type { PublicSession } from "@/lib/sila/commands/sessions";
import { callSila } from "@/lib/sila/db";
import type { SessionPhase } from "@/lib/sila/forms";
import { derivePlanStatus, type PlanFacts, type PlanStatus } from "@/lib/sila/status";

/** Server commands for club requests (plans) and their conversation; shared by routes and pages. */

export type PlanSource = "venue_existing" | "sila_introduction" | "referral" | "unknown";
export const PLAN_SOURCES = ["venue_existing", "sila_introduction", "referral", "unknown"] as const satisfies
  readonly PlanSource[];

export type PlanRecordStatus = "submitted" | "declined";
export type MessageAuthorRole = "organiser" | "venue" | "operator";

export interface SubmittedPlan {
  plan_id: string;
  plan_ref: string;
}

export interface PlanMessage {
  id: string;
  author_role: MessageAuthorRole;
  body: string;
  created_at: string;
  /** True when the caller wrote this message. */
  from_me: boolean;
}

export interface MyPlanData {
  refund?: import("./refunds").AllocationRefund | null;
  plan: {
    id: string;
    plan_ref: string;
    club_name: string;
    requested_places: number;
    source: PlanSource;
    status: PlanRecordStatus;
    declined_reason: string | null;
    version: number;
  };
  /** Same shape as get_public_session; the phase may also be `cancelled` here. */
  session: Omit<PublicSession, "phase"> & { phase: SessionPhase };
  /** The agreed terms behind this plan, plus two facts the screens need; visible to its organiser in every state. */
  terms: {
    terms_version: number;
    venue_terms_version: string | null;
    venue_terms_text: string | null;
    platform_terms_version: string | null;
    balance_due_at: string;
    payment_window_days: number;
    /** This club's live allocation, for reporting a payment; null unless committed. */
    allocation_id: string | null;
    /** Places released when the session closed below its minimum (live places are then zero): an aggregate, never per club. */
    released_places: number;
  };
  messages: PlanMessage[];
  facts: PlanFacts;
  /** The venue's approval, or null before approval. */
  approval: { approved_places: number; terms_version: number } | null;
  /** The live allocation (else the latest one), or null before commitment. */
  allocation: PlanAllocation | null;
  /** This club's own payment facts; null (reports empty) unless committed. Never another club's. */
  payment: {
    scheduled_for: string | null;
    blocked_reason: string | null;
    opened_at: string | null;
    pay_by: string | null;
    verify_by: string | null;
    /** The venue's payment instructions, only once payment has opened. */
    payment_route: string | null;
    reports: PaymentReport[];
    verified_deposit_minor: number | null;
  };
  /** Set only once the venue has confirmed a booking that includes this club. */
  booking: { booking_ref: string } | null;
}

export type AllocationStatus = "live" | "withdrawn" | "released";

export interface PlanAllocation {
  places: number;
  /** GBP minor units, computed by the database (§18). */
  total_minor: number;
  deposit_minor: number;
  balance_minor: number;
  accepted_decision_by: string;
  status: AllocationStatus;
}

/** The organiser view plus the viewer-facing status derived from `facts` (§16). */
export type MyPlanView = MyPlanData & { status: PlanStatus };

export interface MyPlanSummary {
  id: string;
  plan_ref: string;
  club_name: string;
  requested_places: number;
  status: PlanRecordStatus;
  created_at: string;
  session: { id: string; title: string; starts_at: string; phase: SessionPhase };
  facts: PlanFacts;
}

export interface SessionRequest {
  id: string;
  plan_ref: string;
  club_name: string;
  requested_places: number;
  /** price_minor * requested_places, GBP minor units, computed by the database. */
  group_total_minor: number;
  source: PlanSource;
  status: PlanRecordStatus;
  declined_reason: string | null;
  version: number;
  created_at: string;
  messages: PlanMessage[];
  approval: { approved_places: number; terms_version: number; approved_at: string } | null;
  allocation: (PlanAllocation & { committed_at: string }) | null;
}

export interface SessionRequests {
  session_id: string;
  terms_version: number;
  /** Sum of live allocations; requests and approvals reserve nothing. */
  committed_places: number;
  minimum_reached_at: string | null;
  plans: SessionRequest[];
}

export interface PostedMessage {
  message_id: string;
  author_role: MessageAuthorRole;
  created_at: string;
}

export interface SubmitPlanInput {
  sessionId: string;
  clubName: string;
  places: number;
  source: PlanSource;
}

export function submitPlan(actor: SilaActor, key: string, input: SubmitPlanInput) {
  return callSila<SubmittedPlan>("submit_plan", [
    actor.personId,
    key,
    input.sessionId,
    input.clubName,
    input.places,
    input.source,
  ]);
}

export async function getMyPlan(actor: SilaActor, planId: string): Promise<ApiResult<MyPlanView>> {
  const result = await callSila<MyPlanData>("get_my_plan", [actor.personId, planId]);
  if (!result.ok) return result;
  return { ...result, data: { ...result.data, status: derivePlanStatus(result.data.facts) } };
}

/** `plan_status` is the derived viewer-facing status; `status` stays the stored record status. */
export async function listMyPlans(
  actor: SilaActor,
): Promise<ApiResult<{ plans: (MyPlanSummary & { plan_status: PlanStatus })[] }>> {
  const result = await callSila<{ plans: MyPlanSummary[] }>("list_my_plans", [actor.personId]);
  if (!result.ok) return result;
  return {
    ...result,
    data: { plans: result.data.plans.map((p) => ({ ...p, plan_status: derivePlanStatus(p.facts) })) },
  };
}

export function listSessionRequests(actor: SilaActor, sessionId: string) {
  return callSila<SessionRequests>("list_session_requests", [
    actor.personId,
    sessionId,
  ]);
}

export function postPlanMessage(actor: SilaActor, key: string, planId: string, body: string) {
  return callSila<PostedMessage>("post_plan_message", [actor.personId, key, planId, body]);
}

import type { SilaActor } from "@/lib/sila/auth";
import { callSila } from "@/lib/sila/db";

export interface AllocationRefund {
  allocation_id: string; cause: "unconfirmed" | "venue_fault"; reason: string;
  closed_at: string; target_at: string | null; venue_owner: string;
  received_minor: number; refunded_minor: number; due_minor: number;
  status: "no_payment_received" | "refund_due" | "refunded";
  entries: { id: string; amount_minor: number; reference: string; returned_at: string; verified_at: string }[];
}
export function closeSession(actor: SilaActor, key: string, sessionId: string, expectedVersion: number,
  cause: "unconfirmed" | "venue_fault", reason: string) {
  return callSila<{ session_id: string; version: number; cause: string; refund_target_at: string | null }>(
    "close_session", [actor.personId, key, sessionId, expectedVersion, cause, reason]);
}
export function recordRefund(actor: SilaActor, key: string, allocationId: string, expectedVersion: number,
  amountMinor: number, reference: string, returnedAt: Date, evidence: string) {
  return callSila<{ refund: AllocationRefund; version: number }>("record_refund",
    [actor.personId, key, allocationId, expectedVersion, amountMinor, reference, returnedAt, evidence]);
}
export function closeDecisionSessions() {
  return callSila<{ closed: number; blocked: number }>("close_decision_sessions", []);
}

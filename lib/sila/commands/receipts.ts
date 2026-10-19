import { createHash } from "node:crypto";
import type { ApiError, ApiResult } from "@/lib/db/api";
import type { SilaActor } from "@/lib/sila/auth";
import type { BlockerDetail, ConfirmationBlocker, ObligationKind } from "@/lib/sila/confirmation";
import { callSila } from "@/lib/sila/db";

/**
 * Server commands for organiser payment reports, the venue's receipt ledger
 * and venue confirmation (§17, §18, §24). A report is unverified and changes
 * no condition; only venue finance or a coordinator records a receipt, and
 * only a coordinator confirms. No command lets an organiser or operator
 * verify a payment.
 */

export interface PaymentReport {
  report_id: string;
  allocation_id: string;
  kind: ObligationKind;
  /** GBP minor units, as reported (not verified). */
  amount_minor: number;
  reference: string;
  reported_at: string;
}

export interface RecordedReceipt {
  entry_id: string;
  allocation_id: string;
  session_id: string;
  kind: ObligationKind;
  amount_minor: number;
  currency: "GBP";
  receipt_id: string;
  /** When the money actually reached the venue; timeliness uses only this (§12). */
  received_at: string;
  /** When venue staff recorded the receipt (the database clock). */
  verified_at: string;
  /** received_at <= the session's pay_by. */
  timely: boolean | null;
  verified_deposit_minor: number;
  verified_balance_minor: number;
}

export interface ConfirmedSession {
  booking_id: string;
  booking_ref: string;
  session_id: string;
  version: number;
  confirmed_at: string;
}

export interface ReportPaymentInput {
  allocationId: string;
  kind: ObligationKind;
  amountMinor: number;
  reference: string;
}

export interface RecordReceiptInput {
  allocationId: string;
  kind: ObligationKind;
  amountMinor: number;
  receivedAt: Date;
  receiptId: string;
  evidence: string | null;
  /** Also try to confirm the session once the receipt is saved (V4 "Record receipt and confirm"). */
  confirmWhenReady: boolean;
  diaryChecked: boolean;
  expectedSessionVersion: number;
}

export interface ReceiptOutcome {
  receipt: RecordedReceipt;
  confirmation: { booking_ref: string } | null;
  /** Unmet confirmation prerequisites; the receipt stays saved (§24). */
  confirmation_blockers: BlockerDetail[];
  /** A confirmation failure other than blockers (for example a stale version); the receipt stays saved. */
  confirmation_error: Pick<ApiError, "code" | "message"> | null;
}

const MAX_KEY = 200;
const CONFIRM_SUFFIX = ":confirm";

/**
 * The idempotency key for the confirmation that follows a receipt:
 * `${key}:confirm`, or a SHA-256 of the key when that would exceed the
 * 200-character limit. Stable, so a replayed receipt replays its confirmation.
 */
export function confirmationKey(key: string): string {
  const derived = `${key}${CONFIRM_SUFFIX}`;
  if (derived.length <= MAX_KEY) return derived;
  return `${createHash("sha256").update(key).digest("hex")}${CONFIRM_SUFFIX}`;
}

interface BlockerRow {
  code: ConfirmationBlocker;
  allocation_id?: string;
}

function toBlockerDetails(rows: unknown): BlockerDetail[] {
  if (!Array.isArray(rows)) return [];
  return (rows as BlockerRow[]).map((b) => (b.allocation_id ? { code: b.code, allocationId: b.allocation_id }
                                                             : { code: b.code }));
}

export function reportPayment(actor: SilaActor, key: string, input: ReportPaymentInput) {
  return callSila<PaymentReport>("report_payment", [
    actor.personId, key, input.allocationId, input.kind, input.amountMinor, input.reference,
  ]);
}

/**
 * Coordinator confirms the session at the version they saw after checking the
 * external diary. NOT_READY carries `details.blockers` as BlockerDetail[] in
 * confirmationBlockers order.
 */
export async function confirmSession(actor: SilaActor, key: string, sessionId: string, expectedVersion: number,
                                     diaryChecked: boolean): Promise<ApiResult<ConfirmedSession>> {
  const result = await callSila<ConfirmedSession>("confirm_session", [
    actor.personId, key, sessionId, expectedVersion, diaryChecked,
  ]);
  if (result.ok || result.error.code !== "NOT_READY") return result;
  return { ...result, error: { ...result.error,
                               details: { ...result.error.details,
                                          blockers: toBlockerDetails(result.error.details?.blockers) } } };
}

/**
 * Records a verified receipt. With `confirmWhenReady`, then tries to confirm
 * the session under `confirmationKey(key)`. A blocked or failed confirmation
 * never undoes the receipt: the outcome is still a success carrying the
 * receipt with `confirmation_blockers` or `confirmation_error` (§24). A failed
 * receipt is returned unchanged and nothing is confirmed.
 */
export async function recordReceipt(actor: SilaActor, key: string,
                                    input: RecordReceiptInput): Promise<ApiResult<ReceiptOutcome>> {
  const receipt = await callSila<RecordedReceipt>("record_receipt", [
    actor.personId, key, input.allocationId, input.kind, input.amountMinor, input.receivedAt, input.receiptId,
    input.evidence,
  ]);
  if (!receipt.ok) return receipt;
  const outcome: ReceiptOutcome = { receipt: receipt.data, confirmation: null, confirmation_blockers: [],
                                    confirmation_error: null };
  if (input.confirmWhenReady) {
    const confirmed = await confirmSession(actor, confirmationKey(key), receipt.data.session_id,
                                           input.expectedSessionVersion, input.diaryChecked);
    if (confirmed.ok) {
      outcome.confirmation = { booking_ref: confirmed.data.booking_ref };
    } else if (confirmed.error.code === "NOT_READY") {
      outcome.confirmation_blockers = confirmed.error.details?.blockers as BlockerDetail[];
    } else {
      outcome.confirmation_error = { code: confirmed.error.code, message: confirmed.error.message };
    }
  }
  return { ...receipt, data: outcome };
}

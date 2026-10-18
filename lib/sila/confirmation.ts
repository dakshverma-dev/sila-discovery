export type ObligationKind = "deposit" | "balance";

export interface VerifiedReceipt {
  allocationId: string;
  kind: ObligationKind;
  amountMinor: number;
  receiptId: string;
  receivedAt: Date;
  verifiedAt: Date;
}

/** Timeliness is judged by when money reached the venue, never by when staff checked it (§12). */
export function isTimely(receivedAt: Date, payBy: Date): boolean {
  return receivedAt.getTime() <= payBy.getTime();
}

/** Receipt identifiers are unique within a venue so the same money cannot count twice (§18). */
export function isDuplicateReceipt(existingReceiptIds: ReadonlySet<string>, receiptId: string): boolean {
  return existingReceiptIds.has(receiptId.trim().toUpperCase());
}

export function normaliseReceiptId(receiptId: string): string {
  return receiptId.trim().toUpperCase();
}

export interface ConfirmAllocation {
  allocationId: string;
  places: number;
  depositMinor: number;
}

export interface ConfirmInput {
  now: Date;
  minimum: number;
  decisionBy: Date;
  holdExpiresAt: Date | null;
  externalDiaryCheckedAt: Date | null;
  paymentOpenedAt: Date | null;
  allocations: readonly ConfirmAllocation[];
  receipts: readonly VerifiedReceipt[];
}

export type ConfirmationBlocker =
  | "PAYMENT_NOT_OPENED"
  | "MINIMUM_NOT_MET"
  | "DEPOSIT_NOT_VERIFIED"
  | "RESOURCE_HOLD_EXPIRED"
  | "DIARY_NOT_CHECKED"
  | "DECISION_DEADLINE_PASSED";

export interface BlockerDetail {
  code: ConfirmationBlocker;
  allocationId?: string;
}

/** Only the venue confirms, and only when every prerequisite holds (§08, §17). */
export function confirmationBlockers(input: ConfirmInput): BlockerDetail[] {
  const blockers: BlockerDetail[] = [];
  if (!input.paymentOpenedAt) blockers.push({ code: "PAYMENT_NOT_OPENED" });
  const places = input.allocations.reduce((sum, a) => sum + a.places, 0);
  if (places < input.minimum) blockers.push({ code: "MINIMUM_NOT_MET" });
  for (const a of input.allocations) {
    const verified = input.receipts
      .filter((r) => r.allocationId === a.allocationId && r.kind === "deposit")
      .reduce((sum, r) => sum + r.amountMinor, 0);
    if (verified < a.depositMinor) blockers.push({ code: "DEPOSIT_NOT_VERIFIED", allocationId: a.allocationId });
  }
  if (!input.holdExpiresAt || input.holdExpiresAt.getTime() < input.now.getTime()) {
    blockers.push({ code: "RESOURCE_HOLD_EXPIRED" });
  }
  if (!input.externalDiaryCheckedAt) blockers.push({ code: "DIARY_NOT_CHECKED" });
  if (input.now.getTime() > input.decisionBy.getTime()) blockers.push({ code: "DECISION_DEADLINE_PASSED" });
  return blockers;
}

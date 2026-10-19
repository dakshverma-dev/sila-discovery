import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { recordReceipt } from "@/lib/sila/commands/receipts";
import { parseLondonDateTime } from "@/lib/sila/forms";

// received_at is London wall time, like every other datetime entered by the venue.
const londonInstant = z.string().transform((value, ctx) => {
  const instant = parseLondonDateTime(value);
  if (!instant) {
    ctx.addIssue({ code: "custom", message: "Enter a London date and time as YYYY-MM-DDTHH:mm.", input: value });
    return z.NEVER;
  }
  return instant;
});

const Body = z
  .strictObject({
    kind: z.enum(["deposit", "balance"], "Choose deposit or balance."),
    amount_minor: z.int("Enter an amount in pence.").min(1, "Enter an amount above zero."),
    received_at: londonInstant,
    receipt_id: z.string().trim().min(1, "Enter the venue receipt identifier.").max(100, "Use at most 100 characters."),
    evidence: z.string().trim().max(1000, "Use at most 1000 characters.").nullish(),
    confirm_when_ready: z.boolean().default(false),
    diary_checked: z.boolean().default(false),
    expected_session_version: z.int().min(1).nullish(),
  })
  .refine((b) => !b.confirm_when_ready || b.expected_session_version != null, {
    path: ["expected_session_version"],
    message: "Required when confirming.",
  });

/**
 * POST /api/v1/sila/allocations/:id/receipts: venue finance or a coordinator
 * records money actually received. With `confirm_when_ready` the session is
 * then confirmed if every prerequisite holds. A blocked confirmation still
 * returns 201 with the saved receipt and `confirmation_blockers` (§24).
 * Duplicate venue receipt identifiers return DUPLICATE_RECEIPT (409).
 */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  const result = await recordReceipt(actor, key, {
    allocationId: id,
    kind: b.kind,
    amountMinor: b.amount_minor,
    receivedAt: b.received_at,
    receiptId: b.receipt_id,
    evidence: b.evidence || null,
    confirmWhenReady: b.confirm_when_ready,
    diaryChecked: b.diary_checked,
    expectedSessionVersion: b.expected_session_version ?? 0,
  });
  return fromResult(result, (d) => d, 201, { details: true });
});

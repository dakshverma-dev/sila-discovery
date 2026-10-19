import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { reportPayment } from "@/lib/sila/commands/receipts";

const Body = z.strictObject({
  kind: z.enum(["deposit", "balance"], "Choose deposit or balance."),
  amount_minor: z.int("Enter an amount in pence.").min(1, "Enter an amount above zero."),
  reference: z.string().trim().min(1, "Enter a payment reference.").max(100, "Use at most 100 characters."),
});

/**
 * POST /api/v1/sila/allocations/:id/reports: the organiser says what their
 * club paid. The report is unverified and creates no financial entry; before
 * payment opens it returns PAYMENT_NOT_OPEN (409).
 */
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const key = idempotencyKey(request);
  const { id } = await params;
  const actor = await requireApiActor(request);
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const b = await readJson(request, Body, "INVALID_FIELDS");
  const result = await reportPayment(actor, key, { allocationId: id, kind: b.kind, amountMinor: b.amount_minor,
                                                   reference: b.reference });
  return fromResult(result, (d) => d, 201, { details: true });
});

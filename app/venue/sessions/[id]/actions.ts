"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { CONFIRMATION_COPY, PUBLICATION_COPY } from "@/components/sila/venue/blocker-copy";
import { parsePounds } from "@/lib/domain/money";
import { requireSilaActor } from "@/lib/sila/auth";
import { approvePlan, declinePlan } from "@/lib/sila/commands/commitments";
import { listSessionRequests, postPlanMessage } from "@/lib/sila/commands/plans";
import { confirmSession, recordReceipt } from "@/lib/sila/commands/receipts";
import { getVenueSession, publishSession, saveSessionDraft, setIntake } from "@/lib/sila/commands/sessions";
import { parseLondonDateTime, parseLondonReturnTime, sessionDraftSchema } from "@/lib/sila/forms";
import { closeSession, recordRefund } from "@/lib/sila/commands/refunds";
import type { PublicationBlocker } from "@/lib/sila/session";
import type { BlockerDetail } from "@/lib/sila/confirmation";
import { actionError, formText, formValues, type VenueActionState } from "@/lib/sila/venue-forms";

async function context(data: FormData) {
  const id = formText(data, "session_id");
  if (!z.uuid().safeParse(id).success) notFound();
  const actor = await requireSilaActor(`/venue/sessions/${id}`);
  const result = await getVenueSession(actor, id);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") notFound();
    throw new Error("The session could not be loaded.");
  }
  return { id, actor, view: result.data, key: formText(data, "idempotency_key") };
}
const version = (data: FormData) => Number(formText(data, "expected_version"));
const invalid = (data: FormData, fieldErrors: Record<string, string[]>): VenueActionState =>
  ({ error: "Check the highlighted details.", fieldErrors, values: formValues(data), key: randomUUID() });
const failed = (error: Parameters<typeof actionError>[0], data: FormData): VenueActionState => {
  if (error.code === "NOT_FOUND") notFound();
  return { ...actionError(error, data), key: randomUUID() };
};

/** Save all editable terms together. Failed input stays in the authenticated form (§23). */
export async function saveDraftAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, view, key } = await context(data);
  const raw = formValues(data);
  const percent = parsePounds(formText(data, "deposit_percent"));
  const parsed = sessionDraftSchema.safeParse({
    ...Object.fromEntries(["title", "description", "inclusions", "image_url", "meeting_point", "starts_at", "ends_at",
      "price", "minimum", "capacity", "max_clubs", "payment_window_days", "fill_by", "decision_by", "balance_due_at",
      "resource_name", "hold_checked_by", "venue_terms_version", "venue_terms_text", "platform_terms_version",
      "payment_route"].map((name) => [name, raw[name] ?? ""])),
    hold_expires_at: raw.hold_expires_at || null,
    deposit_bp: percent,
    covered_dates: (raw.covered_dates ?? "").split(/[\s,]+/).filter(Boolean),
    access_facts_reviewed: raw.access_facts_reviewed === "on",
    run_at_minimum_approved: raw.run_at_minimum_approved === "on",
  });
  if (!parsed.success) return invalid(data, z.flattenError(parsed.error).fieldErrors);
  const result = await saveSessionDraft(actor, key, {
    venueId: view.venue.id, sessionId: id, expectedVersion: version(data), draft: parsed.data,
  });
  if (!result.ok) return failed(result.error, data);
  revalidatePath(`/venue/sessions/${id}`);
  revalidatePath("/venue");
  redirect(`/venue/sessions/${id}?notice=saved`);
}

export async function publishAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, key } = await context(data);
  if (data.get("resource_coverage_approved") !== "on") {
    return invalid(data, { resource_coverage_approved: ["Approve the resource hold and staffed coverage before publishing."] });
  }
  const result = await publishSession(actor, key, id, version(data));
  if (!result.ok) {
    const blockers = result.error.details?.blockers as PublicationBlocker[] | undefined;
    return { ...failed(result.error, data), blockers: blockers?.map((code) => PUBLICATION_COPY[code] ?? code) };
  }
  revalidatePath("/venue");
  redirect(`/venue/sessions/${id}?notice=published#session-link`);
}

export async function intakeAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, key } = await context(data);
  const result = await setIntake(actor, key, id, data.get("paused") === "true", formText(data, "reason"), version(data));
  if (!result.ok) return failed(result.error, data);
  revalidatePath(`/venue/sessions/${id}`);
  redirect(`/venue/sessions/${id}?notice=intake`);
}

async function requestContext(data: FormData) {
  const ctx = await context(data);
  const plans = await listSessionRequests(ctx.actor, ctx.id);
  if (!plans.ok) notFound();
  const planId = formText(data, "plan_id");
  const plan = plans.data.plans.find((item) => item.id === planId);
  if (!plan) notFound();
  return { ...ctx, planId, plan };
}

export async function approveAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, key, planId } = await requestContext(data);
  const places = Number(formText(data, "places"));
  if (!Number.isSafeInteger(places) || places < 1) return invalid(data, { places: ["Enter exact whole places."] });
  const result = await approvePlan(actor, key, planId, places, Number(formText(data, "terms_version")));
  if (!result.ok) return failed(result.error, data);
  revalidatePath(`/venue/sessions/${id}`);
  redirect(`/venue/sessions/${id}?notice=approved#requests`);
}

export async function declineAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, key, planId } = await requestContext(data);
  const reason = formText(data, "reason").trim();
  if (!reason || reason.length > 500) return invalid(data, { reason: ["Give a reason of 1 to 500 characters."] });
  const result = await declinePlan(actor, key, planId, reason);
  if (!result.ok) return failed(result.error, data);
  revalidatePath(`/venue/sessions/${id}`);
  redirect(`/venue/sessions/${id}?notice=declined#requests`);
}

export async function venueMessageAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, key, planId } = await requestContext(data);
  const body = formText(data, "body").trim();
  if (!body || body.length > 2000) return invalid(data, { body: ["Use 1 to 2000 characters."] });
  const result = await postPlanMessage(actor, key, planId, body);
  if (!result.ok) return failed(result.error, data);
  revalidatePath(`/venue/sessions/${id}`);
  redirect(`/venue/sessions/${id}?notice=message#requests`);
}

export async function receiptAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, key, view } = await context(data);
  const allocationId = formText(data, "allocation_id");
  if (!view.allocations.some((a) => a.allocation_id === allocationId)) notFound();
  const amountMinor = parsePounds(formText(data, "amount"));
  const receivedAt = parseLondonDateTime(formText(data, "received_at"));
  const receiptId = formText(data, "receipt_id").trim();
  const kind = formText(data, "kind");
  const bad: Record<string, string[]> = {};
  if (amountMinor === null || amountMinor <= 0) bad.amount = ["Enter a positive amount in GBP."];
  if (!receivedAt) bad.received_at = ["Enter when the funds actually reached the venue, in London time."];
  if (!receiptId || receiptId.length > 100) bad.receipt_id = ["Use 1 to 100 characters."];
  if (kind !== "deposit" && kind !== "balance") bad.kind = ["Choose deposit or balance."];
  if (Object.keys(bad).length || amountMinor === null || !receivedAt || (kind !== "deposit" && kind !== "balance")) return invalid(data, bad);
  const result = await recordReceipt(actor, key, {
    allocationId, kind, amountMinor, receivedAt, receiptId,
    evidence: formText(data, "evidence").trim() || null,
    confirmWhenReady: data.get("intent") === "confirm",
    diaryChecked: data.get("diary_checked") === "on",
    expectedSessionVersion: version(data),
  });
  if (!result.ok) return failed(result.error, data);
  revalidatePath(`/venue/sessions/${id}`);
  if (result.data.confirmation) redirect(`/venue/sessions/${id}?notice=confirmed`);
  return {
    notice: "Receipt saved. The venue has recorded this money.",
    blockers: [
      ...result.data.confirmation_blockers.map((b) => CONFIRMATION_COPY[b.code]),
      ...(result.data.confirmation_error ? [result.data.confirmation_error.message] : []),
    ],
    receiptSaved: true,
  };
}

export async function confirmAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, key } = await context(data);
  const result = await confirmSession(actor, key, id, version(data), data.get("diary_checked") === "on");
  if (!result.ok) {
    const blockers = result.error.details?.blockers as BlockerDetail[] | undefined;
    return { ...failed(result.error, data), blockers: blockers?.map((b) => CONFIRMATION_COPY[b.code]) };
  }
  revalidatePath(`/venue/sessions/${id}`);
  redirect(`/venue/sessions/${id}?notice=confirmed`);
}

export async function closeAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, key } = await context(data);
  const cause = formText(data, "cause");
  const reason = formText(data, "reason").trim();
  if ((cause !== "unconfirmed" && cause !== "venue_fault") || !reason || reason.length > 500
    || data.get("full_refund_reviewed") !== "on") {
    return invalid(data, { reason: ["Give a reason and acknowledge the full return of all session payments."] });
  }
  const result = await closeSession(actor, key, id, version(data), cause, reason);
  if (!result.ok) return failed(result.error, data);
  revalidatePath(`/venue/sessions/${id}`);
  revalidatePath("/venue");
  redirect(`/venue/sessions/${id}?notice=closed`);
}

export async function refundAction(_: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { id, actor, key, view } = await context(data);
  const allocation = formText(data, "allocation_id");
  if (!view.allocations.some((a) => a.allocation_id === allocation)) notFound();
  const amount = parsePounds(formText(data, "amount"));
  const returned = parseLondonReturnTime(formText(data, "returned_at"));
  const errors: Record<string, string[]> = {};
  if (amount === null || amount <= 0) errors.amount = ["Enter a positive amount in GBP."];
  if (!returned) errors.returned_at = ["Enter the actual return time in London, including seconds if needed."];
  if (Object.keys(errors).length || amount === null || !returned) return invalid(data, errors);
  const result = await recordRefund(actor, key, allocation, version(data), amount,
    formText(data, "reference").trim(), returned, formText(data, "evidence").trim());
  if (!result.ok) return failed(result.error, data);
  revalidatePath(`/venue/sessions/${id}`);
  redirect(`/venue/sessions/${id}?notice=refund`);
}

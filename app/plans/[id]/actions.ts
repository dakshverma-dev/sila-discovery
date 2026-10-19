"use server";

import { notFound, redirect } from "next/navigation";
import { parsePounds } from "@/lib/domain/money";
import { requireSilaActor } from "@/lib/sila/auth";
import { commitPlan } from "@/lib/sila/commands/commitments";
import { withdrawPlan } from "@/lib/sila/commands/payments";
import { postPlanMessage } from "@/lib/sila/commands/plans";
import { reportPayment } from "@/lib/sila/commands/receipts";

/**
 * Server actions for the organiser's plan page. Each form carries a hidden
 * `idempotency_key` generated when the page rendered, so a double submit replays
 * the first result. Outcomes come back to the plan page as a short `notice` or
 * `error` code (never free text), which the page turns into plain language.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9._:-]{8,150}$/;

function text(formData: FormData, name: string, max: number): string {
  return String(formData.get(name) ?? "").slice(0, max);
}

function ids(formData: FormData): { planId: string; key: string } {
  const planId = text(formData, "plan_id", 40);
  if (!UUID.test(planId)) notFound();
  const key = text(formData, "idempotency_key", 160);
  // A missing or malformed key must not turn into a shared one; the page always sends a good key.
  if (!KEY.test(key)) redirect(`/plans/${planId}?form=generic&error=IDEMPOTENCY_CONFLICT`);
  return { planId, key };
}

function back(planId: string, params: Record<string, string>, hash = ""): never {
  redirect(`/plans/${planId}?${new URLSearchParams(params).toString()}${hash}`);
}

export async function commitAction(formData: FormData): Promise<void> {
  const { planId, key } = ids(formData);
  const actor = await requireSilaActor(`/plans/${planId}`);
  const places = Number(text(formData, "places", 6));
  const terms = Number(text(formData, "terms_version", 6));
  if (!Number.isSafeInteger(places) || !Number.isSafeInteger(terms)) back(planId, { form: "commit", error: "STALE_TERMS" });

  const result = await commitPlan(actor, key, planId, places, terms);
  if (result.ok) back(planId, { notice: "committed" });
  back(planId, { form: "commit", error: result.error.code });
}

export async function withdrawAction(formData: FormData): Promise<void> {
  const { planId, key } = ids(formData);
  const actor = await requireSilaActor(`/plans/${planId}`);
  const version = Number(text(formData, "expected_version", 9));
  const reason = text(formData, "reason", 600).trim();
  if (!reason) back(planId, { form: "withdraw", error: "INVALID_FIELDS", fe: "reason" });
  if (!Number.isSafeInteger(version)) back(planId, { form: "withdraw", error: "VERSION_CONFLICT" });

  const result = await withdrawPlan(actor, key, planId, version, reason);
  if (result.ok) back(planId, { notice: result.data.outcome === "released" ? "withdrawn" : "withdraw_requested" });
  const fields: Record<string, string> = result.error.code === "INVALID_FIELDS" ? { fe: "reason" } : {};
  back(planId, { form: "withdraw", error: result.error.code, ...fields });
}

export async function reportPaymentAction(formData: FormData): Promise<void> {
  const { planId, key } = ids(formData);
  const actor = await requireSilaActor(`/plans/${planId}`);
  const allocationId = text(formData, "allocation_id", 40);
  if (!UUID.test(allocationId)) notFound();
  const amountText = text(formData, "amount", 12).trim();
  const reference = text(formData, "reference", 100).trim();
  const keep = { amount: amountText, reference };

  // Keep what was typed (a failed report preserves its reference) and say which fields to fix.
  const amountMinor = parsePounds(amountText);
  const bad = [amountMinor === null || amountMinor <= 0 ? "amount" : "", reference ? "" : "reference"].filter(Boolean);
  if (bad.length > 0 || amountMinor === null) {
    back(planId, { form: "paid", error: "INVALID_FIELDS", fe: bad.join(","), ...keep });
  }

  const result = await reportPayment(actor, key, { allocationId, kind: "deposit", amountMinor, reference });
  if (result.ok) back(planId, { notice: "paid_reported" });
  back(planId, { form: "paid", error: result.error.code, ...keep });
}

export async function messageAction(formData: FormData): Promise<void> {
  const { planId, key } = ids(formData);
  const actor = await requireSilaActor(`/plans/${planId}?tab=messages`);
  const body = text(formData, "body", 2100).trim();
  if (body.length < 1 || body.length > 2000) {
    back(planId, { tab: "messages", form: "message", error: "INVALID_FIELDS", fe: "body" }, "#message");
  }
  const result = await postPlanMessage(actor, key, planId, body);
  if (result.ok) back(planId, { tab: "messages", notice: "message_sent" }, "#conversation");
  back(planId, { tab: "messages", form: "message", error: result.error.code }, "#message");
}

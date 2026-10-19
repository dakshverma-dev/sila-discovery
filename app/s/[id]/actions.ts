"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getSilaActor } from "@/lib/sila/auth";
import { PLAN_SOURCES, submitPlan, type PlanSource } from "@/lib/sila/commands/plans";
import { getPublicSession } from "@/lib/sila/commands/sessions";
import { fieldErrorsFrom, planErrorMessage, requestClosedMessage } from "@/lib/sila/plan-copy";
import { DRAFT_COOKIE, draftCookieOptions, sealRequestDraft } from "@/lib/sila/request-draft";
import type { RequestFormState, RequestFormValues } from "@/lib/sila/request-form";
import { sendSignInLink } from "@/lib/sila/sign-in";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9._:-]{8,150}$/;

const clubName = z.string().trim().min(1, "Enter your club's name.").max(120, "Use at most 120 characters.");
const places = z
  .string()
  .trim()
  .regex(/^\d{1,4}$/, "Enter a whole number of places.")
  .transform(Number)
  .pipe(z.int().min(1, "Request at least 1 place."));
const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address."));

const DB_FIELD: Record<string, string> = { club_name: "clubName", places: "places", source: "source" };

function sourceFrom(raw: FormDataEntryValue | null): PlanSource {
  const value = String(raw ?? "");
  return (PLAN_SOURCES as readonly string[]).includes(value) ? (value as PlanSource) : "unknown";
}

/**
 * O1: request places on a published session. The form carries an idempotency
 * key generated when it was rendered, so a double submit replays one plan.
 * Signed in as the typed email: submit now. Otherwise save the draft in a
 * signed cookie and email a sign-in link that returns to /s/{id}/resume.
 */
export async function requestPlaces(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const sessionId = String(formData.get("session_id") ?? "");
  if (!UUID.test(sessionId)) notFound();
  const rawKey = String(formData.get("idempotency_key") ?? "");
  const key = KEY.test(rawKey) ? rawKey : randomUUID();
  const source = sourceFrom(formData.get("source"));
  const values: RequestFormValues = {
    clubName: String(formData.get("club_name") ?? "").slice(0, 200),
    places: String(formData.get("places") ?? "").slice(0, 10),
    email: String(formData.get("email") ?? "").slice(0, 300),
  };
  // A rejected attempt is stored under its key, so the form gets a fresh one.
  const fail = (message: string | null, fields: Record<string, string> = {}): RequestFormState => ({
    status: "error",
    message,
    fields,
    values,
    key: randomUUID(),
    sentTo: null,
  });

  const session = await getPublicSession(sessionId);
  if (!session.ok) {
    if (session.error.code === "NOT_FOUND") notFound();
    return fail(planErrorMessage(session.error.code));
  }
  const closed = requestClosedMessage(session.data, new Date());
  if (closed) return fail(closed);

  const fields: Record<string, string> = {};
  const club = clubName.safeParse(values.clubName);
  const count = places.safeParse(values.places);
  const address = email.safeParse(values.email);
  if (!club.success) fields.clubName = club.error.issues[0]!.message;
  if (!count.success) fields.places = count.error.issues[0]!.message;
  else if (count.data > session.data.capacity) fields.places = `This session has ${session.data.capacity} places.`;
  if (!address.success) fields.email = address.error.issues[0]!.message;
  if (!club.success || !count.success || !address.success || fields.places) {
    return fail("Check the highlighted fields.", fields);
  }

  const actor = await getSilaActor();
  if (actor && actor.email.toLowerCase() === address.data) {
    const submitted = await submitPlan(actor, key, {
      sessionId,
      clubName: club.data,
      places: count.data,
      source,
    });
    if (submitted.ok) redirect(`/plans/${submitted.data.plan_id}`);
    const dbFields: Record<string, string> = {};
    for (const [name, message] of Object.entries(fieldErrorsFrom(submitted.error.details))) {
      dbFields[DB_FIELD[name] ?? name] = message;
    }
    return fail(planErrorMessage(submitted.error.code), dbFields);
  }

  // Not signed in as this email: keep the draft and verify the address first.
  const token = sealRequestDraft({
    sessionId,
    clubName: club.data,
    places: count.data,
    email: address.data,
    source,
    idempotencyKey: key,
    exp: 0, // stamped by sealRequestDraft
  });
  const sent = await sendSignInLink(address.data, `/s/${sessionId}/resume`);
  if (!sent.ok) {
    return fail(
      sent.reason === "rate"
        ? "Too many sign-in emails were requested. Wait a few minutes and try again."
        : "We could not send the email. Try again in a moment.",
    );
  }
  (await cookies()).set(DRAFT_COOKIE, token, draftCookieOptions());
  return { status: "saved", message: null, fields: {}, values, key, sentTo: address.data };
}

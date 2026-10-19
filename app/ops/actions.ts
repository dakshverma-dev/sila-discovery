"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import type { ApiError } from "@/lib/db/api";
import { requireSilaActor } from "@/lib/sila/auth";
import { saveSessionDraft, setIntake } from "@/lib/sila/commands/sessions";
import { callSila } from "@/lib/sila/db";
import { sessionDraftSchema } from "@/lib/sila/forms";
import type { VenueActionState } from "@/lib/sila/venue-forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9._:-]{8,150}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function failure(data: FormData, error: string, fieldErrors?: Record<string, string[]>): VenueActionState {
  const values: Record<string, string> = {};
  for (const [name, value] of data) if (typeof value === "string") values[name] = value;
  const messages: Record<string, string> = {
    INVALID_FIELDS: "Check the fields below and try again.",
    IDEMPOTENCY_CONFLICT: "This form was already used for different details. Check the details and try again.",
    VERSION_CONFLICT: "This session changed. Reload the page, review its current intake status and try again.",
    SESSION_NOT_OPEN: "Only a published session can have new intake paused or resumed. Reload to see its current status.",
    NOT_DRAFT: "This session has been published. Its terms can no longer be edited as a draft.",
    AUTH_REQUIRED: "Sign in again to continue.",
  };
  return { error: messages[error] ?? "That change could not be saved. Reload the page and try again.",
    fieldErrors, values, key: randomUUID() };
}

function commandError(data: FormData, error: ApiError): VenueActionState {
  if (error.code === "NOT_FOUND") notFound();
  const fieldErrors: Record<string, string[]> = {};
  const raw = error.details?.field_errors;
  if (raw && typeof raw === "object") {
    for (const [name, messages] of Object.entries(raw)) {
      if (Array.isArray(messages)) fieldErrors[name] = messages.filter((message): message is string => typeof message === "string");
    }
  }
  return failure(data, error.code, fieldErrors);
}

/** Resolve live operator permission for every action; the DB repeats object checks (§19, §24). */
async function operator() {
  const actor = await requireSilaActor("/ops");
  const context = await callSila<{ is_operator: boolean; venues: Array<{ id: string }> }>("get_my_context", [actor.personId]);
  if (!context.ok || !context.data.is_operator) notFound();
  return { actor, venues: context.data.venues };
}

function validKey(data: FormData): boolean {
  return KEY.test(text(data, "idempotency_key"));
}

/** Save public facts only. No individual access or health information (§19). */
export async function createVenueAction(_state: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { actor } = await operator();
  if (!validKey(data)) return failure(data, "IDEMPOTENCY_CONFLICT");
  const name = text(data, "name");
  const address = text(data, "address");
  const access = text(data, "access_facts");
  const email = text(data, "contact_email");
  const phone = text(data, "contact_phone");
  const errors: Record<string, string[]> = {};
  if (name.length < 2 || name.length > 120) errors.name = ["Use 2 to 120 characters for the venue name."];
  if (!address || address.length > 1000) errors.address = ["Enter the venue address, using at most 1000 characters."];
  if (access.length > 2000) errors.access_facts = ["Use at most 2000 characters for public access facts."];
  if (email && (!EMAIL.test(email) || email.length > 254)) errors.contact_email = ["Enter a valid venue email address."];
  if (phone.length > 80) errors.contact_phone = ["Use at most 80 characters for the phone number."];
  if (!email && !phone) errors.contact_email = ["Provide a direct venue email or phone number."];
  if (Object.keys(errors).length) return failure(data, "INVALID_FIELDS", errors);
  const result = await callSila<{ venue_id: string }>("create_venue", [
    actor.personId, text(data, "idempotency_key"), name, address, access, email || null, phone || null,
  ]);
  if (!result.ok) return commandError(data, result.error);
  revalidatePath("/ops");
  revalidatePath("/venue");
  redirect("/ops?notice=venue_created");
}

export async function inviteVenueMemberAction(_state: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { actor, venues } = await operator();
  const venueId = text(data, "venue_id");
  if (!UUID.test(venueId) || !venues.some((venue) => venue.id === venueId)) notFound();
  if (!validKey(data)) return failure(data, "IDEMPOTENCY_CONFLICT");
  const email = text(data, "email");
  const role = text(data, "role");
  const errors: Record<string, string[]> = {};
  if (!EMAIL.test(email) || email.length > 254) errors.email = ["Enter the staff member's email address."];
  if (role !== "coordinator" && role !== "finance") errors.role = ["Choose coordinator or finance."];
  if (Object.keys(errors).length) return failure(data, "INVALID_FIELDS", errors);
  const result = await callSila("add_venue_member", [actor.personId, text(data, "idempotency_key"), venueId, email, role]);
  if (!result.ok) return commandError(data, result.error);
  revalidatePath("/ops");
  revalidatePath("/venue");
  redirect("/ops?notice=staff_invited");
}

/** Only creates a draft; venue approval, resource hold and publication stay separate (§04, §24). */
export async function prepareSessionAction(_state: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { actor, venues } = await operator();
  const venueId = text(data, "venue_id");
  if (!UUID.test(venueId) || !venues.some((venue) => venue.id === venueId)) notFound();
  if (!validKey(data)) return failure(data, "IDEMPOTENCY_CONFLICT");
  const fields = ["title", "starts_at", "ends_at", "price", "minimum", "capacity", "fill_by", "decision_by", "balance_due_at"];
  const parsed = sessionDraftSchema.safeParse(Object.fromEntries(fields.map((name) => [name, text(data, name)])));
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "draft");
      (errors[field] ??= []).push(issue.message);
    }
    return failure(data, "INVALID_FIELDS", errors);
  }
  const result = await saveSessionDraft(actor, text(data, "idempotency_key"), {
    venueId, sessionId: null, expectedVersion: null, draft: parsed.data,
  });
  if (!result.ok) return commandError(data, result.error);
  revalidatePath("/ops");
  revalidatePath("/venue");
  redirect(`/venue/sessions/${result.data.session_id}?notice=draft_saved`);
}

export async function opsIntakeAction(_state: VenueActionState, data: FormData): Promise<VenueActionState> {
  const { actor } = await operator();
  const sessionId = text(data, "session_id");
  if (!UUID.test(sessionId)) notFound();
  if (!validKey(data)) return failure(data, "IDEMPOTENCY_CONFLICT");
  const versionText = text(data, "expected_version");
  const version = Number(versionText);
  if (!/^\d+$/.test(versionText) || !Number.isSafeInteger(version) || version < 1) return failure(data, "VERSION_CONFLICT");
  const paused = text(data, "paused");
  if (paused !== "true" && paused !== "false") return failure(data, "INVALID_FIELDS", { paused: ["Choose pause or resume."] });
  const reason = text(data, "reason");
  if (!reason || reason.length > 500) return failure(data, "INVALID_FIELDS", { reason: ["Give a reason using 1 to 500 characters."] });
  const result = await setIntake(actor, text(data, "idempotency_key"), sessionId, paused === "true", reason, version);
  if (!result.ok) return commandError(data, result.error);
  revalidatePath("/ops");
  revalidatePath("/venue");
  revalidatePath(`/venue/sessions/${sessionId}`);
  revalidatePath(`/s/${sessionId}`);
  redirect(`/ops?notice=${paused === "true" ? "intake_paused" : "intake_resumed"}`);
}

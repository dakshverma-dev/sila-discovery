"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { processMatchRun } from "@/lib/agent/run";
import { getDemoSession, requireDemoSession, setDemoCookie, clearDemoCookie } from "@/lib/auth/demo-session";
import { callApi, type ApiResult } from "@/lib/db/api";
import { getPool } from "@/lib/db/pool";
import { londonToUtc } from "@/lib/demo/catalogue";
import { createSandbox } from "@/lib/demo/session";
import { parsePounds } from "@/lib/domain/money";

/*
 * Every action derives the actor from the verified sandbox capability, never
 * from form fields, and passes a render-time Idempotency-Key so a repeated
 * submission replays the first outcome instead of acting twice.
 */

function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function back(path: string, result: ApiResult<unknown> | { ok: false; error: { code: string } }, notice: string): never {
  const sep = path.includes("?") ? "&" : "?";
  if (result.ok) redirect(`${path}${sep}notice=${notice}`);
  redirect(`${path}${sep}error=${result.error.code}`);
}

function safePath(value: string, fallback: string): string {
  return /^\/demo(\/[A-Za-z0-9/_-]*)?$/.test(value) ? value : fallback;
}

/** Parses a London wall-clock "YYYY-MM-DDTHH:mm" from a datetime-local input. */
function londonInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return londonToUtc(day, Number(m[4]), Number(m[5]));
}

export async function startSandbox(): Promise<void> {
  const r = await createSandbox();
  if (!r.ok) redirect(`/?error=${r.code}`);
  redirect("/demo?notice=SANDBOX_STARTED");
}

export async function endSandbox(): Promise<void> {
  await clearDemoCookie();
  redirect("/");
}

export async function switchPersona(form: FormData): Promise<void> {
  const session = await requireDemoSession();
  const persona = field(form, "persona");
  const { rows } = await getPool().query<{ valid: boolean }>(
    "select scb_api.demo_persona_valid($1, $2) as valid",
    [session.workspaceId, persona],
  );
  if (!rows[0]?.valid) redirect("/demo?error=FORBIDDEN");
  await setDemoCookie({ w: session.workspaceId, p: persona, exp: session.expiresAt });
  redirect(`${safePath(field(form, "return_to"), "/demo")}?notice=PERSONA_SWITCHED`);
}

export async function requestSuggestions(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  // Sandbox groups and anchors are fictional, so evidence is always synthetic here.
  const r = await callApi<{ run_id: string }>("create_match_run", [s.actorId, field(form, "group_id"), "synthetic", randomUUID()]);
  if (!r.ok) redirect(`/demo?error=${r.error.code}`);
  after(() => processMatchRun(r.data.run_id).then(() => undefined));
  redirect(`/demo/runs/${r.data.run_id}`);
}

export async function requestReview(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  const id = field(form, "proposal_id");
  back(`/demo/proposals/${id}`, await callApi("request_venue_review", [s.actorId, id, randomUUID()]), "REVIEW_REQUESTED");
}

export async function publishProposal(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  const id = field(form, "proposal_id");
  const deadline = londonInput(field(form, "deadline"));
  if (!deadline) redirect(`/demo/proposals/${id}?error=VALIDATION_FAILED`);
  back(`/demo/proposals/${id}`,
       await callApi("publish_proposal", [s.actorId, id, deadline, randomUUID(), field(form, "idem")]), "PUBLISHED");
}

export async function reviseProposal(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  const id = field(form, "proposal_id");
  const ticket = parsePounds(field(form, "ticket"));
  const deadline = londonInput(field(form, "deadline"));
  if (ticket === null || !deadline) redirect(`/demo/proposals/${id}?error=VALIDATION_FAILED`);
  const detail = await callApi<{ experience_id: string; quote_id: string; version: number }>(
    "get_proposal_detail", [s.actorId, id]);
  if (!detail.ok) redirect(`/demo/proposals/${id}?error=${detail.error.code}`);
  // Reuse the current quote's cost terms and change only the all-in ticket price.
  const q = await callApi<Record<string, number>>("get_quote_terms", [s.actorId, detail.data.quote_id]);
  if (!q.ok) redirect(`/demo/proposals/${id}?error=${q.error.code}`);
  const quote = await callApi<{ quote_id: string }>("create_quote", [
    s.actorId, detail.data.experience_id, q.data.fixed_pence, q.data.variable_pence, q.data.platform_fee_pence,
    ticket, q.data.minimum_venue_charge_pence, q.data.venue_min_seats, randomUUID()]);
  if (!quote.ok) redirect(`/demo/proposals/${id}?error=${quote.error.code}`);
  back(`/demo/proposals/${id}`, await callApi("revise_proposal",
    [s.actorId, id, detail.data.version, quote.data.quote_id, deadline, randomUUID(), field(form, "idem")]), "REVISED");
}

export async function decide(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  const id = field(form, "proposal_id");
  const decision = field(form, "decision") === "DECLINE" ? "DECLINE" : "ACCEPT";
  back(`/demo/proposals/${id}`, await callApi("respond_to_proposal", [
    s.actorId, id, field(form, "version_id"), Number(field(form, "version")), field(form, "group_id"), decision,
    field(form, "reason_category") || null, field(form, "reason") || null, randomUUID(), field(form, "idem"),
  ]), decision === "ACCEPT" ? "ACCEPTED" : "DECLINED");
}

export async function reserve(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  const id = field(form, "proposal_id");
  back(`/demo/proposals/${id}`, await callApi("reserve_seat", [
    s.actorId, id, field(form, "version_id"), Number(field(form, "version")), field(form, "group_id"),
    form.get("accept_shared") === "on", form.get("adult") === "on", randomUUID(), field(form, "idem"),
  ]), "RESERVED");
}

export async function withdraw(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  const id = field(form, "proposal_id");
  back(`/demo/proposals/${id}`,
       await callApi("withdraw_seat", [s.actorId, field(form, "reservation_id"), randomUUID(), field(form, "idem")]),
       "WITHDRAWN");
}

export async function confirmBooking(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  const id = field(form, "proposal_id");
  back(`/demo/proposals/${id}`, await callApi("confirm_booking",
    [s.actorId, id, Number(field(form, "version")), randomUUID(), field(form, "idem")]), "CONFIRMED");
}

export async function cancelProposal(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  const id = field(form, "proposal_id");
  back(`/demo/proposals/${id}`, await callApi("cancel_proposal",
    [s.actorId, id, field(form, "reason"), randomUUID(), field(form, "idem")]), "CANCELLED");
}

export async function completeProposal(form: FormData): Promise<void> {
  const s = await requireDemoSession();
  const id = field(form, "proposal_id");
  back(`/demo/proposals/${id}`,
       await callApi("complete_proposal", [s.actorId, id, randomUUID(), field(form, "idem")]), "COMPLETED");
}

/**
 * Sandbox helper: lets the fictional organisers and participants of the
 * included groups act, each through the same guarded functions a real person
 * would use. It never bypasses a rule and is unavailable outside DEMO mode.
 */
export async function simulate(form: FormData): Promise<void> {
  const s = await getDemoSession();
  if (!s) redirect("/?error=SANDBOX_EXPIRED");
  const id = field(form, "proposal_id");
  const what = field(form, "what");
  const r = await callApi<{ attempted: number }>("demo_simulate", [s.workspaceId, s.actorId, id, what]);
  back(`/demo/proposals/${id}`, r, "SIMULATED");
}

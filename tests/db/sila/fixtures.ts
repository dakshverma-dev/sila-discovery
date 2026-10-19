import { randomUUID } from "node:crypto";
import type { ApiResult } from "@/lib/db/api";
import { callSila, type SilaFunction } from "@/lib/sila/db";
import { addDays, fromLocal, toLocal } from "@/lib/sila/time";
import { admin, app, key } from "../helpers";

export { admin, app, key };

export interface TestPerson {
  personId: string;
  authUserId: string;
  email: string;
}

/** Calls a `sila_api` function through the least-privilege app login. */
export function sila<T = Record<string, unknown>>(fn: SilaFunction, ...args: unknown[]): Promise<ApiResult<T>> {
  return callSila<T>(fn, args, app);
}

/** Asserts a successful envelope and returns its data. */
export async function okData<T = Record<string, unknown>>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`Expected success, got ${r.error.code}: ${r.error.message}`);
  return r.data;
}

/** Creates a confirmed Supabase Auth user and its Sila person record. */
export async function makePerson(email: string): Promise<TestPerson> {
  const authUserId = randomUUID();
  await admin.query(
    `insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, now(),
             '{}', '{}', now(), now())`,
    [authUserId, email]);
  const person = await okData(sila<{ person_id: string; email: string }>("ensure_person", authUserId));
  return { personId: person.person_id, authUserId, email: person.email };
}

/** Grants the global venue-creation role only; create_venue grants its creator a venue scope. */
export async function makeOperator(email: string): Promise<TestPerson> {
  const person = await makePerson(email);
  await admin.query("insert into sila.operators (email) values ($1) on conflict do nothing", [person.email]);
  return person;
}

export interface TestVenue {
  venueId: string;
  operator: TestPerson;
  coordinator: TestPerson;
  finance: TestPerson;
}

/** Creates a venue (by a new operator) with a signed-up coordinator and finance member. */
export async function makeVenue(name = `Venue ${randomUUID().slice(0, 8)}`): Promise<TestVenue> {
  const operator = await makeOperator(`${randomUUID()}@test.example`);
  const { venue_id: venueId } = await okData(
    sila<{ venue_id: string }>("create_venue", operator.personId, key(), name, "1 Test Street, Glasgow",
                               "Step-free entrance on the side street.", "venue@test.example", "0141 000 0000"));
  const coordinatorEmail = `${randomUUID()}@test.example`;
  const financeEmail = `${randomUUID()}@test.example`;
  await okData(sila("add_venue_member", operator.personId, key(), venueId, coordinatorEmail, "coordinator"));
  await okData(sila("add_venue_member", operator.personId, key(), venueId, financeEmail, "finance"));
  return { venueId, operator, coordinator: await makePerson(coordinatorEmail), finance: await makePerson(financeEmail) };
}

const DAY_MS = 86_400_000;

/**
 * Inserts a published session directly (admin), bypassing publication gates.
 * Overrides use column names; pass `venue` to reuse an existing venue.
 */
export async function publishedSession(
  overrides: Record<string, unknown> & { venue?: TestVenue } = {},
): Promise<{ sessionId: string; venue: TestVenue }> {
  const { venue: given, ...columns } = overrides;
  const venue = given ?? (await makeVenue());
  const now = Date.now();
  const at = (days: number, extraMs = 0) => new Date(now + days * DAY_MS + extraMs).toISOString();
  const row: Record<string, unknown> = {
    venue_id: venue.venueId,
    phase: "published",
    title: "Printmaking for clubs",
    starts_at: at(30),
    ends_at: at(30, 2 * 3_600_000),
    price_minor: 3500,
    minimum: 16,
    capacity: 20,
    max_clubs: 2,
    deposit_bp: 2500,
    payment_window_days: 5,
    fill_by: at(7),
    decision_by: at(14),
    balance_due_at: at(15),
    resource_name: "Print room",
    hold_expires_at: at(14),
    hold_checked_by: "coordinator",
    hold_checked_at: at(0),
    venue_terms_version: "venue-v1",
    venue_terms_text: "Synthetic venue terms for tests.",
    platform_terms_version: "platform-v1",
    access_facts_reviewed: true,
    run_at_minimum_approved: true,
    calendar_version: "test-calendar",
    published_at: at(0),
    created_by: venue.coordinator.personId,
    ...columns,
  };
  const names = Object.keys(row);
  // Column names come from test code only; still refuse anything that is not a plain identifier.
  if (names.some((n) => !/^[a-z_]+$/.test(n))) throw new Error("Invalid column override");
  const { rows } = await admin.query<{ id: string }>(
    `insert into sila.sessions (${names.join(", ")}) values (${names.map((_, i) => `$${i + 1}`).join(", ")})
     returning id`,
    names.map((n) => row[n]),
  );
  return { sessionId: rows[0]!.id, venue };
}

export interface TestPlan {
  planId: string;
  planRef: string;
  sessionId: string;
  venue: TestVenue;
  organiser: TestPerson;
}

/**
 * Submits a club request through `sila_api.submit_plan` as a new organiser
 * (or `organiser`), on a new published session unless `session` is given.
 */
export async function submittedPlan(
  options: {
    session?: { sessionId: string; venue: TestVenue };
    organiser?: TestPerson;
    clubName?: string;
    places?: number;
    source?: string | null;
  } = {},
): Promise<TestPlan> {
  const session = options.session ?? (await publishedSession());
  const organiser = options.organiser ?? (await makePerson(`${randomUUID()}@test.example`));
  const plan = await okData(
    sila<{ plan_id: string; plan_ref: string }>("submit_plan", organiser.personId, key(), session.sessionId,
                                                options.clubName ?? "Thursday Book Club", options.places ?? 8,
                                                options.source === undefined ? null : options.source));
  return { planId: plan.plan_id, planRef: plan.plan_ref, sessionId: session.sessionId, venue: session.venue,
           organiser };
}

type PlanOptions = NonNullable<Parameters<typeof submittedPlan>[0]> & { termsVersion?: number };

/** A submitted plan approved by the venue coordinator for `places` (default 8) at terms version 1. */
export async function approvedPlan(options: PlanOptions = {}): Promise<TestPlan & { approvalId: string }> {
  const plan = await submittedPlan(options);
  const { approval_id: approvalId } = await okData(
    sila<{ approval_id: string }>("approve_plan", plan.venue.coordinator.personId, key(), plan.planId,
                                  options.places ?? 8, options.termsVersion ?? 1));
  return { ...plan, approvalId };
}

/** An approved plan committed by its organiser through `sila_api.commit_plan` (no payment scheduling). */
export async function committedPlan(options: PlanOptions = {}): Promise<TestPlan & { allocationId: string }> {
  const plan = await approvedPlan(options);
  const { allocation_id: allocationId } = await okData(
    sila<{ allocation_id: string }>("commit_plan", plan.organiser.personId, key(), plan.planId,
                                    options.places ?? 8, options.termsVersion ?? 1));
  return { ...plan, allocationId };
}

/** London wall time `hour:minute` on the date `days` from today (London), as an ISO instant. */
export function londonAt(days: number, hour: number, minute: number): string {
  return fromLocal(addDays(toLocal(new Date()).date, days), hour, minute).toISOString();
}

export interface OpenedSession {
  sessionId: string;
  venue: TestVenue;
  /** One committed plan per entry of `places`, in commitment order. */
  plans: (TestPlan & { allocationId: string })[];
  paymentOpenedAt: string;
  payBy: string;
  verifyBy: string;
}

/**
 * A published session whose clubs commit `places` (default one club of 16, the
 * minimum) with payment opened three days ago at a staffed 11:45 release
 * (internal `sila.release_payment_opening` with an explicit clock). Pay-by
 * defaults to 12:00 London in two days, verify-by to 12:00 in three days.
 */
export async function openedSession(
  options: { places?: number[]; payBy?: string; verifyBy?: string; session?: Record<string, unknown> } = {},
): Promise<OpenedSession> {
  const session = await publishedSession(options.session ?? {});
  const plans: OpenedSession["plans"] = [];
  for (const places of options.places ?? [16]) plans.push(await committedPlan({ session, places }));
  const scheduledFor = londonAt(-3, 11, 45);
  await admin.query("update sila.sessions set payment_scheduled_for = $2 where id = $1",
                    [session.sessionId, scheduledFor]);
  const payBy = options.payBy ?? londonAt(2, 12, 0);
  const verifyBy = options.verifyBy ?? londonAt(3, 12, 0);
  const { rows } = await admin.query<{ result: ApiResult<{ payment_opened_at: string }> }>(
    "select sila.release_payment_opening($1::uuid, $2::timestamptz, $3::timestamptz, $4::timestamptz) as result",
    [session.sessionId, new Date(new Date(scheduledFor).getTime() + 60_000).toISOString(), payBy, verifyBy]);
  const opened = rows[0]!.result;
  if (!opened.ok) throw new Error(`Payment did not open: ${opened.error.code}`);
  return { sessionId: session.sessionId, venue: session.venue, plans, paymentOpenedAt: opened.data.payment_opened_at,
           payBy, verifyBy };
}

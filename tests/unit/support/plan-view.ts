import type { MyPlanView } from "@/lib/sila/commands/plans";

/** A synthetic organiser plan view (the §29 worked session) for unit tests; overrides apply to the session, then the view. */
export function planView(overrides: Partial<MyPlanView["session"]> = {}, rest: Partial<MyPlanView> = {}): MyPlanView {
  return {
    status: "review_conditions",
    plan: {
      id: "00000000-0000-4000-8000-0000000000aa",
      plan_ref: "PL1042",
      club_name: "Club A",
      requested_places: 7,
      source: "unknown",
      status: "submitted",
      declined_reason: null,
      version: 3,
    },
    session: {
      id: "00000000-0000-4000-8000-0000000000bb",
      title: "Printmaking",
      description: null,
      inclusions: null,
      meeting_point: "Main reception",
      starts_at: "2026-11-19T18:00:00+00:00",
      ends_at: "2026-11-19T20:00:00+00:00",
      price_minor: 3500,
      minimum: 16,
      capacity: 20,
      max_clubs: 2,
      deposit_bp: 2500,
      fill_by: "2026-11-04T12:00:00+00:00",
      decision_by: "2026-11-12T12:00:00+00:00",
      phase: "published",
      intake_open: true,
      committed_places: 0,
      venue: {
        name: "Edinburgh Print Studio",
        address: "23 High Street, Edinburgh",
        access_facts: "Step-free entrance on the lane.",
        contact_email: "hello@venue.example",
        contact_phone: "0131 555 0100",
      },
      ...overrides,
    },
    terms: {
      terms_version: 1,
      venue_terms_version: "v1",
      venue_terms_text: "Cancel up to 7 days before.",
      platform_terms_version: "p1",
      balance_due_at: "2026-11-13T12:00:00+00:00",
      payment_window_days: 5,
      allocation_id: null,
      released_places: 0,
    },
    messages: [],
    facts: {
      submitted: true, approved: true, committed: false, closed: false, minimumReached: false,
      openingBlocked: false, paymentOpened: false, ownPaymentReported: false, ownDepositVerified: false,
      allDepositsVerified: false, confirmed: false, balanceDefaultEstablished: false, amendmentPending: false,
    },
    approval: { approved_places: 7, terms_version: 1 },
    allocation: null,
    payment: {
      scheduled_for: null, blocked_reason: null, opened_at: null, pay_by: null, verify_by: null,
      payment_route: null, reports: [], verified_deposit_minor: null,
    },
    booking: null,
    ...rest,
  };
}

/** Club A (7 places) committed, payment open, nothing reported yet. */
export const depositDueView: MyPlanView = planView(
  { committed_places: 7 },
  {
    status: "deposit_due",
    terms: { ...planView().terms, allocation_id: "00000000-0000-4000-8000-0000000000cc" },
    allocation: {
      places: 7, total_minor: 24500, deposit_minor: 6125, balance_minor: 18375,
      accepted_decision_by: "2026-11-12T12:00:00+00:00", status: "live",
    },
    payment: {
      scheduled_for: "2026-11-05T11:45:00+00:00",
      blocked_reason: null,
      opened_at: "2026-11-05T11:45:00+00:00",
      pay_by: "2026-11-10T12:00:00+00:00",
      verify_by: "2026-11-11T12:00:00+00:00",
      payment_route: "Sort code 00-00-00, account 00000000",
      reports: [],
      verified_deposit_minor: null,
    },
  },
);

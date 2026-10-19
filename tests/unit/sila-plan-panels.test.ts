import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanPanel } from "@/components/sila/plan/plan-panel";
import type { PlanKeys } from "@/components/sila/plan/types";
import type { MyPlanView } from "@/lib/sila/commands/plans";
import type { PlanStatus } from "@/lib/sila/status";
import { depositDueView, planView } from "./support/plan-view";

const NOW = new Date("2026-10-20T10:00:00Z");
const keys: PlanKeys = { commit: "key-commit-0001", withdraw: "key-withdraw-01", paid: "key-paid-000001", message: "key-message-001" };

function html(view: MyPlanView, now = NOW): string {
  return renderToStaticMarkup(createElement(PlanPanel, { view, now, keys, flash: null }));
}
const text = (markup: string) =>
  markup.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const committed = planView(
  { committed_places: 7 },
  {
    allocation: {
      places: 7, total_minor: 24500, deposit_minor: 6125, balance_minor: 18375,
      accepted_decision_by: "2026-11-12T12:00:00+00:00", status: "live",
    },
  },
);

/** One view per viewer-facing status, built from the same synthetic plan. */
const byStatus: Partial<Record<PlanStatus, MyPlanView>> = {
  waiting_for_venue_approval: planView({}, { status: "waiting_for_venue_approval", approval: null }),
  review_conditions: planView({}, { status: "review_conditions" }),
  waiting_for_more_places: { ...committed, status: "waiting_for_more_places" },
  payment_scheduled: {
    ...committed, status: "payment_scheduled",
    payment: { ...committed.payment, scheduled_for: "2026-11-05T11:45:00+00:00" },
  },
  payment_delayed: { ...committed, status: "payment_delayed", payment: { ...committed.payment, blocked_reason: "NO_COVERAGE" } },
  deposit_due: depositDueView,
  verification_pending: {
    ...depositDueView, status: "verification_pending",
    payment: {
      ...depositDueView.payment,
      reports: [{ report_id: "r1", allocation_id: "a1", kind: "deposit", amount_minor: 6125, reference: "REF-1",
                  reported_at: "2026-11-06T09:00:00+00:00" }],
    },
  },
  waiting_for_another_deposit: {
    ...depositDueView, status: "waiting_for_another_deposit",
    payment: { ...depositDueView.payment, verified_deposit_minor: 6125 },
  },
  waiting_for_confirmation: {
    ...depositDueView, status: "waiting_for_confirmation",
    payment: { ...depositDueView.payment, verified_deposit_minor: 6125 },
  },
  confirmed: {
    ...depositDueView, status: "confirmed", booking: { booking_ref: "SL1042" },
    payment: { ...depositDueView.payment, verified_deposit_minor: 6125 },
  },
  not_proceeding: planView({ phase: "closed", intake_open: false }, {
    status: "not_proceeding", terms: { ...planView().terms, released_places: 7 },
    allocation: { ...committed.allocation!, status: "released" },
  }),
};

describe("plan panels", () => {
  it("O3 offers the conditional commit button with the minimum in it", () => {
    const markup = html(byStatus.review_conditions!);
    expect(text(markup)).toContain("Commit 7 places if the session reaches 16");
    expect(markup).toContain('name="idempotency_key" value="key-commit-0001"');
    expect(markup).toContain('name="terms_version" value="1"');
  });

  it("O3 hides the commit button once the session has filled and keeps the details", () => {
    const filled = planView({ committed_places: 16, intake_open: false }, { status: "review_conditions" });
    const t = text(html(filled));
    expect(t).not.toContain("Commit 7 places");
    expect(t).toContain("This session has filled before you committed. Your details are kept — ask the venue about another session.");
  });

  it("O3 after an earlier withdrawal says committing again is a new commitment", () => {
    const view = planView({}, { status: "review_conditions", allocation: { ...committed.allocation!, status: "withdrawn" } });
    expect(text(html(view))).toContain("You withdrew earlier. Committing again creates a new conditional commitment.");
  });

  it("O5 asks for the payment, carries the allocation id and the post-opening withdraw wording", () => {
    const markup = html(depositDueView);
    const t = text(markup);
    expect(t).toContain("Pay your group deposit");
    expect(t).toContain("GBP 61.25 due");
    expect(t).toContain("Pay Edinburgh Print Studio directly.");
    expect(t).toContain("Bank transfer must reach the venue by Tuesday 10 November at 12:00 London.");
    expect(t).toContain("Ask to withdraw (the venue's cancellation policy applies)");
    expect(markup).toContain('name="allocation_id" value="00000000-0000-4000-8000-0000000000cc"');
    expect(markup).toContain('name="expected_version" value="3"');
  });

  it("O2 offers withdrawal before payment opens", () => {
    const t = text(html(byStatus.waiting_for_more_places!));
    expect(t).toContain("9 more needed to reach 16 · Maximum 20");
    expect(t).toContain("Withdraw before payment opens");
  });

  it("O6 counts live plus released places and says no payment was requested", () => {
    const t = text(html(byStatus.not_proceeding!, new Date("2026-11-05T12:00:00Z")));
    expect(t).toContain("This session will not go ahead");
    expect(t).toContain("7 of 16 needed places");
    expect(t).toContain("The fill deadline passed on Wednesday 4 November at 12:00 London.");
    expect(t).toContain("Your 7 conditional places are released. No payment was requested.");
  });

  it("O4 keeps the club's own money and nothing of another club", () => {
    const t = text(html(byStatus.confirmed!));
    expect(t).toContain("Booking SL1042");
    expect(t).toContain("Deposit GBP 61.25 received");
    expect(t).toContain("You manage this club booking. Other clubs cannot see your invoice or messages.");
  });

  it("only the confirmed panel says confirmed, apart from the guide's 'not confirmed' lines", () => {
    for (const [status, view] of Object.entries(byStatus)) {
      const t = text(html(view!)).replace(/This session is not confirmed\./g, "");
      const mentions = /confirmed/i.test(t);
      expect({ status, mentions }).toEqual({ status, mentions: status === "confirmed" });
    }
  });

  it("every state offers a way to message the venue or contact it", () => {
    for (const [status, view] of Object.entries(byStatus)) {
      expect({ status, link: /tab=messages|mailto:|tel:/.test(html(view!)) }).toEqual({ status, link: true });
    }
  });
});

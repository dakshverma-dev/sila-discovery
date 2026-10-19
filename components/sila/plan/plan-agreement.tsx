import type { MyPlanView } from "@/lib/sila/commands/plans";
import { formatGBP, groupAmounts } from "@/lib/sila/money";
import { london, sessionWhen } from "@/lib/sila/plan-copy";
import { FactList } from "./parts";

const ALLOCATION_STATUS = { live: "Committed", withdrawn: "Withdrawn", released: "Released" } as const;

/** What this club has agreed to, with the venue's conditions and the platform terms version. */
export function PlanAgreement({ view }: { view: MyPlanView }) {
  const { plan, session, approval, allocation, terms } = view;
  const places = allocation?.places ?? approval?.approved_places ?? plan.requested_places;
  const amounts = allocation
    ? { totalMinor: allocation.total_minor, depositMinor: allocation.deposit_minor, balanceMinor: allocation.balance_minor }
    : groupAmounts(session.price_minor, places, session.deposit_bp);
  return (
    <section className="stack-lg" aria-labelledby="agreement-heading">
      <div className="stack">
        <h2 id="agreement-heading">Agreement</h2>
        <FactList
          rows={[
            { label: "Plan reference", value: plan.plan_ref },
            { label: "Session", value: `${session.title} at ${session.venue.name}` },
            { label: "Date", value: sessionWhen(view) },
            { label: "Club and places", value: `${plan.club_name} · ${places} places` },
            {
              label: "Amounts",
              value: (
                <>
                  Group total {formatGBP(amounts.totalMinor)}
                  <br />
                  Deposit {formatGBP(amounts.depositMinor)} if the minimum is reached
                  <br />
                  Balance {formatGBP(amounts.balanceMinor)} due {london(terms.balance_due_at)}
                </>
              ),
            },
            {
              label: "Deadlines",
              value: (
                <>
                  Fill by {london(session.fill_by)}
                  <br />
                  Final decision {london(allocation?.accepted_decision_by ?? session.decision_by)}
                </>
              ),
            },
            { label: "Session terms", value: `Version ${terms.terms_version}` },
            ...(allocation ? [{ label: "Your commitment", value: ALLOCATION_STATUS[allocation.status] }] : []),
          ]}
        />
      </div>

      <div id="venue-conditions" className="stack-sm">
        <h3>Venue conditions and withdrawal policy</h3>
        {terms.venue_terms_version ? <p className="muted">Version {terms.venue_terms_version}</p> : null}
        {terms.venue_terms_text ? (
          <p className="pn-pre">{terms.venue_terms_text}</p>
        ) : (
          <p>The venue has not added conditions text to this session. Message the venue if you need it.</p>
        )}
      </div>

      <div id="platform-terms" className="stack-sm">
        <h3>Sila platform terms</h3>
        <p>{terms.platform_terms_version ? `Version ${terms.platform_terms_version}` : "No version is recorded for this session."}</p>
      </div>
    </section>
  );
}

import { formatGBP, groupAmounts } from "@/lib/sila/money";
import { commitGate, london, sessionWhen } from "@/lib/sila/plan-copy";
import { Box, FactList } from "./parts";
import { CommitForm } from "./plan-forms";
import { planHref, type PanelProps } from "./types";

/** O3 — Review the conditional commitment (§13). */
export function ReviewConditionsPanel({ view, now, keys, flash }: PanelProps) {
  const { plan, session, approval, terms, allocation } = view;
  if (!approval) return null; // review_conditions implies an approval
  const places = approval.approved_places;
  const amounts = groupAmounts(session.price_minor, places, session.deposit_bp);
  const gate = commitGate(view, now);
  const withdrewEarlier = allocation?.status === "withdrawn";

  return (
    <section className="stack" aria-labelledby="panel-heading">
      <header className="stack-sm">
        <h2 id="panel-heading">Commit conditionally</h2>
        <p className="muted">
          {session.title} · Session terms version {approval.terms_version}
        </p>
      </header>

      <FactList
        rows={[
          { label: "Date and group", value: `${sessionWhen(view)} · ${plan.club_name} · ${places} places` },
        ]}
      />

      <Box>
        <strong>Your group total {formatGBP(amounts.totalMinor)}</strong>
        <span>Deposit {formatGBP(amounts.depositMinor)} if minimum met</span>
        <span>
          Balance {formatGBP(amounts.balanceMinor)} due {london(terms.balance_due_at)}
        </span>
      </Box>

      <p>
        <strong>Minimum {session.minimum}. This session is not confirmed. No payment is due now.</strong>
      </p>

      <FactList
        rows={[
          {
            label: "Deadlines you accept",
            value: (
              <>
                Fill by {london(session.fill_by)}
                <br />
                Final decision {london(session.decision_by)}
              </>
            ),
          },
        ]}
      />
      <p>
        I can wait until this decision date. Payment opens at the next eligible midday, with at least five calendar days
        to pay.
      </p>
      <p className="pn-links">
        <a href={planHref(plan.id, { tab: "agreement" }, "#venue-conditions")}>Venue conditions and withdrawal policy</a>
        <a href={planHref(plan.id, { tab: "agreement" }, "#platform-terms")}>Sila platform terms</a>
      </p>

      {withdrewEarlier ? <p className="muted">You withdrew earlier. Committing again creates a new conditional commitment.</p> : null}

      {gate.open ? (
        <CommitForm
          planId={plan.id}
          idemKey={keys.commit}
          places={places}
          termsVersion={approval.terms_version}
          minimum={session.minimum}
          flash={flash}
        />
      ) : (
        <p className="callout callout-warning" role="status">
          {gate.message}
        </p>
      )}

      <p>
        <a className="link-button" href={planHref(plan.id, { tab: "messages", prefill: "quantity" }, "#message")}>
          Ask for a different quantity
        </a>
      </p>
    </section>
  );
}

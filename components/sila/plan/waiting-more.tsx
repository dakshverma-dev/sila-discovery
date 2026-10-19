import { formatGBP } from "@/lib/sila/money";
import { conditionalClubUpdate, london, placesStillNeeded, sessionWhen } from "@/lib/sila/plan-copy";
import { PLAN_STATUS_COPY } from "@/lib/sila/status";
import { CopyButton } from "./copy-button";
import { Box, FactList } from "./parts";
import { WithdrawControl } from "./plan-forms";
import { planHref, type PanelProps } from "./types";

/** O2 — After the organiser commits, while the minimum is not yet reached (§06). */
export function WaitingMorePanel({ view, keys, flash }: PanelProps) {
  const { plan, session, allocation } = view;
  if (!allocation) return null; // waiting_for_more_places implies a live allocation
  const needed = placesStillNeeded(view);
  return (
    <section className="stack" aria-labelledby="panel-heading">
      <h2 id="panel-heading">{PLAN_STATUS_COPY.waiting_for_more_places.label}</h2>

      <Box>
        <strong>{allocation.places} places conditionally committed</strong>
        <span>
          {needed} more needed to reach {session.minimum} · Maximum {session.capacity}
        </span>
        <span>
          Session so far: {session.committed_places} of {session.minimum} needed places.
        </span>
        <span>This session is not confirmed.</span>
      </Box>

      <FactList
        rows={[
          {
            label: "Your group",
            value: (
              <>
                {plan.club_name} · {allocation.places} places · {formatGBP(allocation.total_minor)}
                <br />
                {sessionWhen(view)}
              </>
            ),
          },
          {
            label: "Deadlines",
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
        <strong>No deposit due yet.</strong>
      </p>
      <p>
        If the minimum is reached, we schedule payment opening. You then have at least five calendar days to pay. You can
        withdraw before payment opens.
      </p>

      <div className="pn-actions">
        <CopyButton text={conditionalClubUpdate(view)} label="Copy conditional club update" />
        <a className="link-button" href={planHref(plan.id, { tab: "messages" }, "#message")}>
          Message the venue
        </a>
      </div>

      <WithdrawControl
        planId={plan.id}
        idemKey={keys.withdraw}
        version={plan.version}
        paymentOpen={false}
        places={allocation.places}
        flash={flash}
      />
    </section>
  );
}

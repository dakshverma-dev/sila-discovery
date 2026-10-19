import { formatGBP, groupAmounts } from "@/lib/sila/money";
import { PLAN_STATUS_COPY } from "@/lib/sila/status";
import { sessionWhen } from "@/lib/sila/plan-copy";
import { Box, FactList } from "./parts";
import { planHref, type PanelProps } from "./types";

/** Request sent, venue has not approved the quantity yet (§05). */
export function WaitingApprovalPanel({ view }: PanelProps) {
  const { plan, session } = view;
  const total = groupAmounts(session.price_minor, plan.requested_places, session.deposit_bp).totalMinor;
  return (
    <section className="stack" aria-labelledby="panel-heading">
      <h2 id="panel-heading">{PLAN_STATUS_COPY.waiting_for_venue_approval.label}</h2>
      <Box>
        <strong>
          {plan.requested_places} places requested · {formatGBP(total)}
        </strong>
        <span>
          Your request is with the venue. It reserves nothing and commits no one, and nothing is due.
        </span>
      </Box>
      <FactList
        rows={[
          { label: "Your group", value: `${plan.club_name} · ${plan.requested_places} places · ${formatGBP(total)}` },
          { label: "Session", value: sessionWhen(view) },
        ]}
      />
      <p>{PLAN_STATUS_COPY.waiting_for_venue_approval.nextAction}</p>
      <p>
        <a className="link-button" href={planHref(plan.id, { tab: "messages" }, "#message")}>
          Message the venue
        </a>
      </p>
    </section>
  );
}

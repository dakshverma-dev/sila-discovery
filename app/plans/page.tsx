import { Metrics, PageTitle, WorkspaceShell } from "@/components/sila/application/primitives";
import type { Metadata } from "next";
import Link from "next/link";
import { AccountBar } from "@/components/sila/account-bar";
import { SiteHeader } from "@/components/sila/chrome";
import { requireSilaActor } from "@/lib/sila/auth";
import { listMyPlans } from "@/lib/sila/commands/plans";
import { formatLondonDay } from "@/lib/sila/forms";
import { PLAN_STATUS_COPY } from "@/lib/sila/status";

export const metadata: Metadata = { title: "Your plans" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const actor = await requireSilaActor("/plans");
  const result = await listMyPlans(actor);
  if (!result.ok) throw new Error(`list_my_plans failed: ${result.error.code}`);
  const { plans } = result.data;

  return (
    <>
      <SiteHeader />
      <main id="main"><WorkspaceShell organisation="Your club plans" role="Club organiser" nav={[{label:"My plans",href:"/plans",current:true},{label:"My account",href:"/account"}]}><div className="sa-authenticated stack-lg">
        <PageTitle kicker="Club organiser" title="Your plans" description="Requests and commitments you manage for your clubs."/>
        <Metrics items={[{label:"Your plans",value:plans.length,detail:"Only the clubs you organise"},{label:"Requests",value:plans.filter(p=>p.plan_status==="waiting_for_venue_approval").length,detail:"Awaiting a venue decision"},{label:"Commitments",value:plans.filter(p=>p.facts.committed && !p.facts.closed).length,detail:"See each plan for its booking status"}]}/>


        {plans.length === 0 ? (
          <p>You have no plans yet. Open a venue&apos;s session link to request places for your club.</p>
        ) : (
          <ul className="plain-list pn-list sa-live-plan-list">
            {plans.map((p) => {
              const status = p.status === "declined" ? "The venue could not approve this request" : PLAN_STATUS_COPY[p.plan_status].label;
              return (
                <li key={p.id}>
                  <Link href={`/plans/${p.id}`} className="pn-list-link">
                    <span className="kicker">
                      {p.plan_ref} · {p.club_name}
                    </span>
                    <span className="pn-list-title">{p.session.title}</span>
                    <span>
                      {formatLondonDay(new Date(p.session.starts_at))} · {p.requested_places} places requested
                    </span>
                    <span className="pn-list-status">{status}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <AccountBar email={actor.email} />
      </div></WorkspaceShell></main>
    </>
  );
}

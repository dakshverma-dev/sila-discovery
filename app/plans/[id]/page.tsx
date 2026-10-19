import { WorkspaceShell } from "@/components/sila/application/primitives";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountBar } from "@/components/sila/account-bar";
import { SiteHeader } from "@/components/sila/chrome";
import { PlanAgreement } from "@/components/sila/plan/plan-agreement";
import type { FormFlash } from "@/components/sila/plan/plan-forms";
import { PlanMessages, type MessagePrefill } from "@/components/sila/plan/plan-messages";
import { PlanPanel } from "@/components/sila/plan/plan-panel";
import { planHref, type PlanKeys } from "@/components/sila/plan/types";
import { requireSilaActor } from "@/lib/sila/auth";
import { getMyPlan } from "@/lib/sila/commands/plans";
import { sessionWhen } from "@/lib/sila/plan-copy";

export const metadata: Metadata = { title: "Your plan" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTICES: Record<string, string> = {
  committed: "Your places are conditionally committed. No payment is due now.",
  withdrawn: "You withdrew. Your places are released and nothing was charged.",
  withdraw_requested: "Your withdrawal request has gone to the venue. Its cancellation policy applies.",
  paid_reported: "Payment reported. Verification pending.",
  message_sent: "Message sent.",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "messages", label: "Messages" },
  { id: "agreement", label: "Agreement" },
] as const;
type Tab = (typeof TABS)[number]["id"];

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const FLASH_FIELDS = ["reason", "amount", "reference", "body"];
const PREFILLS: MessagePrefill[] = ["quantity", "session", "change"];

function flashFrom(sp: Search): FormFlash | null {
  const form = one(sp.form);
  const code = one(sp.error);
  if (!form || !code || !/^[a-z]{3,12}$/.test(form) || !/^[A-Z_]{3,40}$/.test(code)) return null;
  const amount = one(sp.amount) ?? "";
  return {
    form,
    code,
    fields: (one(sp.fe) ?? "").split(",").filter((f) => FLASH_FIELDS.includes(f)),
    values: {
      amount: /^[\d.£ ]{0,12}$/.test(amount) ? amount : undefined,
      reference: one(sp.reference)?.slice(0, 100),
    },
  };
}

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const tabParam = one(sp.tab);
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "overview";

  const actor = await requireSilaActor(`/plans/${id}${tab === "overview" ? "" : `?tab=${tab}`}`);
  const loaded = await getMyPlan(actor, id);
  if (!loaded.ok) {
    if (loaded.error.code === "NOT_FOUND") notFound();
    throw new Error(`get_my_plan failed: ${loaded.error.code}`);
  }
  const view = loaded.data;
  const now = new Date();

  // Fresh keys on every render: a double submit of one rendered form replays;
  // a form shown again after a rejection carries a new key.
  const keys: PlanKeys = { commit: randomUUID(), withdraw: randomUUID(), paid: randomUUID(), message: randomUUID() };
  const flash = flashFrom(sp);
  const notice = NOTICES[one(sp.notice) ?? ""];
  const prefillParam = one(sp.prefill) as MessagePrefill | undefined;
  const prefill: MessagePrefill = prefillParam && PREFILLS.includes(prefillParam) ? prefillParam : "";

  return (
    <>
      <SiteHeader />
      <main id="main"><WorkspaceShell organisation={view.plan.club_name} role="Club organiser" nav={[{label:"My plans",href:"/plans",current:true},{label:"My account",href:"/account"}]}><div className="sa-authenticated stack-lg">
        <p className="crumbs">
          <Link href="/plans">All your plans</Link>
        </p>

        <header className="stack-sm">
          <p className="kicker">
            {view.plan.plan_ref} · {view.plan.club_name}
          </p>
          <h1 className="page-title">{view.session.title}</h1>
          <p className="dek">
            {sessionWhen(view)} · {view.session.venue.name}
          </p>
        </header>

        <nav aria-label="Plan sections" className="pn-tabs">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={planHref(id, t.id === "overview" ? {} : { tab: t.id })}
              aria-current={t.id === tab ? "page" : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {notice ? (
          <p className="flash flash-notice" role="status">
            {notice}
          </p>
        ) : null}

        {tab === "overview" ? <PlanPanel view={view} now={now} keys={keys} flash={flash} /> : null}
        {tab === "messages" ? (
          <PlanMessages view={view} idemKey={keys.message} prefill={prefill} flash={flash} />
        ) : null}
        {tab === "agreement" ? <PlanAgreement view={view} /> : null}

        <AccountBar email={actor.email} />
      </div></WorkspaceShell></main>
    </>
  );
}

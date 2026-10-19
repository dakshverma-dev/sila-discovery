import type { Metadata } from "next";
import { AccountBar } from "@/components/sila/account-bar";
import { SiteHeader } from "@/components/sila/chrome";
import { requireSilaActor } from "@/lib/sila/auth";

export const metadata: Metadata = { title: "Account" };
// Per-user: rendered at request time, never prerendered at build.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const actor = await requireSilaActor("/account");
  return (
    <>
      <SiteHeader />
      <main id="main" className="page stack-lg">
        <h1 className="page-title">Account</h1>
        <AccountBar email={actor.email} />
      </main>
    </>
  );
}

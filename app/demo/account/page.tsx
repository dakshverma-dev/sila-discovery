import Link from "next/link";
import { Flash, SubmitButton } from "@/components/ui";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { deleteAccount } from "../actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await requireDemoSession();
  return (
    <main id="main" className="page stack-lg">
      <p>
        <Link href="/demo">← Dashboard</Link>
      </p>
      <h1>Your data</h1>
      <Flash error={error} />
      <section className="surface stack" aria-labelledby="export-h">
        <h2 id="export-h">Export</h2>
        <p>
          Download everything this persona has provided or done: memberships, briefs it wrote, decisions,
          reservations, consent choices and its own actions. Other people&apos;s details are never included.
        </p>
        <p>
          <a href="/api/v1/me/export" download="my-data.json">
            Download my data (JSON)
          </a>
        </p>
      </section>
      <section className="surface stack" aria-labelledby="delete-h">
        <h2 id="delete-h">Delete this account</h2>
        <ul>
          <li>Seats on sessions the venue has not confirmed are released.</li>
          <li>Confirmed bookings are kept under a pseudonym so the venue can handle them.</li>
          <li>Private notes about references are removed and consents are revoked.</li>
          <li>You are signed out of this persona.</li>
        </ul>
        <form action={deleteAccount} className="stack-sm">
          <label className="choice">
            <input type="checkbox" name="confirm" required /> I understand this cannot be undone.
          </label>
          <SubmitButton variant="destructive">Delete this account</SubmitButton>
        </form>
      </section>
    </main>
  );
}

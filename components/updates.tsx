import Link from "next/link";
import { callApi } from "@/lib/db/api";
import { formatDateTime } from "@/lib/ui/format";

interface Update {
  id: string;
  at: string;
  action: string;
  proposal_id: string;
  experience_title: string;
  reason: string | null;
}

const ACTION_COPY: Record<string, string> = {
  "proposal.published": "Terms published",
  "proposal.revised": "Terms revised: earlier decisions and seats no longer apply",
  "proposal.ready": "Enough seats reserved; waiting for venue confirmation",
  "proposal.open": "No longer ready; more reservations or acceptances needed",
  "proposal.confirmed": "Venue confirmed the reservation booking (no payment collected)",
  "proposal.cancelled": "Cancelled",
  "proposal.expired": "Reservation deadline passed",
  "proposal.completed": "Session recorded as delivered",
  "proposal.review_requested": "An organiser sent a suggestion for venue review",
};

/** In-app status updates (T13). Server component. */
export async function Updates({ actorId, workspaceId }: { actorId: string; workspaceId: string }) {
  const r = await callApi<{ updates: Update[] }>("list_my_updates", [actorId, workspaceId, 8]);
  if (!r.ok || r.data.updates.length === 0) return null;
  return (
    <section className="surface stack-sm" aria-labelledby="updates-h">
      <h2 id="updates-h">Updates</h2>
      <ul className="plain-list stack-sm">
        {r.data.updates.map((u) => (
          <li key={u.id}>
            <Link href={`/demo/proposals/${u.proposal_id}`}>{u.experience_title}</Link>: {ACTION_COPY[u.action] ?? u.action}
            {u.reason ? ` (reason: ${u.reason})` : ""}
            <span className="muted"> · {formatDateTime(u.at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

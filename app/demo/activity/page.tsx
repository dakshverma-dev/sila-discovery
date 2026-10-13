import Link from "next/link";
import { Flash } from "@/components/ui";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import { formatDateTime } from "@/lib/ui/format";

interface AuditEvent {
  id: string;
  action: string;
  object_id: string | null;
  created_at: string;
  actor: string | null;
}

export default async function ActivityPage() {
  const session = await requireDemoSession();
  const r = await callApi<{ events: AuditEvent[] }>("list_audit_events", [session.actorId, session.workspaceId, 100]);
  return (
    <main id="main" className="page stack-lg">
      <p>
        <Link href="/demo">← Dashboard</Link>
      </p>
      <h1>Activity</h1>
      {!r.ok ? (
        <Flash error={r.error.code} />
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="muted">Most recent 100 audited actions in this sandbox. Payloads are not shown.</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {r.data.events.map((e) => (
                <tr key={e.id}>
                  <td>{formatDateTime(e.created_at)}</td>
                  <td>{e.actor ?? "System"}</td>
                  <td>
                    <code>{e.action}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

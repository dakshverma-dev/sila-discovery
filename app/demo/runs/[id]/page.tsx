import Link from "next/link";
import { Flash, SourceBadge } from "@/components/ui";
import type { RunResult } from "@/lib/agent/run";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import { formatGbp } from "@/lib/domain/money";
import { COPY, GROUP_BLOCKER_COPY, SLOT_BLOCKER_COPY } from "@/lib/ui/copy";
import { errorMessage } from "@/lib/ui/errors";
import { formatDateTime, formatSlot } from "@/lib/ui/format";

interface RunView {
  id: string;
  state: "QUEUED" | "RUNNING" | "NEEDS_INPUT" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  source_mode: "live" | "synthetic";
  error_code: string | null;
  checkpoint: { stage?: string };
  result: RunResult | null;
}

const STAGE_COPY: Record<string, string> = {
  inputs_frozen: "Inputs frozen",
  evidence: "Cultural evidence gathered",
  solved: "Feasible coalitions ranked",
};

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireDemoSession();
  const r = await callApi<RunView>("get_match_run", [session.actorId, id]);
  if (!r.ok) {
    return (
      <main id="main" className="page stack">
        <Flash error={r.error.code} />
        <Link href="/demo">Back to dashboard</Link>
      </main>
    );
  }
  const run = r.data;
  const pending = run.state === "QUEUED" || run.state === "RUNNING";

  return (
    <main id="main" className="page stack-lg">
      {/* Plain refresh keeps the page usable without client JavaScript while the job runs. */}
      {pending && <meta httpEquiv="refresh" content="2" />}
      <p>
        <Link href="/demo">← Dashboard</Link>
      </p>
      <header className="card-header">
        <h1>Shared session suggestions</h1>
        <SourceBadge mode={run.source_mode} />
      </header>

      <div role="status" aria-live="polite" className="surface stack-sm">
        {pending && (
          <p>
            Finding options… {run.checkpoint.stage ? STAGE_COPY[run.checkpoint.stage] ?? "" : "Queued"}. This page
            refreshes automatically.
          </p>
        )}
        {run.state === "FAILED" && (
          <p className="flash flash-error">
            {run.error_code === "QLOO_UNAVAILABLE" ? COPY.qlooOutage : errorMessage(run.error_code ?? undefined)}
          </p>
        )}
        {run.state === "SUCCEEDED" && run.result && (
          <p>
            {run.result.outcome === "CANDIDATES"
              ? `${run.result.feasible_count} feasible option${run.result.feasible_count === 1 ? "" : "s"} found; showing up to three. Nothing is published until the venue reviews it.`
              : "No shared session meets every requirement. Requirements were not relaxed to force a match."}
          </p>
        )}
      </div>

      {run.result && run.result.candidates.length > 0 && (
        <section className="stack" aria-labelledby="options-h">
          <h2 id="options-h">Options to compare</h2>
          <ol className="plain-list stack">
            {run.result.candidates.map((c) => (
              <li key={c.proposal_id} className="surface stack-sm">
                <div className="card-header">
                  <h3>
                    Option {c.rank}: {c.experience_title}
                  </h3>
                  <span className="badge">{c.status === "DRAFT" ? "Draft" : "Needs review"}</span>
                </div>
                <dl className="terms">
                  <dt>Session</dt>
                  <dd>{formatSlot(c.slot_start_at, c.slot_end_at)}</dd>
                  <dt>Groups</dt>
                  <dd>{c.group_names.join(", ")}</dd>
                  <dt>All-in price</dt>
                  <dd>{formatGbp(c.ticket_pence)} per person</dd>
                  <dt>Attendance</dt>
                  <dd>
                    About {c.planned_seats} expected; {c.required_seats} individual reservations needed
                  </dd>
                </dl>
                <p>
                  <Link href={`/demo/proposals/${c.proposal_id}`}>Inspect reasons and send for venue review</Link>
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {run.result && (run.result.own_blockers.length > 0 || run.result.slot_blockers.length > 0) && (
        <section className="surface stack" aria-labelledby="blockers-h">
          <h2 id="blockers-h">Sessions that did not fit</h2>
          <ul className="plain-list stack-sm">
            {run.result.own_blockers.map((b) => (
              <li key={`own-${b.experience_title}-${b.slot_start_at}`}>
                <strong>{b.experience_title}</strong>, {formatDateTime(b.slot_start_at)}:{" "}
                {b.blockers.map((x) => GROUP_BLOCKER_COPY[x]).join(" ")}
              </li>
            ))}
            {run.result.slot_blockers.map((b) => (
              <li key={`slot-${b.experience_title}-${b.slot_start_at}`}>
                <strong>{b.experience_title}</strong>, {formatDateTime(b.slot_start_at)}:{" "}
                {b.blockers.map((x) => SLOT_BLOCKER_COPY[x]).join(" ")}
              </li>
            ))}
          </ul>
          <p className="muted">Only your own group&apos;s reasons are shown; other groups&apos; details stay private.</p>
        </section>
      )}
    </main>
  );
}

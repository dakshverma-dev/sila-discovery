import Link from "next/link";
import { Band } from "@/components/sila/band";
import { ArrowLeft } from "@/components/sila/chrome";
import { Flash, SourceBadge } from "@/components/ui";
import type { RunResult } from "@/lib/agent/run";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import { formatGbp } from "@/lib/domain/money";
import { lookFor } from "@/lib/ui/sila/art";
import { durationWords, fd, GLYPH, timeRange } from "@/lib/ui/sila/view";
import { COPY, GROUP_BLOCKER_COPY, SLOT_BLOCKER_COPY } from "@/lib/ui/copy";
import { errorMessage } from "@/lib/ui/errors";
import { formatDateTime } from "@/lib/ui/format";

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
        <Link href="/demo">Back to all experiences</Link>
      </main>
    );
  }
  const run = r.data;
  const pending = run.state === "QUEUED" || run.state === "RUNNING";
  const candidates = run.result?.candidates ?? [];

  return (
    <main id="main">
      {/* Plain refresh keeps the page usable without client JavaScript while the job runs. */}
      {pending && <meta httpEquiv="refresh" content="2" />}
      <div className="wrap" style={{ paddingTop: "clamp(20px,3vw,40px)" }}>
        <div className="af-top" style={{ borderBottomColor: "var(--ink)" }}>
          <Link href="/demo">
            <ArrowLeft />
            All experiences
          </Link>
          <SourceBadge mode={run.source_mode} />
        </div>
      </div>

      <section aria-labelledby="options-h" className="index" style={{ borderTop: 0 }}>
        <div className="wrap index-head">
          <div className="count">
            <span>{String(candidates.length).padStart(2, "0")}</span>
            <span>
              shared sessions
              <br />
              suggested
            </span>
          </div>
          <div className="index-tools">
            <h1 className="page-title" style={{ fontSize: "clamp(34px,3.4vw,52px)" }}>
              Shared session <em className="it" style={{ color: "var(--ox)" }}>suggestions</em>
            </h1>
            <div role="status" aria-live="polite" className="lede">
              {pending && (
                <p style={{ margin: 0 }}>
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
                <p style={{ margin: 0 }}>
                  {run.result.outcome === "CANDIDATES"
                    ? `${run.result.feasible_count} feasible option${run.result.feasible_count === 1 ? "" : "s"} found; showing up to three. Nothing is published until the venue reviews it.`
                    : "No shared session meets every requirement. Requirements were not relaxed to force a match."}
                </p>
              )}
            </div>
          </div>
        </div>
        {candidates.length > 0 && (
          <h2 id="options-h" className="wrap h-lg" style={{ paddingBottom: 18 }}>
            Options to compare
          </h2>
        )}
        {candidates.map((c) => {
          const look = lookFor(c.experience_title);
          return (
            <Band
              key={c.proposal_id}
              no={c.rank}
              look={look}
              title={c.experience_title}
              regionLabel={`Option ${c.rank}: ${c.experience_title}`}
              href={`/demo/proposals/${c.proposal_id}`}
              linkLabel="Inspect reasons and send for venue review"
              place={`Edinburgh · ${fd(c.slot_start_at)}, ${timeRange(c.slot_start_at, c.slot_end_at)}`}
              description={look.short}
              format={`${durationWords(c.slot_start_at, c.slot_end_at)} · ${formatGbp(c.ticket_pence)} per person`}
              glyph={GLYPH.proposed}
              statusLabel={`Option ${c.rank} · ${c.status === "DRAFT" ? "Draft for venue review" : "Needs review"}`}
              capacity={Math.max(c.planned_seats, c.required_seats)}
              required={c.required_seats}
              reserved={0}
              mine={false}
              demandText={`About ${c.planned_seats} expected; ${c.required_seats} individual reservations needed.`}
              possible="Seats open once the venue publishes the terms."
              pair={c.group_names.join(" + ")}
            />
          );
        })}
      </section>

      {run.result && (run.result.own_blockers.length > 0 || run.result.slot_blockers.length > 0) && (
        <section className="wrap section" aria-labelledby="blockers-h">
          <div className="section-head">
            <h2 id="blockers-h" className="h-xl">
              Sessions that <em>did not fit</em>
            </h2>
            <p>Only your own group&apos;s reasons are shown; other groups&apos; details stay private.</p>
          </div>
          <ul className="rules">
            {run.result.own_blockers.map((b) => (
              <li key={`own-${b.experience_title}-${b.slot_start_at}`}>
                <span>·</span>
                <span>
                  <strong>{b.experience_title}</strong>, {formatDateTime(b.slot_start_at)}:{" "}
                  {b.blockers.map((x) => GROUP_BLOCKER_COPY[x]).join(" ")}
                </span>
              </li>
            ))}
            {run.result.slot_blockers.map((b) => (
              <li key={`slot-${b.experience_title}-${b.slot_start_at}`}>
                <span>·</span>
                <span>
                  <strong>{b.experience_title}</strong>, {formatDateTime(b.slot_start_at)}:{" "}
                  {b.blockers.map((x) => SLOT_BLOCKER_COPY[x]).join(" ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

import { randomUUID } from "node:crypto";
import type { ProposalState, SourceMode } from "@/lib/domain/types";
import { SOURCE_MODE_COPY } from "@/lib/ui/copy";
import { errorMessage, NOTICE_COPY } from "@/lib/ui/errors";

/** Shared presentational components (D18). Server components only. */

const STATE_LABEL: Record<ProposalState, string> = {
  DRAFT: "Draft",
  OPEN: "Open for reservations",
  READY: "Ready for venue confirmation",
  CONFIRMED: "Confirmed by venue",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export function StateBadge({ state }: { state: ProposalState }) {
  return (
    <span className={`badge state-${state.toLowerCase()}`}>
      <span aria-hidden="true" className="badge-dot" />
      {STATE_LABEL[state]}
    </span>
  );
}

export function SourceBadge({ mode }: { mode: SourceMode }) {
  return <span className={`badge source-${mode}`}>{SOURCE_MODE_COPY[mode]}</span>;
}

/** Notice or error carried in the URL after a server action. */
export function Flash({ notice, error }: { notice?: string; error?: string }) {
  const err = errorMessage(error);
  if (err) {
    return (
      <div className="flash flash-error" role="alert">
        <strong>Not completed.</strong> {err}
      </div>
    );
  }
  const note = notice ? NOTICE_COPY[notice] : undefined;
  if (!note) return null;
  return (
    <div className="flash flash-notice" role="status">
      {note}
    </div>
  );
}

/** Render-time Idempotency-Key so a double submission replays rather than repeats. */
export function IdemInput() {
  return <input type="hidden" name="idem" value={randomUUID()} />;
}

export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "destructive";
}) {
  return (
    <button type="submit" className={`button button-${variant}`}>
      {children}
    </button>
  );
}

export function ProgressMeter({ value, required, capacity }: { value: number; required: number; capacity: number }) {
  return (
    <div className="meter-wrap">
      <meter min={0} max={capacity} low={required} optimum={capacity} value={value} aria-describedby="meter-text">
        {value} of {required}
      </meter>
      <p id="meter-text" className="muted">
        {value} individual reservation{value === 1 ? "" : "s"} of {required} needed · capacity {capacity}
      </p>
    </div>
  );
}

const BLOCKER_COPY: Record<string, string> = {
  NOT_PUBLISHED: "The venue has not published these terms.",
  NO_INCLUDED_GROUPS: "No groups are included.",
  ORGANISER_ACCEPTANCE_MISSING: "Not every group organiser has accepted the current terms.",
  SEATS_BELOW_REQUIRED: "Not enough individual seats are reserved yet.",
  SEATS_EXCEED_CAPACITY: "Reservations exceed capacity.",
  DEADLINE_PASSED: "The reservation deadline has passed.",
  QUOTE_NOT_CURRENT: "The venue has issued a newer quote; these terms must be revised.",
  SLOT_NOT_HELD: "The session is not held for this proposal.",
};

export function ReadinessList({ blockers }: { blockers: string[] }) {
  if (blockers.length === 0) {
    return <p>All readiness checks pass. The venue can confirm.</p>;
  }
  return (
    <ul className="checklist">
      {blockers.map((b) => (
        <li key={b}>
          <span aria-hidden="true">○ </span>
          {BLOCKER_COPY[b] ?? b}
        </li>
      ))}
    </ul>
  );
}

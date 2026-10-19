import type { SilaActor } from "@/lib/sila/auth";
import { callSila } from "@/lib/sila/db";
import { formatLondon } from "@/lib/sila/forms";
import { formatGBP } from "@/lib/sila/money";

export interface PracticalSummary {
  booking_ref: string;
  phase: "confirmed" | "cancelled";
  closed_reason: string | null;
  confirmed_at: string;
  generated_at: string;
  title: string;
  starts_at: string;
  ends_at: string;
  balance_due_at: string;
  terms_version: string;
  venue_terms_text: string;
  meeting_point: string | null;
  venue: { name: string; address: string; access_facts: string; contact_email: string | null; contact_phone: string | null };
  groups: { club_name: string; plan_ref: string; places: number; total_minor: number; deposit_minor: number; balance_minor: number }[];
}

export function getPracticalSummary(actor: SilaActor, sessionId: string) {
  return callSila<PracticalSummary>("get_practical_summary", [actor.personId, sessionId]);
}

/** Plain text is readable offline and cannot execute venue-supplied markup (§17, §19). */
export function formatPracticalSummary(s: PracticalSummary): string {
  const when = (at: string) => formatLondon(new Date(at));
  return [
    `Sila · ${s.booking_ref}`,
    s.phase === "cancelled" ? `CANCELLED · ${s.closed_reason ?? "Contact the venue for the reason."}` : "VENUE-CONFIRMED BOOKING",
    `Saved ${when(s.generated_at)}. This copy records the status when saved; check later changes with the venue.`,
    "", s.title, s.venue.name, s.venue.address,
    `Starts ${when(s.starts_at)}`, `Ends ${when(s.ends_at)}`,
    ...(s.meeting_point ? [`Meet at ${s.meeting_point}`] : []),
    `Venue contact: ${[s.venue.contact_email, s.venue.contact_phone].filter(Boolean).join(" · ") || "Ask the venue coordinator"}`,
    `Venue access facts: ${s.venue.access_facts}`,
    "Discuss personal access arrangements directly with the venue; do not send health information to Sila.",
    "", ...s.groups.flatMap((g) => [
      `${g.club_name} · ${g.plan_ref} · ${g.places} places`,
      `Agreed total ${formatGBP(g.total_minor)} · Deposit ${formatGBP(g.deposit_minor)} · Balance ${formatGBP(g.balance_minor)}`,
    ]),
    s.phase === "cancelled" ? "Original amounts above are retained history. Check the current refund record with the venue; this summary does not request payment."
      : `Agreed balance due ${when(s.balance_due_at)}. Ask the venue to verify the current amount outstanding before paying.`,
    "", `Venue terms ${s.terms_version}`, s.venue_terms_text,
    "", "Payments and refunds go directly through the venue. Sila does not hold funds.", "",
  ].join("\n");
}

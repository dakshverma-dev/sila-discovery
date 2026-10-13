import type { ProposalState, SourceMode } from "@/lib/domain/types";
import type { Rationale } from "@/lib/agent/explain";

/** Shapes returned by the scb_api read projections. */

export interface Persona {
  user_id: string;
  display_name: string;
  role: "VENUE_MANAGER" | "ORGANISER" | "PARTICIPANT" | "OPERATOR";
  organisation: string | null;
}

export interface ProposalSummary {
  id: string;
  state: ProposalState;
  version: number;
  proposal_version_id: string;
  experience_title: string;
  slot_start_at: string;
  slot_end_at: string;
  capacity: number;
  required_seats: number;
  active_reservations: number;
  deadline: string | null;
  ticket_pence: number;
  source_mode: SourceMode;
  review_requested_at: string | null;
  group_names: string[];
  payment_status: "NOT_COLLECTED";
  my_reservation?: { id: string; status: string } | null;
}

export interface Brief {
  id: string;
  version: number;
  budget_pence: number;
  expected_seats: number;
  availability: Array<{ start_at: string; end_at: string }>;
  sharing_choice: "WILLING_TO_SHARE" | "PRIVATE_ONLY" | "ASK_FIRST";
  external_query_consent: boolean;
  access_requirements: string[];
  references: Array<{
    input_label: string;
    resolved: boolean;
    declared_meaning: string | null;
    entity_id: string | null;
    subtype: string | null;
  }>;
}

export interface Overview {
  workspace: { id: string; name: string; mode: string; timezone: string; expires_at: string | null };
  is_operator: boolean;
  venues: Array<{
    id: string;
    name: string;
    experiences: Array<{
      id: string;
      title: string;
      description: string;
      approval_status: string;
      access_support: string[];
      is_synthetic: boolean;
      quote: { version: number; ticket_pence: number; venue_min_seats: number } | null;
      anchors: Array<{ entity_id: string; label: string; mapping_reason: string }>;
      slots: Array<{ id: string; start_at: string; end_at: string; capacity: number; status: string }>;
    }>;
    proposals: ProposalSummary[];
  }>;
  organised_groups: Array<{
    id: string;
    name: string;
    public_summary: string;
    member_count: number;
    brief: Brief | null;
    proposals: ProposalSummary[];
  }>;
  participant_groups: Array<{ id: string; name: string; proposals: ProposalSummary[] }>;
}

export interface ProposalDetail extends ProposalSummary {
  terms_hash: string | null;
  published_at: string | null;
  experience_id: string;
  experience_description: string;
  venue_name: string;
  access_support: string[];
  timezone: string;
  currency: "GBP";
  quote_id: string;
  quote_is_current: boolean;
  current_quote: { id: string; version: number; ticket_pence: number };
  group_summaries: Array<{ group_id: string; name: string; summary: string; decision: "ACCEPT" | "DECLINE" | null }>;
  rationale: Rationale | null;
  readiness_blockers: string[] | null;
  superseded_versions: number;
  viewer: {
    is_venue_manager: boolean;
    is_operator: boolean;
    organiser_of: string[];
    member_of: string[];
    my_reservation: { id: string; status: string; group_id: string; proposal_version_id: string } | null;
  };
}

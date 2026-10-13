# Database Schema and Data Model


D15 | Version 0.1 | 12 October 2026


Define the proposed relational model, integrity rules and access strategy.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Data model

| Entity | Key fields | Responsibility |
| --- | --- | --- |
| workspaces | id; mode; city; timezone; expires_at | Pilot exchange or isolated judge sandbox. |
| organisations | id; workspace_id; kind; name | Venue or community organisation. |
| memberships | workspace_id; organisation_id; user_id; role | Venue manager, organiser or participant authority. |
| operator_memberships | workspace_id; user_id | Audited workspace-wide operator access. |
| groups | id; organisation_id; organiser_user_id | Community demand owner. |
| group_memberships | workspace_id; group_id; user_id; role | Explicit organiser or participant membership in a group. |
| invites | workspace_id; group_id; token_hash; expires_at; maximum_uses; uses | Scoped member invitation; raw token never stored. |
| group_briefs | group_id; version; budget_pence; expected_seats; availability; sharing_consent; access_requirements | Immutable structured demand snapshot; optional meaning private. |
| group_references | brief_id; input_label; entity_id; subtype; declared_meaning; resolved | Consented cultural references; ambiguous entries unresolved. |
| experiences | id; venue_organisation_id; version; approval_status; title; access_support | Deliverable venue programme. |
| experience_anchors | experience_id; entity_id; subtype; mapping_reason; approved_by | Venue-reviewed relation to book-domain cultural anchors. |
| quotes | experience_id; version; fixed_pence; variable_pence; platform_fee_pence; ticket_pence; minimum_venue_charge_pence; venue_min_seats | Immutable quoted economics. |
| slots | experience_id; start_at; end_at; capacity; status | Physical delivery capacity and exact UTC time. |
| match_runs | workspace_id; requested_by; state; snapshot_hash; lease_until; call_count; checkpoint | Durable bounded agent job. |
| evidence_records | run_id; source_mode; query_hash; entity_id; rank; fetched_at; expires_at | Minimal returned cultural evidence; private provider data. |
| proposals | workspace_id; slot_id; state; current_version_id; created_by | Lifecycle owner; one active proposal per slot. |
| proposal_versions | proposal_id; version; quote_id; required_seats; deadline; terms_hash | Immutable offered terms. |
| proposal_groups | workspace_id; proposal_version_id; group_id | Validated coalition relation; included_group_ids is an API projection. |
| group_decisions | proposal_version_id; group_id; decision; reason_category; actor_id | Current-version organiser response. |
| reservations | proposal_version_id; slot_id; participant_id; group_id; status | Individual one-seat reservation; unique active participant per slot. |
| audit_events | workspace_id; actor_id; action; object_id; request_id; created_at | Append-only operational trace with redacted payload. |
| idempotency_records | workspace_id; actor_id; route; key_hash; payload_hash; response | Replay control for writes. |
| qloo_cache | workspace_id; query_hash; payload; fetched_at; expires_at | Private cache; segregated from public fixtures. |
| consents | workspace_id; user_id; purpose; version; accepted_at; revoked_at | Independent provider, sharing and optional-input choices. |

## Relationships

A workspace contains organisations. A community organisation owns groups and group briefs. A venue organisation owns experiences, anchor mappings, quotes and slots. Proposals connect one slot to several groups through immutable versions and decisions. Each individual reservation references a current version and the reserving group. Jobs and evidence remain scoped to their workspace.

## Database constraints

- Use composite foreign keys containing workspace_id to prevent references crossing workspace boundaries.
- Ensure every slot belongs to the experience named by its quote and proposal version.
- Enforce positive capacity, nonnegative money and start_at < end_at.
- Use a partial unique index for one active proposal per slot and one active participant reservation per slot.
- Use unique proposal-version and group pairs for decisions; append new revisions rather than overwriting terms.
- Store private meanings and raw provider cache in tables without public grants.

## Access policy

The reference schema enables RLS and denies direct anon and authenticated data-table access until explicit policies are implemented. User-facing reads use reviewed projections. Guarded functions or server services validate membership, ownership and object versions. Service-role access bypasses RLS, so its server code must perform independent authorisation; a route containing a supplied object ID is not sufficient.

## Atomic write functions

| Proposed function | Required transaction |
| --- | --- |
| publish_proposal | Validate manager; invalidate old version; hold slot; insert immutable version and audit. |
| respond_to_proposal | Validate group organiser; upsert current decision; recalculate readiness. |
| reserve_seat | Validate participant; lock rows; enforce capacity and uniqueness; record seat and readiness. |
| withdraw_seat | Release own pre-confirmation seat and recalculate state. |
| confirm_booking | Validate venue; recheck every readiness guard; book slot and write audit. |
| expire_proposals | Check database deadlines; release seats and holds idempotently. |

## Reference schema status

specs/schema.sql is a design reference with entities, constraints and fail-closed permissions. It is not a deploy-ready migration: implement and test the guarded functions and role projections before granting application access. No live database was created by this task.

## Retention and migration

Proposed retention is defined in D19. Use additive reviewed migrations before destructive changes. Preserve version and audit relationships during export and deletion; pseudonymise personal identifiers where a justified record must remain. Verify backup restore and deletion behaviour before a real pilot.

## Related documents

D10, D16, D19, D23

## Sources

- SRC10: Supabase Row Level Security. https://supabase.com/docs/guides/database/postgres/row-level-security

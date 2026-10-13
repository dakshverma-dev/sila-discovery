-- Shared Cultural Bookings v0.1 DESIGN REFERENCE, not a deploy-ready migration.
-- Application access is deliberately denied until reviewed functions, grants,
-- role projections and policy tests are implemented. No payment tables in MVP.
-- Intended environment: Supabase PostgreSQL with auth.users and gen_random_uuid().
create schema if not exists scb;
revoke all on schema scb from anon, authenticated;

create table scb.workspaces (
 id uuid primary key default gen_random_uuid(),
 mode text not null check (mode in ('PILOT','DEMO')),
 city text not null default 'Edinburgh', timezone text not null default 'Europe/London',
 expires_at timestamptz, created_at timestamptz not null default now()
);
create table scb.organisations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references scb.workspaces(id),
 kind text not null check (kind in ('VENUE','COMMUNITY')), name text not null,
 verified boolean not null default false, unique(id,workspace_id)
);
create table scb.memberships (
 workspace_id uuid not null references scb.workspaces(id), organisation_id uuid not null,
 user_id uuid not null references auth.users(id),
 role text not null check (role in ('VENUE_MANAGER','ORGANISER','PARTICIPANT')),
 primary key(organisation_id,user_id),
 foreign key(organisation_id,workspace_id) references scb.organisations(id,workspace_id)
);
create table scb.operator_memberships (
 workspace_id uuid not null references scb.workspaces(id), user_id uuid not null references auth.users(id),
 primary key(workspace_id,user_id)
);
create table scb.groups (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, organisation_id uuid not null,
 organiser_user_id uuid not null references auth.users(id), name text not null,
 unique(id,workspace_id),
 foreign key(organisation_id,workspace_id) references scb.organisations(id,workspace_id)
);
create table scb.group_memberships (
 workspace_id uuid not null, group_id uuid not null, user_id uuid not null references auth.users(id),
 role text not null check(role in ('ORGANISER','PARTICIPANT')),
 primary key(group_id,user_id),
 foreign key(group_id,workspace_id) references scb.groups(id,workspace_id)
);
create table scb.invites (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, group_id uuid not null,
 token_hash text not null unique, expires_at timestamptz not null,
 maximum_uses integer not null check(maximum_uses between 1 and 100),
 uses integer not null default 0 check(uses>=0 and uses<=maximum_uses),
 created_by uuid not null references auth.users(id),
 foreign key(group_id,workspace_id) references scb.groups(id,workspace_id)
);
create table scb.group_briefs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, group_id uuid not null,
 version integer not null check(version>0), budget_pence integer not null check(budget_pence>=0),
 expected_seats integer not null check(expected_seats between 1 and 100),
 availability jsonb not null check(jsonb_typeof(availability)='array'),
 sharing_consent boolean not null, external_query_consent boolean not null,
 access_requirements text[] not null default '{}', created_at timestamptz not null default now(),
 unique(group_id,version), unique(id,workspace_id),
 foreign key(group_id,workspace_id) references scb.groups(id,workspace_id)
);
create table scb.group_references (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, brief_id uuid not null,
 input_label text not null, entity_id text, subtype text, declared_meaning text,
 resolved boolean not null default false,
 check(not resolved or (entity_id is not null and subtype is not null)),
 foreign key(brief_id,workspace_id) references scb.group_briefs(id,workspace_id)
);
create table scb.experiences (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
 venue_organisation_id uuid not null, version integer not null check(version>0),
 title text not null, description text not null,
 approval_status text not null check(approval_status in ('DRAFT','APPROVED')),
 access_support text[] not null default '{}', unique(id,workspace_id),
 foreign key(venue_organisation_id,workspace_id) references scb.organisations(id,workspace_id)
);
create table scb.experience_anchors (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, experience_id uuid not null,
 entity_id text not null, subtype text not null check(subtype='urn:entity:book'),
 mapping_reason text not null, approved_by uuid not null references auth.users(id),
 unique(experience_id,entity_id),
 foreign key(experience_id,workspace_id) references scb.experiences(id,workspace_id)
);
create table scb.quotes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, experience_id uuid not null,
 version integer not null check(version>0), fixed_pence integer not null check(fixed_pence>=0),
 variable_pence integer not null check(variable_pence>=0),
 platform_fee_pence integer not null check(platform_fee_pence>=0),
 ticket_pence integer not null check(ticket_pence>=0),
 minimum_venue_charge_pence integer not null default 0 check(minimum_venue_charge_pence>=0),
 venue_min_seats integer not null check(venue_min_seats>0),
 currency text not null default 'GBP' check(currency='GBP'),
 valid_until timestamptz, created_at timestamptz not null default now(),
 unique(experience_id,version), unique(id,workspace_id,experience_id),
 foreign key(experience_id,workspace_id) references scb.experiences(id,workspace_id)
);
create table scb.slots (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, experience_id uuid not null,
 start_at timestamptz not null, end_at timestamptz not null, capacity integer not null check(capacity>0),
 status text not null check(status in ('AVAILABLE','HELD','BOOKED','CANCELLED')),
 check(start_at<end_at), unique(id,workspace_id,experience_id), unique(id,workspace_id),
 foreign key(experience_id,workspace_id) references scb.experiences(id,workspace_id)
);
create table scb.match_runs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references scb.workspaces(id),
 requested_by uuid not null references auth.users(id),
 state text not null check(state in ('QUEUED','RUNNING','NEEDS_INPUT','SUCCEEDED','FAILED','CANCELLED')),
 snapshot_hash text not null, checkpoint jsonb not null default '{}',
 lease_until timestamptz, call_count integer not null default 0 check(call_count between 0 and 24),
 deadline_at timestamptz not null, error_code text, created_at timestamptz not null default now(),
 unique(id,workspace_id)
);
create table scb.evidence_records (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, run_id uuid not null,
 group_id uuid not null, source_mode text not null check(source_mode in ('live','cached','synthetic','unavailable')),
 query_hash text not null, entity_id text not null, rank integer check(rank>0),
 raw_score double precision, coverage jsonb not null default '{}', explainability jsonb,
 fetched_at timestamptz not null, expires_at timestamptz not null,
 foreign key(run_id,workspace_id) references scb.match_runs(id,workspace_id),
 foreign key(group_id,workspace_id) references scb.groups(id,workspace_id)
);
create table scb.proposals (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
 slot_id uuid not null, experience_id uuid not null, current_version_id uuid,
 state text not null check(state in ('DRAFT','OPEN','READY','CONFIRMED','COMPLETED','EXPIRED','CANCELLED')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(id,workspace_id), unique(id,workspace_id,slot_id,experience_id),
 foreign key(slot_id,workspace_id,experience_id) references scb.slots(id,workspace_id,experience_id)
);
create unique index one_active_proposal_per_slot on scb.proposals(slot_id)
 where state in ('OPEN','READY','CONFIRMED');
create table scb.proposal_versions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, proposal_id uuid not null,
 slot_id uuid not null, experience_id uuid not null, quote_id uuid not null,
 version integer not null check(version>0), required_seats integer not null check(required_seats>0),
 deadline timestamptz not null, terms_hash text not null, terms_snapshot jsonb not null,
 published_at timestamptz, superseded_at timestamptz,
 unique(proposal_id,version), unique(id,proposal_id,workspace_id), unique(id,workspace_id,slot_id),
 foreign key(proposal_id,workspace_id,slot_id,experience_id) references scb.proposals(id,workspace_id,slot_id,experience_id),
 foreign key(quote_id,workspace_id,experience_id) references scb.quotes(id,workspace_id,experience_id)
);
alter table scb.proposals add constraint current_version_owned
 foreign key(current_version_id,id,workspace_id)
 references scb.proposal_versions(id,proposal_id,workspace_id) deferrable initially deferred;
-- Use an explicit relation, not an unchecked UUID array, for coalition membership.
create table scb.proposal_groups (
 workspace_id uuid not null, proposal_version_id uuid not null, slot_id uuid not null, group_id uuid not null,
 primary key(proposal_version_id,group_id), unique(proposal_version_id,group_id,workspace_id),
 foreign key(proposal_version_id,workspace_id,slot_id) references scb.proposal_versions(id,workspace_id,slot_id),
 foreign key(group_id,workspace_id) references scb.groups(id,workspace_id)
);
create table scb.group_decisions (
 workspace_id uuid not null, proposal_version_id uuid not null, group_id uuid not null,
 decision text not null check(decision in ('ACCEPT','DECLINE')), reason_category text, reason text,
 actor_id uuid not null references auth.users(id), updated_at timestamptz not null default now(),
 primary key(proposal_version_id,group_id),
 foreign key(proposal_version_id,group_id,workspace_id) references scb.proposal_groups(proposal_version_id,group_id,workspace_id)
);
create table scb.reservations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, proposal_version_id uuid not null,
 slot_id uuid not null, participant_id uuid not null references auth.users(id), group_id uuid not null,
 status text not null check(status in ('RESERVED','WITHDRAWN','INVALIDATED','CANCELLED','ATTENDED','NO_SHOW')),
 accept_shared_session boolean not null check(accept_shared_session),
 adult_declaration boolean not null check(adult_declaration),
 payment_status text not null default 'NOT_COLLECTED' check(payment_status='NOT_COLLECTED'),
 created_at timestamptz not null default now(),
 foreign key(proposal_version_id,workspace_id,slot_id) references scb.proposal_versions(id,workspace_id,slot_id),
 foreign key(proposal_version_id,group_id,workspace_id) references scb.proposal_groups(proposal_version_id,group_id,workspace_id)
);
create unique index one_active_seat_per_person_slot on scb.reservations(slot_id,participant_id)
 where status='RESERVED';
create table scb.audit_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references scb.workspaces(id),
 actor_id uuid references auth.users(id) on delete set null,
 action text not null, object_id uuid, request_id uuid not null,
 metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table scb.idempotency_records (
 workspace_id uuid not null references scb.workspaces(id), actor_id uuid not null references auth.users(id),
 route text not null, key_hash text not null, payload_hash text not null,
 response jsonb not null, expires_at timestamptz not null,
 primary key(workspace_id,actor_id,route,key_hash)
);
create table scb.qloo_cache (
 workspace_id uuid not null references scb.workspaces(id), query_hash text not null,
 payload jsonb not null, fetched_at timestamptz not null, expires_at timestamptz not null,
 primary key(workspace_id,query_hash)
);
create table scb.consents (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references scb.workspaces(id),
 user_id uuid not null references auth.users(id),
 purpose text not null check(purpose in ('EXTERNAL_TASTE_QUERY','SHARED_SESSION','OPTIONAL_MEANING')),
 notice_version text not null, accepted_at timestamptz, revoked_at timestamptz,
 check(accepted_at is not null or revoked_at is not null)
);

-- Fail-closed policy baseline. No browser access until the designed permissions
-- and transactions are implemented. Never grant unrestricted service access to UI.
do $$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='scb' loop
  execute format('alter table scb.%I enable row level security',t.tablename);
  execute format('revoke all on table scb.%I from anon, authenticated',t.tablename);
 end loop;
end $$;

-- Remaining implementation gates:
-- 1. Guarded publish, decision, reserve, withdraw, confirm and expire functions.
-- 2. Consistent proposal/slot lock order and payload-hashed idempotency.
-- 3. Explicit organisation-kind and organiser/group membership checks.
-- 4. Immutability triggers for quotes, brief snapshots and published terms;
--    append-only audit permissions and material-change invalidation.
-- 5. Column-safe role projections and reviewed grants; test service-role paths.
-- 6. Deadline/consent/member/capacity checks at every reservation and confirmation.
-- 7. Worker lease recovery, retention, export and erasure functions.
-- 8. Run application T01-T23 before enabling a real pilot.

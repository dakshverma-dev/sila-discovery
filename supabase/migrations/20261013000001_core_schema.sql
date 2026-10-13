-- Core relational model for Shared Cultural Bookings (D15), adapted from
-- specs/schema.sql. Tables live in the private `scb` schema; browsers and the
-- application role have no direct table access. All writes go through the
-- guarded functions in `scb_api` (see the following migrations).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists scb;
revoke all on schema scb from public, anon, authenticated;

-- Application identities. Real people link to auth.users; fictional judge
-- sandbox personas are synthetic and confined to one DEMO workspace (DEC15).
create table scb.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (length(display_name) between 1 and 120),
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (not (is_synthetic and auth_user_id is not null))
);

create table scb.workspaces (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('PILOT', 'DEMO')),
  name text not null,
  city text not null default 'Edinburgh',
  timezone text not null default 'Europe/London',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (mode <> 'DEMO' or expires_at is not null)
);

create table scb.organisations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references scb.workspaces(id) on delete cascade,
  kind text not null check (kind in ('VENUE', 'COMMUNITY')),
  name text not null check (length(name) between 1 and 150),
  verified boolean not null default false,
  unique (id, workspace_id),
  unique (id, workspace_id, kind)
);

create table scb.memberships (
  workspace_id uuid not null,
  organisation_id uuid not null,
  user_id uuid not null references scb.users(id) on delete cascade,
  role text not null check (role in ('VENUE_MANAGER', 'ORGANISER', 'PARTICIPANT')),
  primary key (organisation_id, user_id),
  foreign key (organisation_id, workspace_id) references scb.organisations(id, workspace_id) on delete cascade
);

create table scb.operator_memberships (
  workspace_id uuid not null references scb.workspaces(id) on delete cascade,
  user_id uuid not null references scb.users(id) on delete cascade,
  primary key (workspace_id, user_id)
);

create table scb.groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  organisation_id uuid not null,
  organiser_user_id uuid not null references scb.users(id),
  name text not null check (length(name) between 1 and 150),
  -- Approved summary other included groups may see (BR17).
  public_summary text not null default '' check (length(public_summary) <= 2000),
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (organisation_id, workspace_id) references scb.organisations(id, workspace_id) on delete cascade
);

create table scb.group_memberships (
  workspace_id uuid not null,
  group_id uuid not null,
  user_id uuid not null references scb.users(id) on delete cascade,
  role text not null check (role in ('ORGANISER', 'PARTICIPANT')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  foreign key (group_id, workspace_id) references scb.groups(id, workspace_id) on delete cascade
);

create table scb.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  group_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  maximum_uses integer not null check (maximum_uses between 1 and 100),
  uses integer not null default 0 check (uses >= 0 and uses <= maximum_uses),
  created_by uuid not null references scb.users(id),
  foreign key (group_id, workspace_id) references scb.groups(id, workspace_id) on delete cascade
);

-- Immutable demand snapshots; a change creates a new version.
create table scb.group_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  group_id uuid not null,
  version integer not null check (version > 0),
  budget_pence integer not null check (budget_pence >= 0),
  expected_seats integer not null check (expected_seats between 1 and 100),
  availability jsonb not null check (jsonb_typeof(availability) = 'array'),
  sharing_choice text not null check (sharing_choice in ('WILLING_TO_SHARE', 'PRIVATE_ONLY', 'ASK_FIRST')),
  external_query_consent boolean not null,
  access_requirements text[] not null default '{}',
  created_by uuid not null references scb.users(id),
  created_at timestamptz not null default now(),
  unique (group_id, version),
  unique (id, workspace_id),
  foreign key (group_id, workspace_id) references scb.groups(id, workspace_id) on delete cascade
);

create table scb.group_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brief_id uuid not null,
  input_label text not null check (length(input_label) between 1 and 200),
  entity_id text,
  subtype text,
  declared_meaning text check (length(declared_meaning) <= 1000),
  resolved boolean not null default false,
  check (not resolved or (entity_id is not null and subtype is not null)),
  foreign key (brief_id, workspace_id) references scb.group_briefs(id, workspace_id) on delete cascade
);

create table scb.experiences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  venue_organisation_id uuid not null,
  version integer not null default 1 check (version > 0),
  title text not null check (length(title) between 1 and 150),
  description text not null check (length(description) <= 2000),
  approval_status text not null check (approval_status in ('DRAFT', 'APPROVED')),
  access_support text[] not null default '{}',
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (venue_organisation_id, workspace_id) references scb.organisations(id, workspace_id) on delete cascade
);

create table scb.experience_anchors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  experience_id uuid not null,
  entity_id text not null,
  label text not null,
  subtype text not null check (subtype = 'urn:entity:book'),
  mapping_reason text not null check (length(mapping_reason) between 1 and 1000),
  approved_by uuid not null references scb.users(id),
  unique (experience_id, entity_id),
  foreign key (experience_id, workspace_id) references scb.experiences(id, workspace_id) on delete cascade
);

create table scb.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  experience_id uuid not null,
  version integer not null check (version > 0),
  fixed_pence integer not null check (fixed_pence >= 0),
  variable_pence integer not null check (variable_pence >= 0),
  platform_fee_pence integer not null check (platform_fee_pence >= 0),
  ticket_pence integer not null check (ticket_pence >= 0),
  minimum_venue_charge_pence integer not null default 0 check (minimum_venue_charge_pence >= 0),
  venue_min_seats integer not null check (venue_min_seats > 0),
  currency text not null default 'GBP' check (currency = 'GBP'),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  unique (experience_id, version),
  unique (id, workspace_id, experience_id),
  foreign key (experience_id, workspace_id) references scb.experiences(id, workspace_id) on delete cascade
);

create table scb.slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  experience_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'HELD', 'BOOKED', 'CANCELLED')),
  check (start_at < end_at),
  unique (id, workspace_id, experience_id),
  unique (id, workspace_id),
  foreign key (experience_id, workspace_id) references scb.experiences(id, workspace_id) on delete cascade
);

create table scb.match_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references scb.workspaces(id) on delete cascade,
  requested_by uuid not null references scb.users(id),
  state text not null check (state in ('QUEUED', 'RUNNING', 'NEEDS_INPUT', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  source_mode text not null check (source_mode in ('live', 'cached', 'synthetic', 'unavailable')),
  snapshot_hash text not null,
  snapshot jsonb not null default '{}',
  checkpoint jsonb not null default '{}',
  result jsonb,
  lease_until timestamptz,
  attempts integer not null default 0,
  call_count integer not null default 0 check (call_count between 0 and 24),
  deadline_at timestamptz not null,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table scb.evidence_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  group_id uuid not null,
  source_mode text not null check (source_mode in ('live', 'cached', 'synthetic', 'unavailable')),
  query_hash text not null,
  entity_id text not null,
  rank integer check (rank > 0),
  raw_score double precision,
  coverage jsonb not null default '{}',
  explainability jsonb,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  foreign key (run_id, workspace_id) references scb.match_runs(id, workspace_id) on delete cascade,
  foreign key (group_id, workspace_id) references scb.groups(id, workspace_id) on delete cascade
);

create table scb.proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  slot_id uuid not null,
  experience_id uuid not null,
  run_id uuid,
  current_version_id uuid,
  state text not null check (state in ('DRAFT', 'OPEN', 'READY', 'CONFIRMED', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
  source_mode text not null default 'unavailable' check (source_mode in ('live', 'cached', 'synthetic', 'unavailable')),
  rationale jsonb not null default '{}',
  created_by uuid not null references scb.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (id, workspace_id, slot_id, experience_id),
  foreign key (slot_id, workspace_id, experience_id) references scb.slots(id, workspace_id, experience_id) on delete cascade,
  foreign key (run_id, workspace_id) references scb.match_runs(id, workspace_id) on delete set null (run_id)
);

-- BR08: only one OPEN, READY or CONFIRMED proposal can hold a slot.
create unique index one_active_proposal_per_slot on scb.proposals (slot_id)
  where state in ('OPEN', 'READY', 'CONFIRMED');

create table scb.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  proposal_id uuid not null,
  slot_id uuid not null,
  experience_id uuid not null,
  quote_id uuid not null,
  version integer not null check (version > 0),
  required_seats integer not null check (required_seats > 0),
  deadline timestamptz,
  terms_hash text,
  terms_snapshot jsonb,
  published_at timestamptz,
  published_by uuid references scb.users(id),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  check (published_at is null or (deadline is not null and terms_hash is not null and terms_snapshot is not null)),
  unique (proposal_id, version),
  unique (id, proposal_id, workspace_id),
  unique (id, workspace_id, slot_id),
  foreign key (proposal_id, workspace_id, slot_id, experience_id)
    references scb.proposals(id, workspace_id, slot_id, experience_id) on delete cascade,
  foreign key (quote_id, workspace_id, experience_id) references scb.quotes(id, workspace_id, experience_id) on delete cascade
);

alter table scb.proposals add constraint current_version_owned
  foreign key (current_version_id, id, workspace_id)
  references scb.proposal_versions(id, proposal_id, workspace_id) deferrable initially deferred;

create table scb.proposal_groups (
  workspace_id uuid not null,
  proposal_version_id uuid not null,
  slot_id uuid not null,
  group_id uuid not null,
  brief_id uuid not null,
  primary key (proposal_version_id, group_id),
  unique (proposal_version_id, group_id, workspace_id),
  foreign key (proposal_version_id, workspace_id, slot_id)
    references scb.proposal_versions(id, workspace_id, slot_id) on delete cascade,
  foreign key (group_id, workspace_id) references scb.groups(id, workspace_id) on delete cascade,
  foreign key (brief_id, workspace_id) references scb.group_briefs(id, workspace_id) on delete cascade
);

create table scb.group_decisions (
  workspace_id uuid not null,
  proposal_version_id uuid not null,
  group_id uuid not null,
  decision text not null check (decision in ('ACCEPT', 'DECLINE')),
  reason_category text check (reason_category in ('SUBJECT', 'INTERPRETATION', 'COST', 'TIME', 'ACCESS', 'SHARING', 'OTHER')),
  reason text check (length(reason) <= 1000),
  actor_id uuid not null references scb.users(id),
  updated_at timestamptz not null default now(),
  primary key (proposal_version_id, group_id),
  foreign key (proposal_version_id, group_id, workspace_id)
    references scb.proposal_groups(proposal_version_id, group_id, workspace_id) on delete cascade
);

create table scb.reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  proposal_version_id uuid not null,
  slot_id uuid not null,
  participant_id uuid not null references scb.users(id),
  group_id uuid not null,
  status text not null check (status in ('RESERVED', 'WITHDRAWN', 'INVALIDATED', 'CANCELLED', 'ATTENDED', 'NO_SHOW')),
  accept_shared_session boolean not null check (accept_shared_session),
  adult_declaration boolean not null check (adult_declaration),
  payment_status text not null default 'NOT_COLLECTED' check (payment_status = 'NOT_COLLECTED'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (proposal_version_id, workspace_id, slot_id)
    references scb.proposal_versions(id, workspace_id, slot_id) on delete cascade,
  foreign key (proposal_version_id, group_id, workspace_id)
    references scb.proposal_groups(proposal_version_id, group_id, workspace_id) on delete cascade
);

-- BR09: one active seat per person per slot, whatever their group memberships.
create unique index one_active_seat_per_person_slot on scb.reservations (slot_id, participant_id)
  where status = 'RESERVED';

create table scb.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references scb.workspaces(id) on delete cascade,
  actor_id uuid references scb.users(id) on delete set null,
  action text not null,
  object_id uuid,
  request_id uuid not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table scb.idempotency_records (
  workspace_id uuid not null references scb.workspaces(id) on delete cascade,
  actor_id uuid not null references scb.users(id) on delete cascade,
  route text not null,
  key_hash text not null,
  payload_hash text not null,
  response jsonb not null,
  expires_at timestamptz not null,
  primary key (workspace_id, actor_id, route, key_hash)
);

create table scb.qloo_cache (
  workspace_id uuid not null references scb.workspaces(id) on delete cascade,
  query_hash text not null,
  payload jsonb not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (workspace_id, query_hash)
);

create table scb.consents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references scb.workspaces(id) on delete cascade,
  user_id uuid not null references scb.users(id) on delete cascade,
  purpose text not null check (purpose in ('EXTERNAL_TASTE_QUERY', 'SHARED_SESSION', 'OPTIONAL_MEANING')),
  notice_version text not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (accepted_at is not null or revoked_at is not null)
);

create index on scb.proposals (workspace_id, state);
create index on scb.reservations (proposal_version_id) where status = 'RESERVED';
create index on scb.group_memberships (user_id);
create index on scb.memberships (user_id);
create index on scb.audit_events (workspace_id, created_at);
create index on scb.match_runs (state, lease_until);

-- Immutability (BR07): quotes and brief snapshots never change once written.
create function scb.forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'IMMUTABLE_RECORD: % rows cannot be modified', tg_table_name
    using errcode = 'P0001';
end $$;

create trigger quotes_immutable before update on scb.quotes
  for each row execute function scb.forbid_mutation();
create trigger group_briefs_immutable before update on scb.group_briefs
  for each row execute function scb.forbid_mutation();
-- Direct deletes are blocked; workspace purges cascade (trigger depth >= 1).
create trigger quotes_no_direct_delete before delete on scb.quotes
  for each row when (pg_trigger_depth() < 1) execute function scb.forbid_mutation();
create trigger group_briefs_no_direct_delete before delete on scb.group_briefs
  for each row when (pg_trigger_depth() < 1) execute function scb.forbid_mutation();

-- Published proposal terms are frozen; only supersession may be recorded.
create function scb.guard_published_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.published_at is not null and (
       new.quote_id is distinct from old.quote_id
    or new.required_seats is distinct from old.required_seats
    or new.deadline is distinct from old.deadline
    or new.terms_hash is distinct from old.terms_hash
    or new.terms_snapshot is distinct from old.terms_snapshot
    or new.published_at is distinct from old.published_at
    or new.slot_id is distinct from old.slot_id) then
    raise exception 'IMMUTABLE_RECORD: published proposal terms cannot change'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger proposal_versions_frozen before update on scb.proposal_versions
  for each row execute function scb.guard_published_version();

-- Audit trail is append-only.
create trigger audit_events_append_only before update or delete on scb.audit_events
  for each row when (pg_trigger_depth() < 1) execute function scb.forbid_mutation();

-- Fail-closed baseline: RLS on, no grants to browser roles.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'scb' loop
    execute format('alter table scb.%I enable row level security', t.tablename);
    execute format('revoke all on table scb.%I from public, anon, authenticated', t.tablename);
  end loop;
end $$;

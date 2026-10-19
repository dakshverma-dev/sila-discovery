-- Sila pilot (Gate B): schema foundations, result envelopes, idempotency,
-- audit, outbox, people, venues, venue membership and operators.
-- Tables have RLS on and no policies; the app role only executes sila_api.

create schema if not exists sila;
create schema if not exists sila_api;
revoke all on schema sila from public, anon, authenticated;
revoke all on schema sila_api from public, anon, authenticated;
alter default privileges in schema sila revoke execute on functions from public;
alter default privileges in schema sila_api revoke execute on functions from public;

-- ---------------------------------------------------------------- tables

create table sila.people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users (id) on delete cascade,
  email text not null check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table sila.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  address text not null check (char_length(trim(address)) > 0),
  time_zone text not null default 'Europe/London',
  access_facts text not null default '',
  contact_email text,
  contact_phone text,
  created_by uuid references sila.people (id) on delete set null,
  created_at timestamptz not null default now()
);

create table sila.venue_members (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references sila.venues (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('coordinator', 'finance')),
  invited_by uuid references sila.people (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index venue_members_live_uq on sila.venue_members (venue_id, email, role)
  where revoked_at is null;
create index venue_members_email_idx on sila.venue_members (email) where revoked_at is null;

create table sila.operators (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table sila.idempotency (
  actor uuid not null,
  key text not null,
  fn text not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor, key)
);

create table sila.audit_events (
  id bigserial primary key,
  venue_id uuid,
  actor uuid,
  command text not null,
  entity text not null,
  entity_id uuid,
  version int,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_events_venue_idx on sila.audit_events (venue_id, created_at);

create table sila.outbox (
  id bigserial primary key,
  topic text not null,
  dedupe_key text unique not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index outbox_pending_idx on sila.outbox (created_at) where processed_at is null;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'sila' loop
    execute format('alter table sila.%I enable row level security', t.tablename);
    execute format('revoke all on table sila.%I from public, anon, authenticated', t.tablename);
  end loop;
end $$;
revoke all on all sequences in schema sila from public, anon, authenticated;

-- ---------------------------------------------------------------- helpers

-- Result envelopes, same shape as scb.ok/err. Business failures are returned,
-- not raised, so an idempotent replay can return the original outcome.
create function sila.ok(p_data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', true, 'data', coalesce(p_data, '{}'::jsonb))
$$;

create function sila.err(p_code text, p_message text, p_details jsonb default '{}')
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', false, 'error', jsonb_build_object(
    'code', p_code, 'message', p_message, 'retryable', false, 'details', coalesce(p_details, '{}'::jsonb)))
$$;

create function sila.request_hash(p_request jsonb) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_request::text, 'sha256'), 'hex')
$$;

-- Returns null when the key is new, the stored result with "replayed": true
-- when the same request is repeated, or IDEMPOTENCY_CONFLICT when the key was
-- used for a different request. Serialised per (actor, key).
create function sila.idem_begin(p_actor uuid, p_key text, p_fn text, p_request jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare rec sila.idempotency;
begin
  if p_key is null or length(p_key) < 8 or length(p_key) > 200 then
    return sila.err('INVALID_FIELDS', 'An idempotency key of 8 to 200 characters is required.',
                    jsonb_build_object('field_errors', jsonb_build_object(
                      'idempotency_key', jsonb_build_array('Use 8 to 200 characters.'))));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sila.idem:' || p_actor::text || ':' || p_key, 0));
  select * into rec from sila.idempotency where actor = p_actor and key = p_key;
  if not found then return null; end if;
  if rec.fn <> p_fn or rec.request_hash <> sila.request_hash(p_request) then
    return sila.err('IDEMPOTENCY_CONFLICT', 'This idempotency key was used with a different request.');
  end if;
  return rec.result || jsonb_build_object('replayed', true);
end $$;

create function sila.idem_finish(p_actor uuid, p_key text, p_fn text, p_request jsonb, p_result jsonb)
returns jsonb language plpgsql set search_path = '' as $$
begin
  insert into sila.idempotency (actor, key, fn, request_hash, result)
  values (p_actor, p_key, p_fn, sila.request_hash(p_request), p_result);
  return p_result;
end $$;

create function sila.audit(p_actor uuid, p_venue uuid, p_command text, p_entity text, p_entity_id uuid,
                           p_version int, p_reason text)
returns void language sql set search_path = '' as $$
  insert into sila.audit_events (actor, venue_id, command, entity, entity_id, version, reason)
  values (p_actor, p_venue, p_command, p_entity, p_entity_id, p_version, p_reason)
$$;

-- Queues a side effect once per dedupe key, inside the caller's transaction.
create function sila.enqueue(p_topic text, p_dedupe_key text, p_payload jsonb)
returns void language sql set search_path = '' as $$
  insert into sila.outbox (topic, dedupe_key, payload)
  values (p_topic, p_dedupe_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (dedupe_key) do nothing
$$;

create function sila.person_email(p_actor uuid) returns text
language sql stable set search_path = '' as $$
  select email from sila.people where id = p_actor
$$;

create function sila.is_operator(p_actor uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from sila.operators o
                 where o.email = sila.person_email(p_actor) and o.revoked_at is null)
$$;

-- Live venue roles, matched on the person's verified (lowercased) email.
create function sila.venue_roles(p_actor uuid, p_venue uuid) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(distinct m.role order by m.role), '{}'::text[])
  from sila.venue_members m
  where m.venue_id = p_venue and m.revoked_at is null and m.email = sila.person_email(p_actor)
$$;

create function sila.normalise_email(p_email text) returns text
language sql immutable set search_path = '' as $$
  select nullif(lower(trim(p_email)), '')
$$;

-- Operator, or a live coordinator of that venue.
create function sila.can_manage_members(p_actor uuid, p_venue uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from sila.venues v where v.id = p_venue)
     and (sila.is_operator(p_actor) or 'coordinator' = any(sila.venue_roles(p_actor, p_venue)))
$$;

create function sila.member_field_errors(p_email text, p_role text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare errors jsonb := '{}';
begin
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 254 then
    errors := errors || jsonb_build_object('email', jsonb_build_array('Enter a valid email address.'));
  end if;
  if p_role is null or p_role not in ('coordinator', 'finance') then
    errors := errors || jsonb_build_object('role', jsonb_build_array('Choose coordinator or finance.'));
  end if;
  return errors;
end $$;

-- ---------------------------------------------------------------- API

-- Links a verified Supabase Auth user to a Sila person. Email is lowercased.
create function sila_api.ensure_person(p_auth_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u record; pid uuid; addr text;
begin
  select id, email, email_confirmed_at into u from auth.users where id = p_auth_user;
  if not found or u.email_confirmed_at is null or sila.normalise_email(u.email) is null then
    return sila.err('AUTH_REQUIRED', 'Sign in with a confirmed email address.');
  end if;
  addr := sila.normalise_email(u.email);
  insert into sila.people (auth_user_id, email) values (p_auth_user, addr)
  on conflict (auth_user_id) do update set email = excluded.email
  returning id into pid;
  return sila.ok(jsonb_build_object('person_id', pid, 'email', addr));
end $$;

create function sila_api.get_my_context(p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p sila.people;
begin
  select * into p from sila.people where id = p_actor;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  return sila.ok(jsonb_build_object(
    'person_id', p.id,
    'email', p.email,
    'is_operator', sila.is_operator(p.id),
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'roles', to_jsonb(r.roles))
                       order by v.name, v.id)
      from sila.venues v
      cross join lateral (select sila.venue_roles(p.id, v.id) as roles) r
      where cardinality(r.roles) > 0
    ), '[]'::jsonb)));
end $$;

create function sila_api.create_venue(p_actor uuid, p_key text, p_name text, p_address text,
                                      p_access_facts text, p_contact_email text, p_contact_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('name', p_name, 'address', p_address, 'access_facts', p_access_facts,
                                      'contact_email', p_contact_email, 'contact_phone', p_contact_phone);
  replay jsonb; errors jsonb := '{}'; vid uuid; result jsonb;
  v_name text := trim(coalesce(p_name, ''));
  v_address text := trim(coalesce(p_address, ''));
  v_email text := sila.normalise_email(p_contact_email);
begin
  if not sila.is_operator(p_actor) then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'create_venue', request);
  if replay is not null then return replay; end if;

  if char_length(v_name) not between 2 and 120 then
    errors := errors || jsonb_build_object('name', jsonb_build_array('Use 2 to 120 characters.'));
  end if;
  if v_address = '' then
    errors := errors || jsonb_build_object('address', jsonb_build_array('Enter the venue address.'));
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    errors := errors || jsonb_build_object('contact_email', jsonb_build_array('Enter a valid email address.'));
  end if;
  if errors <> '{}'::jsonb then
    return sila.idem_finish(p_actor, p_key, 'create_venue', request,
      sila.err('INVALID_FIELDS', 'Check the highlighted fields.', jsonb_build_object('field_errors', errors)));
  end if;

  insert into sila.venues (name, address, access_facts, contact_email, contact_phone, created_by)
  values (v_name, v_address, trim(coalesce(p_access_facts, '')), v_email,
          nullif(trim(coalesce(p_contact_phone, '')), ''), p_actor)
  returning id into vid;
  perform sila.audit(p_actor, vid, 'create_venue', 'venue', vid, null, null);
  result := sila.ok(jsonb_build_object('venue_id', vid));
  return sila.idem_finish(p_actor, p_key, 'create_venue', request, result);
end $$;

create function sila_api.add_venue_member(p_actor uuid, p_key text, p_venue uuid, p_email text, p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  addr text := sila.normalise_email(p_email);
  request jsonb := jsonb_build_object('venue', p_venue, 'email', addr, 'role', p_role);
  replay jsonb; errors jsonb; mid uuid; result jsonb;
begin
  if not sila.can_manage_members(p_actor, p_venue) then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'add_venue_member', request);
  if replay is not null then return replay; end if;

  errors := sila.member_field_errors(addr, p_role);
  if errors <> '{}'::jsonb then
    return sila.idem_finish(p_actor, p_key, 'add_venue_member', request,
      sila.err('INVALID_FIELDS', 'Check the highlighted fields.', jsonb_build_object('field_errors', errors)));
  end if;

  -- An already live invitation for the same email and role is reused.
  insert into sila.venue_members (venue_id, email, role, invited_by)
  values (p_venue, addr, p_role, p_actor)
  on conflict (venue_id, email, role) where revoked_at is null do nothing
  returning id into mid;
  if mid is null then
    select id into mid from sila.venue_members
     where venue_id = p_venue and email = addr and role = p_role and revoked_at is null;
  else
    perform sila.audit(p_actor, p_venue, 'add_venue_member', 'venue_member', mid, null, p_role);
  end if;
  result := sila.ok(jsonb_build_object('member_id', mid));
  return sila.idem_finish(p_actor, p_key, 'add_venue_member', request, result);
end $$;

create function sila_api.revoke_venue_member(p_actor uuid, p_key text, p_venue uuid, p_email text, p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  addr text := sila.normalise_email(p_email);
  request jsonb := jsonb_build_object('venue', p_venue, 'email', addr, 'role', p_role);
  replay jsonb; mid uuid; result jsonb;
begin
  if not sila.can_manage_members(p_actor, p_venue) then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'revoke_venue_member', request);
  if replay is not null then return replay; end if;

  update sila.venue_members set revoked_at = now()
   where venue_id = p_venue and email = addr and role = p_role and revoked_at is null
  returning id into mid;
  if mid is null then
    result := sila.err('NOT_FOUND', 'Not found.');
  else
    perform sila.audit(p_actor, p_venue, 'revoke_venue_member', 'venue_member', mid, null, p_role);
    result := sila.ok(jsonb_build_object('revoked', true));
  end if;
  return sila.idem_finish(p_actor, p_key, 'revoke_venue_member', request, result);
end $$;

-- ---------------------------------------------------------------- grants

-- scb_app (created by 20261013000004) may only execute sila_api functions; it
-- has no usage on schema sila and no table privileges.
revoke all on all functions in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila_api from public, anon, authenticated;
grant usage on schema sila_api to scb_app;
grant execute on all functions in schema sila_api to scb_app;

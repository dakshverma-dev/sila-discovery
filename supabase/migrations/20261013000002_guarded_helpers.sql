-- Internal helpers for the guarded write functions. Not callable by the app role.

create schema if not exists scb_api;
revoke all on schema scb_api from public, anon, authenticated;
alter default privileges in schema scb revoke execute on functions from public;
alter default privileges in schema scb_api revoke execute on functions from public;

-- Result envelopes. Business failures are returned, not raised, so an
-- idempotent replay can return the original outcome (D16).
create function scb.ok(p_data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', true, 'data', coalesce(p_data, '{}'::jsonb))
$$;

create function scb.err(p_code text, p_message text, p_retryable boolean default false, p_details jsonb default '{}')
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', false, 'error', jsonb_build_object(
    'code', p_code, 'message', p_message, 'retryable', p_retryable, 'details', p_details))
$$;

create function scb.sha256(p_text text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(p_text, 'UTF8'), 'sha256'), 'hex')
$$;

-- Mirrors lib/domain/economics.ts requiredSeats (D13).
create function scb.required_seats(
  p_fixed integer, p_variable integer, p_min_charge integer, p_fee integer,
  p_ticket integer, p_min_seats integer, p_capacity integer
) returns integer language plpgsql immutable set search_path = '' as $$
declare n integer; venue bigint; cost bigint;
begin
  for n in p_min_seats .. p_capacity loop
    venue := greatest(p_fixed::bigint + p_variable::bigint * n, p_min_charge::bigint);
    cost := venue + p_fee::bigint * n;
    if p_ticket::bigint * n >= cost then return n; end if;
  end loop;
  return null;
end $$;

create function scb.quote_required_seats(p_quote_id uuid, p_capacity integer) returns integer
language sql stable set search_path = '' as $$
  select scb.required_seats(q.fixed_pence, q.variable_pence, q.minimum_venue_charge_pence,
    q.platform_fee_pence, q.ticket_pence, q.venue_min_seats, p_capacity)
  from scb.quotes q where q.id = p_quote_id
$$;

-- A quote is current when it is the experience's latest version and unexpired.
create function scb.quote_is_current(p_quote_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((
    select (q.valid_until is null or q.valid_until > now())
       and not exists (select 1 from scb.quotes n
                       where n.experience_id = q.experience_id and n.version > q.version)
    from scb.quotes q where q.id = p_quote_id), false)
$$;

create function scb.is_operator(p_actor uuid, p_workspace uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from scb.operator_memberships
                 where user_id = p_actor and workspace_id = p_workspace)
$$;

create function scb.is_venue_manager(p_actor uuid, p_venue_org uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from scb.memberships m
                 join scb.organisations o on o.id = m.organisation_id
                 where m.user_id = p_actor and m.organisation_id = p_venue_org
                   and m.role = 'VENUE_MANAGER' and o.kind = 'VENUE')
$$;

create function scb.is_group_organiser(p_actor uuid, p_group uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from scb.groups g where g.id = p_group and g.organiser_user_id = p_actor)
      or exists (select 1 from scb.group_memberships gm
                 where gm.group_id = p_group and gm.user_id = p_actor and gm.role = 'ORGANISER')
$$;

create function scb.is_group_member(p_actor uuid, p_group uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from scb.group_memberships gm
                 where gm.group_id = p_group and gm.user_id = p_actor)
      or exists (select 1 from scb.groups g where g.id = p_group and g.organiser_user_id = p_actor)
$$;

create function scb.proposal_venue(p_proposal uuid) returns uuid
language sql stable set search_path = '' as $$
  select e.venue_organisation_id from scb.proposals p
  join scb.experiences e on e.id = p.experience_id where p.id = p_proposal
$$;

-- Viewer relationship to a proposal: venue manager, operator, organiser of an
-- included group, or (once published) a member of one. Others see NOT_FOUND.
create function scb.can_view_proposal(p_actor uuid, p_proposal uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from scb.proposals p
    where p.id = p_proposal and (
      scb.is_venue_manager(p_actor, scb.proposal_venue(p.id))
      or scb.is_operator(p_actor, p.workspace_id)
      or exists (select 1 from scb.proposal_groups pg
                 where pg.proposal_version_id = p.current_version_id
                   and scb.is_group_organiser(p_actor, pg.group_id))
      -- Participants see only published proposals, never drafts under review.
      or (p.state <> 'DRAFT' and exists (
                 select 1 from scb.proposal_groups pg
                 where pg.proposal_version_id = p.current_version_id
                   and scb.is_group_member(p_actor, pg.group_id)))))
$$;

create function scb.audit(p_workspace uuid, p_actor uuid, p_action text, p_object uuid,
                          p_request uuid, p_metadata jsonb default '{}')
returns void language sql set search_path = '' as $$
  insert into scb.audit_events (workspace_id, actor_id, action, object_id, request_id, metadata)
  values (p_workspace, p_actor, p_action, p_object, coalesce(p_request, gen_random_uuid()), p_metadata)
$$;

-- Idempotency (D16): scope by workspace, actor and route; same key with a
-- different payload is a conflict. Serialised per key with an advisory lock.
create function scb.idem_begin(p_workspace uuid, p_actor uuid, p_route text, p_key text, p_payload jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare rec scb.idempotency_records;
begin
  if p_key is null or length(p_key) < 8 or length(p_key) > 200 then
    return scb.err('VALIDATION_FAILED', 'An Idempotency-Key of 8 to 200 characters is required.');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace::text || p_actor::text || p_route || p_key, 0));
  select * into rec from scb.idempotency_records
   where workspace_id = p_workspace and actor_id = p_actor and route = p_route
     and key_hash = scb.sha256(p_key) and expires_at > now();
  if not found then return null; end if;
  if rec.payload_hash <> scb.sha256(p_payload::text) then
    return scb.err('IDEMPOTENCY_CONFLICT', 'This Idempotency-Key was used with a different request.');
  end if;
  return rec.response || jsonb_build_object('replayed', true);
end $$;

create function scb.idem_finish(p_workspace uuid, p_actor uuid, p_route text, p_key text,
                                p_payload jsonb, p_response jsonb)
returns jsonb language plpgsql set search_path = '' as $$
begin
  insert into scb.idempotency_records (workspace_id, actor_id, route, key_hash, payload_hash, response, expires_at)
  values (p_workspace, p_actor, p_route, scb.sha256(p_key), scb.sha256(p_payload::text), p_response,
          now() + interval '24 hours')
  on conflict (workspace_id, actor_id, route, key_hash)
  do update set payload_hash = excluded.payload_hash, response = excluded.response,
                expires_at = excluded.expires_at;
  return p_response;
end $$;

-- Hard constraints for one group brief against a slot (BR03 to BR06).
create function scb.brief_blockers(p_brief uuid, p_slot uuid, p_quote uuid) returns text[]
language sql stable set search_path = '' as $$
  select array_remove(array[
    case when b.sharing_choice <> 'WILLING_TO_SHARE' then 'SHARING_NOT_CONSENTED' end,
    case when b.budget_pence < q.ticket_pence then 'BUDGET_BELOW_PRICE' end,
    case when not exists (
      select 1 from jsonb_array_elements(b.availability) w
      where (w->>'start_at')::timestamptz <= s.start_at and (w->>'end_at')::timestamptz >= s.end_at)
      then 'TIME_UNAVAILABLE' end,
    case when not (b.access_requirements <@ e.access_support) then 'ACCESS_UNSUPPORTED' end
  ], null)
  from scb.group_briefs b, scb.slots s, scb.quotes q, scb.experiences e
  where b.id = p_brief and s.id = p_slot and q.id = p_quote and e.id = s.experience_id
$$;

-- Readiness predicate (D14) for the proposal's current version. Callers hold the
-- proposal and slot locks so the answer cannot change underneath them.
create function scb.readiness_blockers(p_proposal uuid) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  p scb.proposals; v scb.proposal_versions; s scb.slots;
  included integer; accepted integer; active integer;
  blockers text[] := '{}';
begin
  select * into p from scb.proposals where id = p_proposal;
  select * into v from scb.proposal_versions where id = p.current_version_id;
  select * into s from scb.slots where id = p.slot_id;
  select count(*) into included from scb.proposal_groups where proposal_version_id = v.id;
  select count(*) into accepted from scb.group_decisions
   where proposal_version_id = v.id and decision = 'ACCEPT';
  select count(*) into active from scb.reservations
   where proposal_version_id = v.id and status = 'RESERVED';

  if v.published_at is null then blockers := array_append(blockers, 'NOT_PUBLISHED'); end if;
  if included = 0 then blockers := array_append(blockers, 'NO_INCLUDED_GROUPS');
  elsif accepted < included then blockers := array_append(blockers, 'ORGANISER_ACCEPTANCE_MISSING'); end if;
  if active < v.required_seats then blockers := array_append(blockers, 'SEATS_BELOW_REQUIRED'); end if;
  if active > s.capacity then blockers := array_append(blockers, 'SEATS_EXCEED_CAPACITY'); end if;
  if v.deadline is null or now() >= v.deadline then blockers := array_append(blockers, 'DEADLINE_PASSED'); end if;
  if not scb.quote_is_current(v.quote_id) then blockers := array_append(blockers, 'QUOTE_NOT_CURRENT'); end if;
  if s.status <> 'HELD' or p.state not in ('OPEN', 'READY') then blockers := array_append(blockers, 'SLOT_NOT_HELD'); end if;
  return blockers;
end $$;

-- Moves OPEN <-> READY to match the predicate. Requires the caller's locks.
create function scb.sync_readiness(p_proposal uuid, p_actor uuid, p_request uuid) returns text
language plpgsql set search_path = '' as $$
declare p scb.proposals; ready boolean; next_state text;
begin
  select * into p from scb.proposals where id = p_proposal;
  if p.state not in ('OPEN', 'READY') then return p.state; end if;
  ready := cardinality(scb.readiness_blockers(p_proposal)) = 0;
  next_state := case when ready then 'READY' else 'OPEN' end;
  if next_state <> p.state then
    update scb.proposals set state = next_state, updated_at = now() where id = p_proposal;
    perform scb.audit(p.workspace_id, p_actor, 'proposal.' || lower(next_state), p_proposal, p_request,
                      jsonb_build_object('from', p.state, 'to', next_state));
  end if;
  return next_state;
end $$;

create function scb.active_seats(p_version uuid) returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer from scb.reservations
  where proposal_version_id = p_version and status = 'RESERVED'
$$;

-- Immutable published terms (BR07); the hash lets clients detect revisions.
create function scb.terms_snapshot(p_version uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'experience_id', e.id, 'experience_title', e.title, 'venue_name', o.name,
    'slot_id', s.id, 'slot_start_at', s.start_at, 'slot_end_at', s.end_at,
    'timezone', w.timezone, 'capacity', s.capacity,
    'access_support', to_jsonb(e.access_support),
    'quote_id', q.id, 'quote_version', q.version, 'ticket_pence', q.ticket_pence,
    'currency', q.currency, 'required_seats', v.required_seats, 'deadline', v.deadline,
    'group_ids', (select jsonb_agg(pg.group_id order by pg.group_id)
                  from scb.proposal_groups pg where pg.proposal_version_id = v.id),
    'payment_status', 'NOT_COLLECTED')
  from scb.proposal_versions v
  join scb.slots s on s.id = v.slot_id
  join scb.experiences e on e.id = v.experience_id
  join scb.organisations o on o.id = e.venue_organisation_id
  join scb.workspaces w on w.id = v.workspace_id
  join scb.quotes q on q.id = v.quote_id
  where v.id = p_version
$$;

-- Hosted Supabase runs these as `postgres`; nothing here is exposed to browsers.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'scb' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

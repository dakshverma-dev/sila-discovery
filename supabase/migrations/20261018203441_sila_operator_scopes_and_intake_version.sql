-- Gate B security follow-up: Part II sections 19, 22 and 24.
-- A global operator may create a venue, but private access is granted per venue.
-- Grant/revoke scopes through trusted database administration, with a reason;
-- the app role has no table access and cannot grant itself a scope.

create table sila.operator_venue_scopes (
  id uuid primary key default gen_random_uuid(),
  email text not null references sila.operators (email) on delete restrict,
  venue_id uuid not null references sila.venues (id) on delete restrict,
  granted_by uuid,
  granted_reason text not null check (char_length(trim(granted_reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_reason text,
  check ((revoked_at is null and revoked_by is null and revoked_reason is null)
    or (revoked_at is not null and revoked_reason is not null
        and char_length(trim(revoked_reason)) between 1 and 500))
);
create unique index operator_venue_scopes_live_uq
  on sila.operator_venue_scopes (email, venue_id) where revoked_at is null;
alter table sila.operator_venue_scopes enable row level security;
revoke all on sila.operator_venue_scopes from public, anon, authenticated, scb_app;

-- Scope history is immutable; a later grant is a new row. Administrative SQL
-- can supply a Sila actor when one exists; a null actor truthfully denotes a
-- database-admin grant/revoke, rather than inventing an application identity.
create function sila.audit_operator_venue_scope() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Operator venue scope history cannot be deleted';
  elsif tg_op = 'INSERT' then
    if new.revoked_at is not null then
      raise exception 'Create a live operator scope before revoking it';
    end if;
    perform sila.audit(new.granted_by, new.venue_id, 'grant_operator_scope',
                       'operator_venue_scope', new.id, 1, new.granted_reason);
  else
    if old.revoked_at is not null or new.revoked_at is null
       or (new.id, new.email, new.venue_id, new.granted_by, new.granted_reason, new.created_at)
          is distinct from
          (old.id, old.email, old.venue_id, old.granted_by, old.granted_reason, old.created_at) then
      raise exception 'Only revocation may change an operator venue scope';
    end if;
    perform sila.audit(new.revoked_by, new.venue_id, 'revoke_operator_scope',
                       'operator_venue_scope', new.id, 2, new.revoked_reason);
  end if;
  return new;
end $$;
create trigger operator_venue_scope_audit
  before insert or update or delete on sila.operator_venue_scopes
  for each row execute function sila.audit_operator_venue_scope();

-- Preserve only the explicit venue-creator relationship when upgrading an
-- existing installation. Never grant every operator every venue.
insert into sila.operator_venue_scopes (email, venue_id, granted_by, granted_reason)
select p.email, v.id, p.id, 'Existing venue creator at scoped-operations migration'
  from sila.venues v join sila.people p on p.id = v.created_by
  join sila.operators o on o.email = p.email and o.revoked_at is null;

create function sila.is_venue_operator(p_actor uuid, p_venue uuid) returns boolean
language sql stable set search_path = '' as $$
  select sila.is_operator(p_actor) and exists (
    select 1 from sila.operator_venue_scopes s
    where s.email = sila.person_email(p_actor) and s.venue_id = p_venue and s.revoked_at is null)
$$;

create or replace function sila.can_manage_members(p_actor uuid, p_venue uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from sila.venues v where v.id = p_venue)
     and (sila.is_venue_operator(p_actor, p_venue)
          or 'coordinator' = any(sila.venue_roles(p_actor, p_venue)))
$$;

create or replace function sila.can_prepare_sessions(p_actor uuid, p_venue uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from sila.venues v where v.id = p_venue)
     and (sila.is_venue_operator(p_actor, p_venue)
          or 'coordinator' = any(sila.venue_roles(p_actor, p_venue)))
$$;

create or replace function sila.can_view_venue(p_actor uuid, p_venue uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from sila.venues v where v.id = p_venue)
     and (sila.is_venue_operator(p_actor, p_venue)
          or cardinality(sila.venue_roles(p_actor, p_venue)) > 0)
$$;

create or replace function sila_api.get_my_context(p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p sila.people; scoped_venue uuid;
begin
  select * into p from sila.people where id = p_actor;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  for scoped_venue in
    select s.venue_id from sila.operator_venue_scopes s
    where s.email = p.email and s.revoked_at is null and sila.is_operator(p.id)
      and cardinality(sila.venue_roles(p.id, s.venue_id)) = 0
  loop
    perform sila.audit(p_actor, scoped_venue, 'get_my_context', 'venue', scoped_venue,
                       null, 'Scoped operator access');
  end loop;
  return sila.ok(jsonb_build_object(
    'person_id', p.id,
    'email', p.email,
    'is_operator', sila.is_operator(p.id),
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'roles', to_jsonb(r.roles))
                       order by v.name, v.id)
      from sila.venues v
      cross join lateral (
        select sila.venue_roles(p.id, v.id) || case when sila.is_venue_operator(p.id, v.id)
          then array['operator']::text[] else '{}'::text[] end as roles
      ) r
      where cardinality(r.roles) > 0
    ), '[]'::jsonb)));
end $$;

create or replace function sila_api.create_venue(p_actor uuid, p_key text, p_name text, p_address text,
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
  insert into sila.operator_venue_scopes (email, venue_id, granted_by, granted_reason)
  values (sila.person_email(p_actor), vid, p_actor, 'Venue created by this operator');
  perform sila.audit(p_actor, vid, 'create_venue', 'venue', vid, null, null);
  result := sila.ok(jsonb_build_object('venue_id', vid));
  return sila.idem_finish(p_actor, p_key, 'create_venue', request, result);
end $$;

create or replace function sila_api.post_plan_message(p_actor uuid, p_key text, p_plan uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('plan', p_plan, 'body', p_body);
  replay jsonb; result jsonb; v_venue uuid; v_organiser uuid; v_role text; m sila.plan_messages;
  v_body text := trim(coalesce(p_body, ''));
begin
  select p.organiser_id, s.venue_id into v_organiser, v_venue
    from sila.plans p join sila.sessions s on s.id = p.session_id where p.id = p_plan;
  if found then
    v_role := case when v_organiser = p_actor then 'organiser'
                   when cardinality(sila.venue_roles(p_actor, v_venue)) > 0 then 'venue'
                   when sila.is_venue_operator(p_actor, v_venue) then 'operator' end;
  end if;
  if v_role is null then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'post_plan_message', request);
  if replay is not null then return replay; end if;

  -- Appending a message changes no plan or session state, so no row lock is taken.
  if char_length(v_body) not between 1 and 2000 then
    result := sila.invalid_fields(jsonb_build_object('body', jsonb_build_array('Use 1 to 2000 characters.')));
  else
    insert into sila.plan_messages (plan_id, author_id, author_role, body)
    values (p_plan, p_actor, v_role, v_body)
    returning * into m;
    perform sila.audit(p_actor, v_venue, 'post_plan_message', 'plan_message', m.id, null, null);
    perform sila.enqueue('plan.message', 'plan.message:' || m.id,
                         jsonb_build_object('plan_id', p_plan, 'message_id', m.id));
    result := sila.ok(jsonb_build_object('message_id', m.id, 'author_role', m.author_role,
                                         'created_at', m.created_at));
  end if;
  return sila.idem_finish(p_actor, p_key, 'post_plan_message', request, result);
end $$;

-- Remove the unversioned overload: no caller may bypass the version check.
revoke all on function sila_api.set_session_intake(uuid, text, uuid, boolean, text) from scb_app;
drop function sila_api.set_session_intake(uuid, text, uuid, boolean, text);

create or replace function sila_api.set_session_intake(p_actor uuid, p_key text, p_session uuid, p_paused boolean,
                                            p_reason text, p_expected_version int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  request jsonb := jsonb_build_object('session', p_session, 'paused', p_paused, 'reason', v_reason,
                                      'expected_version', p_expected_version);
  replay jsonb; result jsonb; v_venue uuid;
  s sila.sessions;
begin
  select venue_id into v_venue from sila.sessions where id = p_session;
  if not found or not sila.can_prepare_sessions(p_actor, v_venue) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  replay := sila.idem_begin(p_actor, p_key, 'set_session_intake', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = p_session for update;
  if p_expected_version is null or s.version <> p_expected_version then
    result := sila.err('VERSION_CONFLICT', 'This session changed since you opened it. Reload and try again.',
                       jsonb_build_object('current_version', s.version));
  elsif p_paused is null then
    result := sila.invalid_fields(jsonb_build_object('paused', jsonb_build_array('Choose pause or resume.')));
  elsif p_paused and v_reason is null then
    result := sila.invalid_fields(jsonb_build_object('reason',
                                  jsonb_build_array('Give a reason for pausing new requests.')));
  elsif char_length(v_reason) > 500 then
    result := sila.invalid_fields(jsonb_build_object('reason', jsonb_build_array('Use at most 500 characters.')));
  elsif s.phase <> 'published' then
    result := sila.err('SESSION_NOT_OPEN', 'Only a published session can have requests paused or resumed.');
  elsif s.intake_paused = p_paused and s.intake_paused_reason is not distinct from
        (case when p_paused then v_reason end) then
    result := sila.ok(jsonb_build_object('session_id', s.id, 'version', s.version,
                                         'intake_paused', s.intake_paused));
  else
    update sila.sessions
       set intake_paused = p_paused, intake_paused_reason = case when p_paused then v_reason end,
           version = version + 1, updated_at = now()
     where id = p_session
    returning * into s;
    perform sila.audit(p_actor, s.venue_id, 'set_session_intake', 'session', s.id, s.version, v_reason);
    result := sila.ok(jsonb_build_object('session_id', s.id, 'version', s.version,
                                         'intake_paused', s.intake_paused));
  end if;
  return sila.idem_finish(p_actor, p_key, 'set_session_intake', request, result);
end $$;

-- Protected operator reads are audited only when the caller relies on the
-- operations scope. Venue members keep their own role permissions.
create or replace function sila_api.get_venue_session(p_actor uuid, p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s sila.sessions; v sila.venues;
begin
  select * into s from sila.sessions where id = p_session;
  if not found or not sila.can_view_venue(p_actor, s.venue_id) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  if cardinality(sila.venue_roles(p_actor, s.venue_id)) = 0 then
    perform sila.audit(p_actor, s.venue_id, 'get_venue_session', 'session', s.id,
                       s.version, 'Scoped operator access');
  end if;
  select * into v from sila.venues where id = s.venue_id;
  return sila.ok(jsonb_build_object(
    'session', to_jsonb(s),
    'venue', jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address, 'time_zone', v.time_zone,
                                'access_facts', v.access_facts, 'contact_email', v.contact_email,
                                'contact_phone', v.contact_phone),
    'roles', to_jsonb(sila.venue_roles(p_actor, s.venue_id)
      || case when sila.is_venue_operator(p_actor, s.venue_id)
         then array['operator']::text[] else '{}'::text[] end),
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'allocation_id', a.id, 'plan_id', p.id, 'plan_ref', 'PL' || p.plan_number, 'club_name', p.club_name,
               'places', a.places, 'status', a.status, 'committed_at', a.committed_at,
               'total_minor', a.total_minor, 'deposit_minor', a.deposit_minor, 'balance_minor', a.balance_minor,
               'verified_deposit_minor', sila.verified_minor(a.id, 'deposit'),
               'verified_balance_minor', sila.verified_minor(a.id, 'balance'),
               'reports', sila.reports_json(a.id),
               'receipts', sila.receipts_json(a.id, s.pay_by))
             order by (a.status = 'live') desc, a.committed_at, a.id)
      from sila.allocations a join sila.plans p on p.id = a.plan_id
      where a.session_id = s.id), '[]'::jsonb),
    'booking', (select jsonb_build_object('booking_id', b.id, 'booking_ref', sila.booking_ref(b.booking_number),
                                          'confirmed_at', b.confirmed_at, 'diary_checked_at', b.diary_checked_at)
                from sila.bookings b where b.session_id = s.id)));
end $$;

create or replace function sila_api.list_session_requests(p_actor uuid, p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s sila.sessions;
begin
  select * into s from sila.sessions where id = p_session;
  if not found or not sila.can_view_venue(p_actor, s.venue_id) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  if cardinality(sila.venue_roles(p_actor, s.venue_id)) = 0 then
    perform sila.audit(p_actor, s.venue_id, 'list_session_requests', 'session', s.id,
                       s.version, 'Scoped operator access');
  end if;
  return sila.ok(jsonb_build_object(
    'session_id', s.id,
    'terms_version', s.terms_version,
    'committed_places', sila.committed_places(s.id),
    'minimum_reached_at', s.minimum_reached_at,
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'plan_ref', 'PL' || p.plan_number, 'club_name', p.club_name,
               'requested_places', p.requested_places,
               'group_total_minor', s.price_minor::bigint * p.requested_places,
               'source', p.source, 'status', p.status, 'declined_reason', p.declined_reason,
               'version', p.version, 'created_at', p.created_at,
               'messages', sila.plan_messages_json(p.id, p_actor),
               'approval', (select jsonb_build_object('approved_places', a.approved_places,
                                                      'terms_version', a.terms_version,
                                                      'approved_at', a.approved_at)
                            from sila.approvals a where a.plan_id = p.id),
               'allocation', (select sila.plan_allocation_json(p.id)
                                     || jsonb_build_object('committed_at', a.committed_at)
                              from sila.allocations a where a.plan_id = p.id
                              order by (a.status = 'live') desc, a.committed_at desc limit 1))
             order by p.created_at, p.plan_number)
      from sila.plans p where p.session_id = s.id), '[]'::jsonb)));
end $$;

create or replace function sila_api.list_venue_sessions(p_actor uuid, p_venue uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not sila.can_view_venue(p_actor, p_venue) then return sila.err('NOT_FOUND', 'Not found.'); end if;
  if cardinality(sila.venue_roles(p_actor, p_venue)) = 0 then
    perform sila.audit(p_actor, p_venue, 'list_venue_sessions', 'venue', p_venue,
                       null, 'Scoped operator access');
  end if;
  return sila.ok(jsonb_build_object('sessions', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'version', s.version, 'phase', s.phase, 'title', s.title,
             'starts_at', s.starts_at, 'ends_at', s.ends_at, 'fill_by', s.fill_by, 'decision_by', s.decision_by,
             'price_minor', s.price_minor, 'minimum', s.minimum, 'capacity', s.capacity,
             'intake_paused', s.intake_paused, 'published_at', s.published_at)
           order by s.starts_at, s.id)
    from sila.sessions s where s.venue_id = p_venue), '[]'::jsonb)));
end $$;

revoke all on all functions in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila_api from public, anon, authenticated;
grant execute on function sila_api.set_session_intake(uuid, text, uuid, boolean, text, int) to scb_app;

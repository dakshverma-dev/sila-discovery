-- Sila pilot (Gate B): club requests (plans) and the plan conversation.
-- A request reserves nothing (§04, §15). No member list, roster, health or
-- access-note fields are stored (§19); message text never leaves this table.

-- ---------------------------------------------------------------- tables

create table sila.plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sila.sessions (id) on delete restrict,
  plan_number bigint generated always as identity (start with 1001) unique,
  club_name text not null check (char_length(club_name) between 1 and 120 and club_name = trim(club_name)),
  requested_places int not null check (requested_places > 0),
  organiser_id uuid not null references sila.people (id) on delete restrict,
  organiser_email text not null check (organiser_email = lower(organiser_email)),
  source text not null default 'unknown'
    check (source in ('venue_existing', 'sila_introduction', 'referral', 'unknown')),
  status text not null default 'submitted' check (status in ('submitted', 'declined')),
  declined_reason text check (char_length(declined_reason) <= 500),
  declined_at timestamptz,
  version int not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  check (status <> 'declined' or declined_at is not null)
);
create index plans_session_idx on sila.plans (session_id, created_at);
create index plans_organiser_idx on sila.plans (organiser_id, created_at);

create table sila.plan_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references sila.plans (id) on delete cascade,
  author_id uuid references sila.people (id) on delete set null,
  author_role text not null check (author_role in ('organiser', 'venue', 'operator')),
  body text not null check (char_length(body) between 1 and 2000 and body = trim(body)),
  created_at timestamptz not null default now()
);
create index plan_messages_plan_idx on sila.plan_messages (plan_id, created_at);

alter table sila.plans enable row level security;
alter table sila.plan_messages enable row level security;

-- ---------------------------------------------------------------- helpers

-- The public session shape (explicit field whitelist), shared by
-- get_public_session and get_my_plan. No phase filter: callers decide who may
-- see which phases. committed_places is 0 until commitments exist.
create function sila.public_session_json(p_session uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'title', s.title, 'description', s.description, 'inclusions', s.inclusions,
    'meeting_point', s.meeting_point, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'price_minor', s.price_minor, 'minimum', s.minimum, 'capacity', s.capacity, 'max_clubs', s.max_clubs,
    'deposit_bp', s.deposit_bp, 'fill_by', s.fill_by, 'decision_by', s.decision_by, 'phase', s.phase,
    'intake_open', s.phase = 'published' and not s.intake_paused and now() <= s.fill_by,
    'committed_places', 0,
    'venue', jsonb_build_object('name', v.name, 'address', v.address, 'access_facts', v.access_facts,
                                'contact_email', v.contact_email, 'contact_phone', v.contact_phone))
  from sila.sessions s join sila.venues v on v.id = s.venue_id
  where s.id = p_session
$$;

create or replace function sila_api.get_public_session(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from sila.sessions
                 where id = p_session and phase in ('published', 'closed', 'confirmed')) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  return sila.ok(sila.public_session_json(p_session));
end $$;

-- PlanFacts (lib/sila/status.ts), every key present. Later migrations fill
-- the approval, commitment and payment facts.
create function sila.plan_facts(p sila.plans, p_session_phase text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'submitted', true,
    'approved', false,
    'committed', false,
    'closed', p.status = 'declined' or p_session_phase in ('closed', 'cancelled'),
    'minimumReached', false,
    'openingBlocked', false,
    'paymentOpened', false,
    'ownPaymentReported', false,
    'ownDepositVerified', false,
    'allDepositsVerified', false,
    'confirmed', false,
    'balanceDefaultEstablished', false,
    'amendmentPending', false)
$$;

create function sila.plan_messages_json(p_plan uuid, p_viewer uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'author_role', m.author_role, 'body', m.body, 'created_at', m.created_at,
           'from_me', m.author_id is not distinct from p_viewer)
         order by m.created_at, m.id), '[]'::jsonb)
  from sila.plan_messages m where m.plan_id = p_plan
$$;

create function sila.plan_field_errors(p_club_name text, p_places int, p_source text, p_capacity int)
returns jsonb language plpgsql stable set search_path = '' as $$
declare errors jsonb := '{}';
begin
  if char_length(p_club_name) not between 1 and 120 then
    errors := errors || jsonb_build_object('club_name', jsonb_build_array('Use 1 to 120 characters.'));
  end if;
  if p_places is null or p_places < 1 then
    errors := errors || jsonb_build_object('places', jsonb_build_array('Request at least 1 place.'));
  elsif p_places > p_capacity then
    errors := errors || jsonb_build_object('places',
      jsonb_build_array(format('This session has %s places.', p_capacity)));
  end if;
  if p_source not in ('venue_existing', 'sila_introduction', 'referral', 'unknown') then
    errors := errors || jsonb_build_object('source', jsonb_build_array('Choose how you heard about this session.'));
  end if;
  return errors;
end $$;

-- ---------------------------------------------------------------- API

-- Any signed-in person may request places for their club on a session that is
-- taking requests. Checks follow checkCommit's order for the shared codes.
create function sila_api.submit_plan(p_actor uuid, p_key text, p_session uuid, p_club_name text, p_places int,
                                     p_source text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('session', p_session, 'club_name', p_club_name, 'places', p_places,
                                      'source', p_source);
  replay jsonb; errors jsonb; result jsonb;
  v_club text := trim(coalesce(p_club_name, ''));
  v_source text := coalesce(p_source, 'unknown');
  s sila.sessions; p sila.plans;
begin
  if not exists (select 1 from sila.people where id = p_actor)
     or not exists (select 1 from sila.sessions where id = p_session) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  replay := sila.idem_begin(p_actor, p_key, 'submit_plan', request);
  if replay is not null then return replay; end if;

  -- Share lock: concurrent requests proceed; pausing or closing waits.
  select * into s from sila.sessions where id = p_session for share;
  if s.intake_paused then
    result := sila.err('INTAKE_PAUSED', 'The venue has paused new requests for this session.');
  elsif s.phase <> 'published' then
    result := sila.err('SESSION_NOT_OPEN', 'This session is not taking requests.');
  elsif now() > s.fill_by then
    result := sila.err('FILL_DEADLINE_PASSED', 'The deadline for requests on this session has passed.');
  else
    errors := sila.plan_field_errors(v_club, p_places, v_source, s.capacity);
    if errors <> '{}'::jsonb then
      result := sila.invalid_fields(errors);
    else
      insert into sila.plans (session_id, club_name, requested_places, organiser_id, organiser_email, source)
      values (s.id, v_club, p_places, p_actor, sila.person_email(p_actor), v_source)
      returning * into p;
      perform sila.audit(p_actor, s.venue_id, 'submit_plan', 'plan', p.id, p.version, null);
      perform sila.enqueue('plan.submitted', 'plan.submitted:' || p.id,
                           jsonb_build_object('plan_id', p.id, 'session_id', s.id));
      result := sila.ok(jsonb_build_object('plan_id', p.id, 'plan_ref', 'PL' || p.plan_number));
    end if;
  end if;
  return sila.idem_finish(p_actor, p_key, 'submit_plan', request, result);
end $$;

-- Organiser view of one plan: the plan, the public session, the conversation
-- and PlanFacts. Anyone other than the organiser gets NOT_FOUND.
create function sila_api.get_my_plan(p_actor uuid, p_plan uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p sila.plans; v_phase text;
begin
  select * into p from sila.plans where id = p_plan and organiser_id = p_actor;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  select phase into v_phase from sila.sessions where id = p.session_id;
  return sila.ok(jsonb_build_object(
    'plan', jsonb_build_object('id', p.id, 'plan_ref', 'PL' || p.plan_number, 'club_name', p.club_name,
                               'requested_places', p.requested_places, 'source', p.source, 'status', p.status,
                               'declined_reason', p.declined_reason, 'version', p.version),
    'session', sila.public_session_json(p.session_id),
    'messages', sila.plan_messages_json(p.id, p_actor),
    'facts', sila.plan_facts(p, v_phase)));
end $$;

create function sila_api.list_my_plans(p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return sila.ok(jsonb_build_object('plans', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'plan_ref', 'PL' || p.plan_number, 'club_name', p.club_name,
             'requested_places', p.requested_places, 'status', p.status, 'created_at', p.created_at,
             'session', jsonb_build_object('id', s.id, 'title', s.title, 'starts_at', s.starts_at,
                                           'phase', s.phase),
             'facts', sila.plan_facts(p, s.phase))
           order by p.created_at desc, p.plan_number desc)
    from sila.plans p join sila.sessions s on s.id = p.session_id
    where p.organiser_id = p_actor), '[]'::jsonb)));
end $$;

-- Venue members and operators: the requests on one session with the group
-- total (price_minor * requested_places, minor units) and the conversation.
create function sila_api.list_session_requests(p_actor uuid, p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s sila.sessions;
begin
  select * into s from sila.sessions where id = p_session;
  if not found or not sila.can_view_venue(p_actor, s.venue_id) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  return sila.ok(jsonb_build_object('session_id', s.id, 'plans', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'plan_ref', 'PL' || p.plan_number, 'club_name', p.club_name,
             'requested_places', p.requested_places,
             'group_total_minor', s.price_minor::bigint * p.requested_places,
             'source', p.source, 'status', p.status, 'declined_reason', p.declined_reason,
             'version', p.version, 'created_at', p.created_at,
             'messages', sila.plan_messages_json(p.id, p_actor))
           order by p.created_at, p.plan_number)
    from sila.plans p where p.session_id = s.id), '[]'::jsonb)));
end $$;

-- The plan's organiser, a member of its venue, or an operator. The role is
-- recorded; the outbox and audit carry ids only, never the message text.
create function sila_api.post_plan_message(p_actor uuid, p_key text, p_plan uuid, p_body text)
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
                   when sila.is_operator(p_actor) then 'operator' end;
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

-- ---------------------------------------------------------------- grants

-- Default-privilege revokes do not cover these objects, so revoke explicitly.
revoke all on all tables in schema sila from public, anon, authenticated;
revoke all on all sequences in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila_api from public, anon, authenticated;
grant usage on schema sila_api to scb_app;
grant execute on all functions in schema sila_api to scb_app;

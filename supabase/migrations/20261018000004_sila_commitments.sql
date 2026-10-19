-- Sila pilot (Gate B): venue approval and conditional commitment.
-- An approval reserves nothing (§04, §15); only a live allocation counts
-- towards the session. commit_plan repeats checkCommit (lib/sila/commitment.ts)
-- under row locks, in the same order and with the same codes (§07, §12, §15, §23).

-- ---------------------------------------------------------------- tables

create table sila.approvals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references sila.plans (id) on delete restrict,
  approved_places int not null check (approved_places > 0),
  terms_version int not null check (terms_version >= 1),
  approver_id uuid references sila.people (id) on delete set null,
  approved_at timestamptz not null default now()
);

create table sila.allocations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references sila.plans (id) on delete restrict,
  session_id uuid not null references sila.sessions (id) on delete restrict,
  places int not null check (places > 0),
  price_minor int not null check (price_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  deposit_minor bigint not null check (deposit_minor >= 0),
  balance_minor bigint not null check (balance_minor >= 0),
  terms_version int not null check (terms_version >= 1),
  platform_terms_version text,
  accepted_decision_by timestamptz not null,
  committed_by uuid references sila.people (id) on delete set null,
  committed_at timestamptz not null default now(),
  status text not null default 'live' check (status in ('live', 'withdrawn', 'released')),
  withdrawal_requested_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text check (char_length(withdrawal_reason) <= 500),
  released_at timestamptz,
  check (total_minor = deposit_minor + balance_minor)
);
create unique index allocations_live_plan_uq on sila.allocations (plan_id) where status = 'live';
create index allocations_session_idx on sila.allocations (session_id) where status = 'live';

alter table sila.approvals enable row level security;
alter table sila.allocations enable row level security;

-- ---------------------------------------------------------------- helpers

-- Server-side money (§18): deposit rounded half up once per group, balance the
-- exact remainder. Mirrors groupAmounts in lib/sila/money.ts.
create function sila.group_amounts(p_price_minor int, p_places int, p_deposit_bp int) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('total_minor', t.total, 'deposit_minor', t.deposit,
                            'balance_minor', t.total - t.deposit)
  from (select p_price_minor::bigint * p_places as total,
               (p_price_minor::bigint * p_places * p_deposit_bp + 5000) / 10000 as deposit) t
$$;

create function sila.committed_places(p_session uuid) returns int
language sql stable set search_path = '' as $$
  select coalesce(sum(places), 0)::int from sila.allocations where session_id = p_session and status = 'live'
$$;

create function sila.plan_approval_json(p_plan uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('approved_places', a.approved_places, 'terms_version', a.terms_version)
  from sila.approvals a where a.plan_id = p_plan
$$;

-- The live allocation, else the most recent one (withdrawn or released).
create function sila.plan_allocation_json(p_plan uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('places', a.places, 'total_minor', a.total_minor, 'deposit_minor', a.deposit_minor,
                            'balance_minor', a.balance_minor, 'accepted_decision_by', a.accepted_decision_by,
                            'status', a.status)
  from sila.allocations a where a.plan_id = p_plan
  order by (a.status = 'live') desc, a.committed_at desc limit 1
$$;

-- Public session shape: committed_places sums live allocations; intake closes
-- once the minimum is reached (the contributing set is then frozen).
create or replace function sila.public_session_json(p_session uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'title', s.title, 'description', s.description, 'inclusions', s.inclusions,
    'meeting_point', s.meeting_point, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'price_minor', s.price_minor, 'minimum', s.minimum, 'capacity', s.capacity, 'max_clubs', s.max_clubs,
    'deposit_bp', s.deposit_bp, 'fill_by', s.fill_by, 'decision_by', s.decision_by, 'phase', s.phase,
    'intake_open', s.phase = 'published' and not s.intake_paused and now() <= s.fill_by
                   and s.minimum_reached_at is null,
    'committed_places', sila.committed_places(s.id),
    'venue', jsonb_build_object('name', v.name, 'address', v.address, 'access_facts', v.access_facts,
                                'contact_email', v.contact_email, 'contact_phone', v.contact_phone))
  from sila.sessions s join sila.venues v on v.id = s.venue_id
  where s.id = p_session
$$;

-- PlanFacts with approval, commitment and payment-scheduling facts filled.
-- minimumReached and openingBlocked describe this plan's committed session.
create or replace function sila.plan_facts(p sila.plans, p_session_phase text) returns jsonb
language sql stable set search_path = '' as $$
  with f as (
    select exists (select 1 from sila.approvals a where a.plan_id = p.id) as approved,
           exists (select 1 from sila.allocations a where a.plan_id = p.id and a.status = 'live') as committed,
           s.minimum_reached_at, s.payment_scheduled_for, s.payment_opening_blocked_reason
    from sila.sessions s where s.id = p.session_id
  )
  select jsonb_build_object(
    'submitted', true,
    'approved', f.approved,
    'committed', f.committed,
    'closed', p.status = 'declined' or p_session_phase in ('closed', 'cancelled'),
    'minimumReached', f.committed and f.minimum_reached_at is not null,
    'openingBlocked', f.committed and f.minimum_reached_at is not null and f.payment_scheduled_for is null
                      and f.payment_opening_blocked_reason is not null,
    'paymentOpened', false,
    'ownPaymentReported', false,
    'ownDepositVerified', false,
    'allDepositsVerified', false,
    'confirmed', false,
    'balanceDefaultEstablished', false,
    'amendmentPending', false)
  from f
$$;

-- ---------------------------------------------------------------- API

create or replace function sila_api.get_my_plan(p_actor uuid, p_plan uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p sila.plans; s sila.sessions; v_committed boolean;
begin
  select * into p from sila.plans where id = p_plan and organiser_id = p_actor;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  select * into s from sila.sessions where id = p.session_id;
  v_committed := exists (select 1 from sila.allocations where plan_id = p.id and status = 'live');
  return sila.ok(jsonb_build_object(
    'plan', jsonb_build_object('id', p.id, 'plan_ref', 'PL' || p.plan_number, 'club_name', p.club_name,
                               'requested_places', p.requested_places, 'source', p.source, 'status', p.status,
                               'declined_reason', p.declined_reason, 'version', p.version),
    'session', sila.public_session_json(p.session_id),
    'messages', sila.plan_messages_json(p.id, p_actor),
    'facts', sila.plan_facts(p, s.phase),
    'approval', sila.plan_approval_json(p.id),
    'allocation', sila.plan_allocation_json(p.id),
    -- Payment scheduling is shown only to a committed club.
    'payment', jsonb_build_object(
      'scheduled_for', case when v_committed then s.payment_scheduled_for end,
      'blocked_reason', case when v_committed and s.payment_scheduled_for is null
                             then s.payment_opening_blocked_reason end)));
end $$;

create or replace function sila_api.list_session_requests(p_actor uuid, p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s sila.sessions;
begin
  select * into s from sila.sessions where id = p_session;
  if not found or not sila.can_view_venue(p_actor, s.venue_id) then
    return sila.err('NOT_FOUND', 'Not found.');
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

-- A coordinator of the plan's venue approves a quantity under the current
-- terms. It reserves nothing. Approving again before commitment replaces the
-- approval (audited); after commitment it returns ALREADY_COMMITTED.
create function sila_api.approve_plan(p_actor uuid, p_key text, p_plan uuid, p_places int, p_terms_version int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('plan', p_plan, 'places', p_places, 'terms_version', p_terms_version);
  replay jsonb; result jsonb; v_venue uuid; v_session uuid; v_approval uuid;
  s sila.sessions; p sila.plans;
begin
  select pl.session_id, se.venue_id into v_session, v_venue
    from sila.plans pl join sila.sessions se on se.id = pl.session_id where pl.id = p_plan;
  if not found or not ('coordinator' = any(sila.venue_roles(p_actor, v_venue))) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  replay := sila.idem_begin(p_actor, p_key, 'approve_plan', request);
  if replay is not null then return replay; end if;

  -- Share lock on the session: approvals may run together; a commit waits.
  select * into s from sila.sessions where id = v_session for share;
  select * into p from sila.plans where id = p_plan for update;
  if s.phase <> 'published' then
    result := sila.err('SESSION_NOT_OPEN', 'This session is not taking requests.');
  elsif p.status = 'declined' then
    result := sila.err('PLAN_DECLINED', 'This request has been declined.');
  elsif exists (select 1 from sila.allocations where plan_id = p.id and status = 'live') then
    result := sila.err('ALREADY_COMMITTED', 'This club has already committed its places.');
  elsif p_terms_version is distinct from s.terms_version then
    result := sila.err('STALE_TERMS', 'The session terms have changed. Reload and review them.',
                       jsonb_build_object('terms_version', s.terms_version));
  elsif p_places is null or p_places < 1 or p_places > s.capacity then
    result := sila.invalid_fields(jsonb_build_object('places',
      jsonb_build_array(format('Approve 1 to %s places.', s.capacity))));
  else
    insert into sila.approvals (plan_id, approved_places, terms_version, approver_id)
    values (p.id, p_places, s.terms_version, p_actor)
    on conflict (plan_id) do update
      set approved_places = excluded.approved_places, terms_version = excluded.terms_version,
          approver_id = excluded.approver_id, approved_at = now()
    returning id into v_approval;
    update sila.plans set version = version + 1 where id = p.id returning * into p;
    perform sila.audit(p_actor, s.venue_id, 'approve_plan', 'plan', p.id, p.version, null);
    perform sila.enqueue('plan.approved', 'plan.approved:' || p.id || ':' || p.version,
                         jsonb_build_object('plan_id', p.id, 'approval_id', v_approval));
    result := sila.ok(jsonb_build_object('approval_id', v_approval));
  end if;
  return sila.idem_finish(p_actor, p_key, 'approve_plan', request, result);
end $$;

-- A coordinator declines a request that has not committed. A reason is required.
create function sila_api.decline_plan(p_actor uuid, p_key text, p_plan uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  request jsonb := jsonb_build_object('plan', p_plan, 'reason', v_reason);
  replay jsonb; result jsonb; v_venue uuid; v_session uuid;
  s sila.sessions; p sila.plans;
begin
  select pl.session_id, se.venue_id into v_session, v_venue
    from sila.plans pl join sila.sessions se on se.id = pl.session_id where pl.id = p_plan;
  if not found or not ('coordinator' = any(sila.venue_roles(p_actor, v_venue))) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  replay := sila.idem_begin(p_actor, p_key, 'decline_plan', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = v_session for share;
  select * into p from sila.plans where id = p_plan for update;
  if v_reason is null or char_length(v_reason) > 500 then
    result := sila.invalid_fields(jsonb_build_object('reason',
      jsonb_build_array('Give a reason of up to 500 characters.')));
  elsif p.status = 'declined' then
    result := sila.err('PLAN_DECLINED', 'This request has already been declined.');
  elsif exists (select 1 from sila.allocations where plan_id = p.id and status = 'live') then
    result := sila.err('ALREADY_COMMITTED', 'This club has already committed its places.');
  else
    update sila.plans
       set status = 'declined', declined_reason = v_reason, declined_at = now(), version = version + 1
     where id = p.id
    returning * into p;
    perform sila.audit(p_actor, s.venue_id, 'decline_plan', 'plan', p.id, p.version, v_reason);
    perform sila.enqueue('plan.declined', 'plan.declined:' || p.id, jsonb_build_object('plan_id', p.id));
    result := sila.ok(jsonb_build_object('plan_id', p.id, 'version', p.version));
  end if;
  return sila.idem_finish(p_actor, p_key, 'decline_plan', request, result);
end $$;

-- The organiser commits their approved quantity, conditional on the session
-- reaching its minimum. Lock order: session -> plan -> allocations. Checks in
-- exactly checkCommit's order. Reaching the minimum stamps minimum_reached_at
-- once and queues payment scheduling.
create function sila_api.commit_plan(p_actor uuid, p_key text, p_plan uuid, p_places int, p_terms_version int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('plan', p_plan, 'places', p_places, 'terms_version', p_terms_version);
  replay jsonb; result jsonb; v_session uuid; money jsonb;
  v_live int; v_committed int; v_after int;
  s sila.sessions; p sila.plans; a sila.approvals; al sila.allocations;
begin
  select session_id into v_session from sila.plans where id = p_plan and organiser_id = p_actor;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'commit_plan', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = v_session for update;
  select * into p from sila.plans where id = p_plan for update;
  perform 1 from sila.allocations where session_id = s.id and status = 'live' for update;
  select * into a from sila.approvals where plan_id = p.id;
  select count(*)::int, coalesce(sum(places), 0)::int into v_live, v_committed
    from sila.allocations where session_id = s.id and status = 'live';
  v_after := v_committed + coalesce(p_places, 0);

  if s.intake_paused then
    result := sila.err('INTAKE_PAUSED', 'The venue has paused new commitments for this session.');
  elsif s.phase <> 'published' then
    result := sila.err('SESSION_NOT_OPEN', 'This session is not taking commitments.');
  elsif now() > s.fill_by then
    result := sila.err('FILL_DEADLINE_PASSED', 'The deadline for commitments on this session has passed.');
  elsif s.minimum_reached_at is not null then
    result := sila.err('MINIMUM_ALREADY_REACHED', 'This session has already reached its minimum.');
  elsif a.id is null or p.status = 'declined' then
    result := sila.err('NOT_APPROVED', 'The venue has not approved places for this club.');
  elsif a.terms_version <> s.terms_version or p_terms_version is distinct from s.terms_version then
    result := sila.err('STALE_TERMS', 'The session terms have changed. Reload and review them.',
                       jsonb_build_object('terms_version', s.terms_version));
  elsif p_places is distinct from a.approved_places then
    result := sila.err('QUANTITY_NOT_APPROVED', 'Commit exactly the number of places the venue approved.',
                       jsonb_build_object('approved_places', a.approved_places));
  elsif exists (select 1 from sila.allocations where plan_id = p.id and status = 'live') then
    result := sila.err('ALREADY_COMMITTED', 'This club has already committed its places.');
  elsif v_live >= s.max_clubs then
    result := sila.err('CLUB_LIMIT_REACHED', 'This session already has the maximum number of clubs.');
  elsif v_after > s.capacity then
    result := sila.err('CAPACITY_EXCEEDED', 'There are not enough places left on this session.');
  elsif v_live + 1 = s.max_clubs and v_after < s.minimum then
    result := sila.err('SECOND_CLUB_BELOW_MINIMUM',
                       'The last club place must bring the session to its minimum.',
                       jsonb_build_object('places_needed', s.minimum - v_committed));
  elsif s.decision_by > ((now() at time zone 'Europe/London') + interval '21 days') at time zone 'Europe/London' then
    result := sila.err('WAIT_EXCEEDS_LIMIT', 'The final decision is more than 21 days away.');
  else
    money := sila.group_amounts(s.price_minor, p_places, s.deposit_bp);
    insert into sila.allocations (plan_id, session_id, places, price_minor, total_minor, deposit_minor,
                                  balance_minor, terms_version, platform_terms_version, accepted_decision_by,
                                  committed_by)
    values (p.id, s.id, p_places, s.price_minor, (money ->> 'total_minor')::bigint,
            (money ->> 'deposit_minor')::bigint, (money ->> 'balance_minor')::bigint, s.terms_version,
            s.platform_terms_version, s.decision_by, p_actor)
    returning * into al;
    update sila.plans set version = version + 1 where id = p.id returning * into p;
    perform sila.audit(p_actor, s.venue_id, 'commit_plan', 'allocation', al.id, p.version, null);
    perform sila.enqueue('plan.committed', 'plan.committed:' || al.id,
                         jsonb_build_object('plan_id', p.id, 'allocation_id', al.id, 'session_id', s.id));
    if v_after >= s.minimum then
      update sila.sessions set minimum_reached_at = now(), version = version + 1, updated_at = now()
       where id = s.id
      returning * into s;
      perform sila.audit(p_actor, s.venue_id, 'minimum_reached', 'session', s.id, s.version, null);
      perform sila.enqueue('payment.schedule', 'schedule:' || s.id || ':' || s.minimum_reached_at,
                           jsonb_build_object('session_id', s.id, 'minimum_reached_at', s.minimum_reached_at));
    end if;
    result := sila.ok(jsonb_build_object(
      'allocation_id', al.id, 'session_id', s.id, 'places_after', v_after, 'reaches_minimum', v_after >= s.minimum,
      'minimum_reached_at', s.minimum_reached_at,
      'next_action', case when v_after >= s.minimum then 'payment_scheduled' else 'waiting_for_more_places' end,
      'total_minor', al.total_minor, 'deposit_minor', al.deposit_minor, 'balance_minor', al.balance_minor));
  end if;
  return sila.idem_finish(p_actor, p_key, 'commit_plan', request, result);
end $$;

-- Server-only scheduling inputs for the session whose minimum was reached.
-- Route handlers never expose this function; it takes no actor.
create function sila_api.get_schedule_inputs(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s sila.sessions;
begin
  select * into s from sila.sessions where id = p_session;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  return sila.ok(jsonb_build_object(
    'session_id', s.id, 'minimum_reached_at', s.minimum_reached_at,
    'payment_scheduled_for', s.payment_scheduled_for,
    'blocked_reason', s.payment_opening_blocked_reason,
    'covered_dates', to_jsonb(s.covered_dates)));
end $$;

-- Server-only scheduling step (§12, §22): records the staffed 11:45 opening
-- computed by scheduledPaymentOpening, or why none could be found. Route
-- handlers never expose this function; it takes no actor. It writes only
-- while the minimum it was computed for is current and nothing is scheduled
-- yet, so a repeated or late call changes nothing.
create function sila_api.schedule_payment_opening(p_session uuid, p_minimum_reached_at timestamptz,
                                                  p_scheduled_for timestamptz, p_blocked_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s sila.sessions;
  v_reason text := nullif(trim(coalesce(p_blocked_reason, '')), '');
begin
  if (p_scheduled_for is null) = (v_reason is null) or char_length(v_reason) > 500 then
    return sila.invalid_fields(jsonb_build_object('scheduled_for',
      jsonb_build_array('Give either an opening time or the reason none is available.')));
  end if;
  select * into s from sila.sessions where id = p_session for update;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  if s.minimum_reached_at is not null and s.minimum_reached_at = p_minimum_reached_at
     and s.payment_scheduled_for is null
     and (p_scheduled_for is not null or s.payment_opening_blocked_reason is null) then
    update sila.sessions
       set payment_scheduled_for = p_scheduled_for,
           payment_opening_blocked_reason = case when p_scheduled_for is null then v_reason end,
           version = version + 1, updated_at = now()
     where id = s.id
    returning * into s;
    perform sila.audit(null, s.venue_id, 'schedule_payment_opening', 'session', s.id, s.version, v_reason);
  end if;
  return sila.ok(jsonb_build_object('payment_scheduled_for', s.payment_scheduled_for,
                                    'blocked_reason', case when s.payment_scheduled_for is null
                                                           then s.payment_opening_blocked_reason end));
end $$;

-- ---------------------------------------------------------------- grants

-- Default-privilege revokes do not cover these objects, so revoke explicitly.
revoke all on all tables in schema sila from public, anon, authenticated;
revoke all on all sequences in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila_api from public, anon, authenticated;
grant usage on schema sila_api to scb_app;
grant execute on all functions in schema sila_api to scb_app;

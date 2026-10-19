-- Sila pilot (Gate B): payment opening at the staffed release, closure of
-- sessions that did not fill, and organiser withdrawal (§12, §15, §22, §24).
-- Clocked steps are internal sila.<name>(…, p_now) functions so tests can set
-- the time; the sila_api wrappers take the session lock first and then pass
-- clock_timestamp(), so a deadline is judged after any lock wait.

-- ---------------------------------------------------------------- commit_plan

-- As in 0004, except every time comparison and stamp uses the clock read just
-- after the session lock: the minimum must be reached strictly before 11:00
-- for a same-day release (§12), and transaction-start now() can predate the
-- lock wait. minimum_reached_at then equals the last contributing allocation's
-- committed_at.
create or replace function sila_api.commit_plan(p_actor uuid, p_key text, p_plan uuid, p_places int,
                                                p_terms_version int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('plan', p_plan, 'places', p_places, 'terms_version', p_terms_version);
  replay jsonb; result jsonb; v_session uuid; money jsonb; v_now timestamptz;
  v_live int; v_committed int; v_after int;
  s sila.sessions; p sila.plans; a sila.approvals; al sila.allocations;
begin
  select session_id into v_session from sila.plans where id = p_plan and organiser_id = p_actor;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'commit_plan', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = v_session for update;
  v_now := clock_timestamp();
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
  elsif v_now > s.fill_by then
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
  elsif s.decision_by > ((v_now at time zone 'Europe/London') + interval '21 days') at time zone 'Europe/London' then
    result := sila.err('WAIT_EXCEEDS_LIMIT', 'The final decision is more than 21 days away.');
  else
    money := sila.group_amounts(s.price_minor, p_places, s.deposit_bp);
    insert into sila.allocations (plan_id, session_id, places, price_minor, total_minor, deposit_minor,
                                  balance_minor, terms_version, platform_terms_version, accepted_decision_by,
                                  committed_by, committed_at)
    values (p.id, s.id, p_places, s.price_minor, (money ->> 'total_minor')::bigint,
            (money ->> 'deposit_minor')::bigint, (money ->> 'balance_minor')::bigint, s.terms_version,
            s.platform_terms_version, s.decision_by, p_actor, v_now)
    returning * into al;
    update sila.plans set version = version + 1 where id = p.id returning * into p;
    perform sila.audit(p_actor, s.venue_id, 'commit_plan', 'allocation', al.id, p.version, null);
    perform sila.enqueue('plan.committed', 'plan.committed:' || al.id,
                         jsonb_build_object('plan_id', p.id, 'allocation_id', al.id, 'session_id', s.id));
    if v_after >= s.minimum then
      update sila.sessions set minimum_reached_at = v_now, version = version + 1, updated_at = v_now
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

-- ---------------------------------------------------------------- submit_plan

-- As in 0003, plus MINIMUM_ALREADY_REACHED after the phase check: the pilot
-- adds no clubs once the minimum is reached (§08).
create or replace function sila_api.submit_plan(p_actor uuid, p_key text, p_session uuid, p_club_name text,
                                                p_places int, p_source text)
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
  elsif s.minimum_reached_at is not null then
    result := sila.err('MINIMUM_ALREADY_REACHED', 'This session has already reached its minimum.');
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

-- ---------------------------------------------------------------- read models

-- PlanFacts now report the payment opening for a committed club. A released or
-- withdrawn allocation is not committed; a closed session makes the plan closed.
create or replace function sila.plan_facts(p sila.plans, p_session_phase text) returns jsonb
language sql stable set search_path = '' as $$
  with f as (
    select exists (select 1 from sila.approvals a where a.plan_id = p.id) as approved,
           exists (select 1 from sila.allocations a where a.plan_id = p.id and a.status = 'live') as committed,
           s.minimum_reached_at, s.payment_scheduled_for, s.payment_opening_blocked_reason, s.payment_opened_at
    from sila.sessions s where s.id = p.session_id
  )
  select jsonb_build_object(
    'submitted', true,
    'approved', f.approved,
    'committed', f.committed,
    'closed', p.status = 'declined' or p_session_phase in ('closed', 'cancelled'),
    'minimumReached', f.committed and f.minimum_reached_at is not null,
    'openingBlocked', f.committed and f.minimum_reached_at is not null and f.payment_scheduled_for is null
                      and f.payment_opened_at is null and f.payment_opening_blocked_reason is not null,
    'paymentOpened', f.committed and f.payment_opened_at is not null,
    'ownPaymentReported', false,
    'ownDepositVerified', false,
    'allDepositsVerified', false,
    'confirmed', false,
    'balanceDefaultEstablished', false,
    'amendmentPending', false)
  from f
$$;

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
    -- Payment scheduling and the opening are shown only to a committed club.
    'payment', jsonb_build_object(
      'scheduled_for', case when v_committed then s.payment_scheduled_for end,
      'blocked_reason', case when v_committed and s.payment_scheduled_for is null and s.payment_opened_at is null
                             then s.payment_opening_blocked_reason end,
      'opened_at', case when v_committed then s.payment_opened_at end,
      'pay_by', case when v_committed then s.pay_by end,
      'verify_by', case when v_committed then s.verify_by end)));
end $$;

-- ---------------------------------------------------------------- payment opening

-- End of the approved staffed release window (11:00-12:30 London) on the local
-- date of a scheduled opening (§12, §28). Payment never opens after it.
create function sila.release_window_end(p_scheduled_for timestamptz) returns timestamptz
language sql stable set search_path = '' as $$
  select ((p_scheduled_for at time zone 'Europe/London')::date + time '12:30') at time zone 'Europe/London'
$$;

-- Opens payment at the scheduled staffed release (§12, §22). payment_opened_at,
-- pay_by and verify_by are written once; a repeated call returns them with
-- opened = false. If the live set no longer meets the minimum, the pending
-- scheduling is cleared and SET_CHANGED returned (never after an opening).
-- After 12:30 London on the scheduled date the release is missed: nothing
-- changes and the worker reschedules (reschedule_payment_opening). Opening
-- bumps each committed plan's version so a withdrawal prepared before the
-- opening conflicts instead of silently becoming a venue review.
create function sila.release_payment_opening(p_session uuid, p_now timestamptz, p_pay_by timestamptz,
                                             p_verify_by timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare s sila.sessions; v_live int; al record;
begin
  select * into s from sila.sessions where id = p_session for update;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  if s.payment_opened_at is not null then
    return sila.ok(jsonb_build_object('payment_opened_at', s.payment_opened_at, 'pay_by', s.pay_by,
                                      'verify_by', s.verify_by, 'opened', false));
  end if;
  if s.phase <> 'published' then
    return sila.err('NOT_READY', 'This session is not open.', jsonb_build_object('reason', 'NOT_PUBLISHED'));
  end if;
  perform 1 from sila.allocations where session_id = s.id and status = 'live' for update;
  v_live := sila.committed_places(s.id);
  if v_live < s.minimum then
    if s.minimum_reached_at is not null or s.payment_scheduled_for is not null
       or s.payment_opening_blocked_reason is not null then
      update sila.sessions
         set minimum_reached_at = null, payment_scheduled_for = null, payment_opening_blocked_reason = null,
             version = version + 1, updated_at = p_now
       where id = s.id
      returning * into s;
      perform sila.audit(null, s.venue_id, 'payment_opening_cancelled', 'session', s.id, s.version, 'SET_CHANGED');
    end if;
    return sila.err('NOT_READY', 'The committed places no longer reach the minimum.',
                    jsonb_build_object('reason', 'SET_CHANGED'));
  end if;
  if s.payment_scheduled_for is null or s.payment_scheduled_for > p_now then
    return sila.err('NOT_READY', 'Payment is not due to open yet.', jsonb_build_object('reason', 'NOT_DUE'));
  end if;
  if p_now > sila.release_window_end(s.payment_scheduled_for) then
    return sila.err('NOT_READY', 'The staffed release window for this opening has passed.',
                    jsonb_build_object('reason', 'RELEASE_MISSED'));
  end if;
  if s.intake_paused then
    return sila.err('NOT_READY', 'This session is paused.', jsonb_build_object('reason', 'PAUSED'));
  end if;
  if p_pay_by is null or p_pay_by <= p_now then
    return sila.invalid_fields(jsonb_build_object('pay_by', jsonb_build_array('Pay-by must be after the opening.')));
  end if;
  if p_verify_by is null or p_verify_by <= p_pay_by or p_verify_by >= s.decision_by then
    return sila.invalid_fields(jsonb_build_object('verify_by',
      jsonb_build_array('Verify-by must fall after pay-by and before the final decision.')));
  end if;

  update sila.sessions
     set payment_opened_at = p_now, pay_by = p_pay_by, verify_by = p_verify_by,
         payment_opening_blocked_reason = null, version = version + 1, updated_at = p_now
   where id = s.id
  returning * into s;
  perform sila.audit(null, s.venue_id, 'release_payment_opening', 'session', s.id, s.version, null);
  for al in select id, plan_id from sila.allocations where session_id = s.id and status = 'live' loop
    update sila.plans set version = version + 1 where id = al.plan_id;
    perform sila.enqueue('payment.opened', 'opened:' || al.id,
                         jsonb_build_object('allocation_id', al.id, 'plan_id', al.plan_id, 'session_id', s.id));
  end loop;
  return sila.ok(jsonb_build_object('payment_opened_at', s.payment_opened_at, 'pay_by', s.pay_by,
                                    'verify_by', s.verify_by, 'opened', true));
end $$;

-- Records why payment cannot open as scheduled (for example verification would
-- fall after the final decision). The pending opening is withdrawn so the club
-- sees "payment delayed"; the named coordinator follows up (§12).
create function sila.block_payment_opening(p_session uuid, p_now timestamptz, p_reason text)
returns jsonb language plpgsql set search_path = '' as $$
declare s sila.sessions; v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 500 then
    return sila.invalid_fields(jsonb_build_object('reason',
      jsonb_build_array('Give a reason of up to 500 characters.')));
  end if;
  select * into s from sila.sessions where id = p_session for update;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  if s.phase <> 'published' or s.payment_opened_at is not null or s.minimum_reached_at is null then
    return sila.err('NOT_READY', 'Payment opening cannot be delayed for this session.',
                    jsonb_build_object('reason', 'NOT_PENDING'));
  end if;
  if s.payment_scheduled_for is null and s.payment_opening_blocked_reason is not distinct from v_reason then
    return sila.ok(jsonb_build_object('blocked_reason', v_reason, 'blocked', false));
  end if;
  update sila.sessions
     set payment_scheduled_for = null, payment_opening_blocked_reason = v_reason,
         version = version + 1, updated_at = p_now
   where id = s.id
  returning * into s;
  perform sila.audit(null, s.venue_id, 'block_payment_opening', 'session', s.id, s.version, v_reason);
  perform sila.enqueue('payment.delayed', 'delayed:' || s.id || ':' || v_reason,
                       jsonb_build_object('session_id', s.id));
  return sila.ok(jsonb_build_object('blocked_reason', v_reason, 'blocked', true));
end $$;

-- Closes a published session whose fill deadline passed below the minimum:
-- every live allocation is released without charge (§12, §15).
create function sila.close_unfilled_session(p_session uuid, p_now timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare s sila.sessions; v_released int;
begin
  select * into s from sila.sessions where id = p_session for update;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  if s.phase <> 'published' then
    return sila.err('NOT_READY', 'This session is not open.', jsonb_build_object('reason', 'NOT_PUBLISHED'));
  elsif s.minimum_reached_at is not null then
    return sila.err('NOT_READY', 'This session reached its minimum.', jsonb_build_object('reason', 'MINIMUM_REACHED'));
  elsif p_now <= s.fill_by then
    return sila.err('NOT_READY', 'The fill deadline has not passed.', jsonb_build_object('reason', 'BEFORE_FILL_BY'));
  end if;
  perform 1 from sila.allocations where session_id = s.id and status = 'live' for update;
  update sila.allocations set status = 'released', released_at = p_now
   where session_id = s.id and status = 'live';
  get diagnostics v_released = row_count;
  update sila.sessions
     set phase = 'closed', closed_at = p_now, closed_reason = 'MINIMUM_NOT_REACHED',
         payment_scheduled_for = null, version = version + 1, updated_at = p_now
   where id = s.id
  returning * into s;
  perform sila.audit(null, s.venue_id, 'close_unfilled_session', 'session', s.id, s.version, 'MINIMUM_NOT_REACHED');
  perform sila.enqueue('session.not_proceeding', 'not_proceeding:' || s.id, jsonb_build_object('session_id', s.id));
  return sila.ok(jsonb_build_object('session_id', s.id, 'released_allocations', v_released));
end $$;

-- The session fields the worker needs (ids and scheduling facts only).
create function sila.session_work_json(s sila.sessions) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'minimum_reached_at', s.minimum_reached_at,
                            'covered_dates', to_jsonb(s.covered_dates), 'decision_by', s.decision_by,
                            'payment_window_days', s.payment_window_days,
                            'payment_scheduled_for', s.payment_scheduled_for)
$$;

-- Sessions with due work for the worker, oldest deadline first. A closed,
-- confirmed or cancelled session never appears, so no reminder follows a close.
-- to_release holds openings inside their staffed window; to_reschedule holds
-- openings whose window passed unopened (worker outage, or paused through it).
create function sila.list_session_work(p_now timestamptz, p_limit int default 200)
returns jsonb language sql stable set search_path = '' as $$
  select sila.ok(jsonb_build_object(
    'to_schedule', coalesce((
      select jsonb_agg(sila.session_work_json(s) order by s.minimum_reached_at)
      from (select s.id from sila.sessions s
            where s.phase = 'published' and s.minimum_reached_at is not null and s.payment_scheduled_for is null
              and s.payment_opened_at is null and s.payment_opening_blocked_reason is null
            order by s.minimum_reached_at limit p_limit) w
      join sila.sessions s on s.id = w.id), '[]'::jsonb),
    'to_release', coalesce((
      select jsonb_agg(sila.session_work_json(s) order by s.payment_scheduled_for)
      from (select s.id from sila.sessions s
            where s.phase = 'published' and s.payment_opened_at is null and s.payment_scheduled_for <= p_now
              and p_now <= sila.release_window_end(s.payment_scheduled_for) and not s.intake_paused
            order by s.payment_scheduled_for limit p_limit) w
      join sila.sessions s on s.id = w.id), '[]'::jsonb),
    'to_reschedule', coalesce((
      select jsonb_agg(sila.session_work_json(s) order by s.payment_scheduled_for)
      from (select s.id from sila.sessions s
            where s.phase = 'published' and s.payment_opened_at is null and s.payment_scheduled_for is not null
              and p_now > sila.release_window_end(s.payment_scheduled_for) and not s.intake_paused
            order by s.payment_scheduled_for limit p_limit) w
      join sila.sessions s on s.id = w.id), '[]'::jsonb),
    'to_close', coalesce((
      select jsonb_agg(sila.session_work_json(s) order by s.fill_by)
      from (select s.id from sila.sessions s
            where s.phase = 'published' and s.minimum_reached_at is null and s.fill_by < p_now
            order by s.fill_by limit p_limit) w
      join sila.sessions s on s.id = w.id), '[]'::jsonb)))
$$;

-- ---------------------------------------------------------------- API

-- Server-only worker entry points (no actor; route handlers never expose them).
-- Each takes the session lock before reading the clock.
create function sila_api.release_payment_opening(p_session uuid, p_pay_by timestamptz, p_verify_by timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from sila.sessions where id = p_session for update;
  return sila.release_payment_opening(p_session, clock_timestamp(), p_pay_by, p_verify_by);
end $$;

create function sila_api.block_payment_opening(p_session uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from sila.sessions where id = p_session for update;
  return sila.block_payment_opening(p_session, clock_timestamp(), p_reason);
end $$;

create function sila_api.close_unfilled_session(p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from sila.sessions where id = p_session for update;
  return sila.close_unfilled_session(p_session, clock_timestamp());
end $$;

create function sila_api.list_session_work()
returns jsonb language sql volatile security definer set search_path = '' as $$
  select sila.list_session_work(clock_timestamp())
$$;

-- Server-only: never exposed by a route; it takes no actor. Moves a missed
-- opening to the next staffed release computed by scheduledPaymentOpening from
-- the current instant, or records NO_COVERAGE when none exists. It acts only
-- while the opening is still the one the worker saw and payment has not
-- opened, so a stale or repeated call changes nothing.
create function sila_api.reschedule_payment_opening(p_session uuid, p_expected_scheduled_for timestamptz,
                                                    p_new_scheduled_for timestamptz, p_blocked_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s sila.sessions;
  v_reason text := nullif(trim(coalesce(p_blocked_reason, '')), '');
  v_changed boolean := false;
begin
  if (p_new_scheduled_for is null) = (v_reason is null) or char_length(v_reason) > 500
     or p_new_scheduled_for <= p_expected_scheduled_for then
    return sila.invalid_fields(jsonb_build_object('scheduled_for',
      jsonb_build_array('Give either a later opening time or the reason none is available.')));
  end if;
  select * into s from sila.sessions where id = p_session for update;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  if s.phase = 'published' and s.payment_opened_at is null
     and s.payment_scheduled_for = p_expected_scheduled_for then
    update sila.sessions
       set payment_scheduled_for = p_new_scheduled_for,
           payment_opening_blocked_reason = case when p_new_scheduled_for is null then v_reason end,
           version = version + 1, updated_at = clock_timestamp()
     where id = s.id
    returning * into s;
    v_changed := true;
    perform sila.audit(null, s.venue_id, 'reschedule_payment_opening', 'session', s.id, s.version,
                       coalesce(v_reason, 'RELEASE_MISSED'));
    if p_new_scheduled_for is null then
      perform sila.enqueue('payment.delayed', 'delayed:' || s.id || ':' || v_reason,
                           jsonb_build_object('session_id', s.id));
    else
      perform sila.enqueue('payment.rescheduled', 'rescheduled:' || s.id || ':' || p_new_scheduled_for,
                           jsonb_build_object('session_id', s.id));
    end if;
  end if;
  return sila.ok(jsonb_build_object('payment_scheduled_for', s.payment_scheduled_for,
                                    'blocked_reason', case when s.payment_scheduled_for is null
                                                           then s.payment_opening_blocked_reason end,
                                    'rescheduled', v_changed));
end $$;

-- The organiser withdraws their club's live commitment (§15), mirroring
-- withdrawalOutcome in lib/sila/commitment.ts. Before payment opens the places
-- are released without charge; if the rest then falls below the minimum, the
-- minimum and any scheduled opening are cleared so new commitments can proceed
-- until fill_by. After payment opens the allocation stays live and the venue
-- reviews the request under its accepted cancellation policy. The organiser
-- sends the plan version they saw (§24); opening payment bumps it.
create function sila_api.withdraw_plan(p_actor uuid, p_key text, p_plan uuid, p_expected_version int,
                                       p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  request jsonb := jsonb_build_object('plan', p_plan, 'expected_version', p_expected_version,
                                      'reason', v_reason);
  replay jsonb; result jsonb; v_session uuid; v_now timestamptz; v_after int; v_cancelled boolean;
  s sila.sessions; p sila.plans; al sila.allocations;
begin
  select session_id into v_session from sila.plans where id = p_plan and organiser_id = p_actor;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'withdraw_plan', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = v_session for update;
  v_now := clock_timestamp();
  select * into p from sila.plans where id = p_plan for update;
  perform 1 from sila.allocations where session_id = s.id and status = 'live' for update;
  select * into al from sila.allocations where plan_id = p.id and status = 'live';

  if v_reason is null or char_length(v_reason) > 500 then
    result := sila.invalid_fields(jsonb_build_object('reason',
      jsonb_build_array('Give a reason of up to 500 characters.')));
  elsif p_expected_version is distinct from p.version then
    result := sila.err('VERSION_CONFLICT', 'This plan has changed. Reload it and review before withdrawing.',
                       jsonb_build_object('version', p.version));
  elsif al.id is null then
    result := sila.err('NOT_COMMITTED', 'This club has no committed places to withdraw.');
  elsif s.payment_opened_at is not null then
    update sila.allocations
       set withdrawal_requested_at = coalesce(withdrawal_requested_at, v_now),
           withdrawal_reason = coalesce(withdrawal_reason, v_reason)
     where id = al.id;
    update sila.plans set version = version + 1 where id = p.id returning * into p;
    perform sila.audit(p_actor, s.venue_id, 'request_withdrawal', 'allocation', al.id, p.version, v_reason);
    perform sila.enqueue('withdrawal.review', 'withdrawal.review:' || al.id,
                         jsonb_build_object('allocation_id', al.id, 'plan_id', p.id, 'session_id', s.id));
    result := sila.ok(jsonb_build_object('outcome', 'venue_review', 'cancelled_scheduled_opening', false,
                                         'committed_places', sila.committed_places(s.id)));
  else
    update sila.allocations set status = 'withdrawn', withdrawn_at = v_now, withdrawal_reason = v_reason
     where id = al.id;
    v_after := sila.committed_places(s.id);
    v_cancelled := s.payment_scheduled_for is not null and v_after < s.minimum;
    if v_after < s.minimum and (s.minimum_reached_at is not null or s.payment_scheduled_for is not null
                                or s.payment_opening_blocked_reason is not null) then
      update sila.sessions
         set minimum_reached_at = null, payment_scheduled_for = null, payment_opening_blocked_reason = null,
             version = version + 1, updated_at = v_now
       where id = s.id
      returning * into s;
      perform sila.audit(p_actor, s.venue_id, 'payment_opening_cancelled', 'session', s.id, s.version,
                         'WITHDRAWAL');
    end if;
    update sila.plans set version = version + 1 where id = p.id returning * into p;
    perform sila.audit(p_actor, s.venue_id, 'withdraw_plan', 'allocation', al.id, p.version, v_reason);
    perform sila.enqueue('plan.withdrawn', 'plan.withdrawn:' || al.id,
                         jsonb_build_object('allocation_id', al.id, 'plan_id', p.id, 'session_id', s.id));
    result := sila.ok(jsonb_build_object('outcome', 'released', 'cancelled_scheduled_opening', v_cancelled,
                                         'committed_places', v_after));
  end if;
  return sila.idem_finish(p_actor, p_key, 'withdraw_plan', request, result);
end $$;

-- ---------------------------------------------------------------- grants

revoke all on all tables in schema sila from public, anon, authenticated;
revoke all on all sequences in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila_api from public, anon, authenticated;
grant usage on schema sila_api to scb_app;
grant execute on all functions in schema sila_api to scb_app;

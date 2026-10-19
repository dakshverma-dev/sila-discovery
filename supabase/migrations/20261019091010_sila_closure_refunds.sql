-- P0 07 / §§12, 17, 18, 22, 24, 27: close without losing received money.
-- Calendar versions are immutable. The global version has no venue closures;
-- approved venue-specific versions can add closures before publication.
create table sila.business_calendars (
  version text primary key,
  venue_id uuid references sila.venues(id),
  holidays date[] not null,
  closures date[] not null default '{}',
  approved_by uuid references sila.people(id),
  created_at timestamptz not null default now()
);
insert into sila.business_calendars(version, holidays) values (
  'scotland-2026-2027.v1+closures.none', array[
    '2026-01-01','2026-01-02','2026-04-03','2026-05-04','2026-05-25','2026-08-03',
    '2026-11-30','2026-12-25','2026-12-28','2027-01-01','2027-01-04','2027-03-26',
    '2027-05-03','2027-05-31','2027-08-02','2027-11-30','2027-12-27','2027-12-28']::date[]);
create table sila.session_closures (
  session_id uuid primary key references sila.sessions(id),
  cause text not null check (cause in ('unconfirmed','venue_fault')),
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  closed_at timestamptz not null,
  refund_target_at timestamptz,
  calendar_version text not null,
  terms_version int not null,
  actor_id uuid references sila.people(id)
);
create table sila.refund_entries (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references sila.allocations(id),
  venue_id uuid not null references sila.venues(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'GBP' check (currency = 'GBP'),
  reference text not null check (char_length(trim(reference)) between 1 and 100),
  reference_norm text generated always as (upper(trim(reference))) stored,
  returned_at timestamptz not null,
  verified_at timestamptz not null default now(),
  evidence text not null check (char_length(trim(evidence)) between 1 and 1000),
  actor_id uuid not null references sila.people(id),
  unique (venue_id, reference_norm)
);
create index on sila.refund_entries(allocation_id);
alter table sila.business_calendars enable row level security;
alter table sila.session_closures enable row level security;
alter table sila.refund_entries enable row level security;
revoke all on sila.business_calendars, sila.session_closures, sila.refund_entries from public, anon, authenticated, scb_app;
create trigger calendar_versions_immutable before update or delete on sila.business_calendars
  for each row execute function sila.financial_entries_append_only();
create trigger session_closures_immutable before update or delete on sila.session_closures
  for each row execute function sila.financial_entries_append_only();
create trigger refund_entries_immutable before update or delete on sila.refund_entries
  for each row execute function sila.financial_entries_append_only();

create function sila.refund_target(p_closed timestamptz, p_version text, p_venue uuid)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare c sila.business_calendars; d date := (p_closed at time zone 'Europe/London')::date; n int := 0; attempts int := 0;
begin
  select * into c from sila.business_calendars where version = p_version and (venue_id is null or venue_id = p_venue);
  if not found then return null; end if;
  while n < 5 and attempts < 300 loop
    d := d + 1; attempts := attempts + 1;
    if extract(isodow from d) < 6 and not (d = any(c.holidays)) and not (d = any(c.closures)) then n := n + 1; end if;
  end loop;
  if n < 5 then return null; end if;
  return (d + time '12:00') at time zone 'Europe/London';
end $$;

-- Existing unfilled closures also owe back any subsequently received money.
-- A null actor truthfully denotes the historical worker, not venue approval.
insert into sila.session_closures(session_id,cause,reason,closed_at,refund_target_at,calendar_version,terms_version,actor_id)
select s.id,'unconfirmed',coalesce(nullif(trim(s.closed_reason),''),'Unconfirmed session closed'),
  coalesce(s.closed_at,s.updated_at),sila.refund_target(coalesce(s.closed_at,s.updated_at),s.calendar_version,s.venue_id),
  coalesce(s.calendar_version,'unknown'),s.terms_version,null
from sila.sessions s where s.phase='closed';

create function sila.refund_json(p_allocation uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('allocation_id', a.id, 'cause', c.cause, 'reason', c.reason,
    'closed_at', c.closed_at, 'target_at', c.refund_target_at, 'venue_owner', v.name,
    'received_minor', amounts.received, 'refunded_minor', amounts.refunded,
    'due_minor', greatest(0, amounts.received - amounts.refunded),
    'status', case when amounts.received = 0 then 'no_payment_received'
                   when amounts.refunded >= amounts.received then 'refunded' else 'refund_due' end,
    'entries', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'amount_minor', r.amount_minor,
      'reference', r.reference, 'returned_at', r.returned_at, 'verified_at', r.verified_at) order by r.verified_at, r.id)
      from sila.refund_entries r where r.allocation_id = a.id), '[]'::jsonb))
  from sila.allocations a join sila.session_closures c on c.session_id = a.session_id
  join sila.sessions s on s.id = a.session_id join sila.venues v on v.id = s.venue_id
  cross join lateral (select greatest(0, sila.verified_minor(a.id, 'deposit') + sila.verified_minor(a.id, 'balance')) as received,
    coalesce((select sum(r.amount_minor) from sila.refund_entries r where r.allocation_id = a.id), 0) as refunded) amounts
  where a.id = p_allocation
$$;

-- Caller already holds the session lock. All competing receipt/confirmation
-- commands take this same lock first; allocations and plans follow in id order.
create function sila.close_locked(s sila.sessions, p_actor uuid, p_cause text, p_reason text, p_now timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare target timestamptz;
begin
  target := sila.refund_target(p_now, s.calendar_version, s.venue_id);
  perform 1 from sila.allocations where session_id = s.id order by id for update;
  perform 1 from sila.plans where session_id = s.id order by id for update;
  insert into sila.session_closures(session_id, cause, reason, closed_at, refund_target_at, calendar_version, terms_version, actor_id)
  values (s.id, p_cause, trim(p_reason), p_now, target, coalesce(s.calendar_version, 'unknown'), s.terms_version, p_actor);
  update sila.allocations set status = 'released', released_at = p_now where session_id = s.id and status = 'live';
  update sila.plans set version = version + 1 where session_id = s.id;
  update sila.sessions set phase = case when p_cause = 'venue_fault' then 'cancelled' else 'closed' end,
    closed_at = p_now, closed_reason = trim(p_reason), payment_scheduled_for = null,
    intake_paused = true, intake_paused_reason = trim(p_reason),
    version = version + 1, updated_at = p_now where id = s.id;
  perform sila.audit(p_actor, s.venue_id, 'close_session', 'session', s.id, s.version + 1, p_cause || ': ' || trim(p_reason));
  perform sila.enqueue(case when p_reason='MINIMUM_NOT_REACHED' then 'session.not_proceeding' else 'session.closed' end,
    case when p_reason='MINIMUM_NOT_REACHED' then 'not_proceeding:' else 'session.closed:' end || s.id,
    jsonb_build_object('session_id', s.id, 'cause', p_cause));
  if target is null then
    perform sila.enqueue('refund.calendar_required', 'refund.calendar_required:' || s.id, jsonb_build_object('session_id', s.id));
  end if;
  return sila.ok(jsonb_build_object('session_id', s.id, 'version', s.version + 1, 'cause', p_cause,
    'refund_target_at', target, 'closed_at', p_now, 'calendar_blocked', target is null));
end $$;

-- Fill-deadline failure shares the same financial closure, even if money
-- unexpectedly arrives before payment was ever opened (§17, §18).
create or replace function sila.close_unfilled_session(p_session uuid,p_now timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare s sila.sessions; released int; result jsonb;
begin
  select * into s from sila.sessions where id=p_session for update;
  if not found then return sila.err('NOT_FOUND','Not found.'); end if;
  if s.phase <> 'published' then
    return sila.err('NOT_READY','This session is not open.',jsonb_build_object('reason','NOT_PUBLISHED'));
  elsif s.minimum_reached_at is not null then
    return sila.err('NOT_READY','This session reached its minimum.',jsonb_build_object('reason','MINIMUM_REACHED'));
  elsif p_now <= s.fill_by then
    return sila.err('NOT_READY','The fill deadline has not passed.',jsonb_build_object('reason','BEFORE_FILL_BY'));
  end if;
  select count(*) into released from sila.allocations where session_id=s.id and status='live';
  result := sila.close_locked(s,null,'unconfirmed','MINIMUM_NOT_REACHED',p_now);
  return jsonb_set(result,'{data,released_allocations}',to_jsonb(released));
end $$;

create function sila.close_session(p_actor uuid, p_key text, p_session uuid, p_version int,
  p_cause text, p_reason text, p_now timestamptz) returns jsonb
language plpgsql set search_path = '' as $$
declare s sila.sessions; venue uuid; replay jsonb; result jsonb;
  request jsonb := jsonb_build_object('session', p_session, 'expected_version', p_version, 'cause', p_cause, 'reason', p_reason);
begin
  select venue_id into venue from sila.sessions where id = p_session;
  if not found or not ('coordinator' = any(sila.venue_roles(p_actor, venue))) then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'close_session', request);
  if replay is not null then return replay; end if;
  select * into s from sila.sessions where id = p_session for update;
  if p_version is distinct from s.version then result := sila.err('VERSION_CONFLICT', 'This session changed. Reload and review it.');
  elsif p_cause is null or p_cause not in ('unconfirmed','venue_fault') or p_reason is null or char_length(trim(p_reason)) not between 1 and 500 then
    result := sila.invalid_fields(jsonb_build_object('reason', jsonb_build_array('Choose a closure cause and give a reason of 1 to 500 characters.')));
  elsif (p_cause = 'unconfirmed' and s.phase <> 'published') or (p_cause = 'venue_fault' and s.phase <> 'confirmed') then
    result := sila.err('SESSION_NOT_OPEN', 'This cause does not apply to the current session state.');
  else result := sila.close_locked(s, p_actor, p_cause, p_reason, coalesce(p_now, clock_timestamp())); end if;
  return sila.idem_finish(p_actor, p_key, 'close_session', request, result);
end $$;
create function sila_api.close_session(p_actor uuid, p_key text, p_session uuid, p_version int, p_cause text, p_reason text)
returns jsonb language sql security definer set search_path = '' as $$
  select sila.close_session(p_actor, p_key, p_session, p_version, p_cause, p_reason, null)
$$;

create function sila.close_decision_sessions(p_now timestamptz) returns jsonb
language plpgsql set search_path = '' as $$
declare s sila.sessions; result jsonb; closed int := 0; blocked int := 0; instant timestamptz;
begin
  -- Keep the closure boundary inclusive for an on-time confirmation; close
  -- strictly after decision_by, using the DB clock after the lock wait (§12).
  for s in select * from sila.sessions where phase = 'published'
      and decision_by < coalesce(p_now, clock_timestamp()) order by id limit 100 for update skip locked loop
    instant := coalesce(p_now, clock_timestamp());
    result := sila.close_locked(s, null, 'unconfirmed', 'Final decision passed without venue confirmation', instant);
    if (result->>'ok')::boolean then
      closed := closed + 1;
      if (result->'data'->>'calendar_blocked')::boolean then blocked := blocked + 1; end if;
    else blocked := blocked + 1; end if;
  end loop;
  return sila.ok(jsonb_build_object('closed', closed, 'blocked', blocked));
end $$;
create function sila_api.close_decision_sessions() returns jsonb
language sql security definer set search_path = '' as $$ select sila.close_decision_sessions(null) $$;

create function sila_api.record_refund(p_actor uuid, p_key text, p_allocation uuid, p_version int,
  p_amount bigint, p_reference text, p_returned timestamptz, p_evidence text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s sila.sessions; c sila.session_closures; al sila.allocations; r sila.refund_entries;
  venue uuid; session uuid; replay jsonb; result jsonb; due bigint; instant timestamptz;
  request jsonb := jsonb_build_object('allocation', p_allocation, 'expected_version', p_version, 'amount_minor', p_amount,
    'reference', p_reference, 'returned_at', p_returned, 'evidence', p_evidence);
begin
  select a.session_id, ss.venue_id into session, venue from sila.allocations a join sila.sessions ss on ss.id = a.session_id where a.id = p_allocation;
  if not found or not ('finance' = any(sila.venue_roles(p_actor, venue))) then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'record_refund', request);
  if replay is not null then return replay; end if;
  select * into s from sila.sessions where id = session for update;
  select * into al from sila.allocations where id = p_allocation for update;
  select * into c from sila.session_closures where session_id = s.id;
  instant := clock_timestamp();
  due := (sila.refund_json(al.id)->>'due_minor')::bigint;
  if p_version is distinct from s.version then result := sila.err('VERSION_CONFLICT', 'This session changed. Reload and review it.');
  elsif c.session_id is null then result := sila.err('NOT_READY', 'No closure refund obligation exists.');
  elsif p_amount is null or p_amount <= 0 or p_reference is null or char_length(trim(p_reference)) not between 1 and 100
    or p_evidence is null or char_length(trim(p_evidence)) not between 1 and 1000 or p_returned is null
    or p_returned > instant or p_returned < c.closed_at then
      result := sila.invalid_fields(jsonb_build_object('refund', jsonb_build_array('Record a positive amount, venue reference, evidence and actual return time after closure.')));
  elsif exists(select 1 from sila.refund_entries where venue_id = venue and reference_norm = upper(trim(p_reference))) then
    result := sila.err('DUPLICATE_RECEIPT', 'This venue has already recorded that refund reference.');
  elsif p_amount > due then result := sila.err('NOT_READY', 'This return exceeds the current refund due.');
  else
    begin
      insert into sila.refund_entries(allocation_id, venue_id, amount_minor, reference, returned_at, evidence, actor_id, verified_at)
      values(al.id, venue, p_amount, trim(p_reference), p_returned, trim(p_evidence), p_actor, instant) returning * into r;
      update sila.sessions set version = version + 1, updated_at = instant where id = s.id;
      perform sila.audit(p_actor, venue, 'record_refund', 'refund_entry', r.id, s.version + 1, null);
      perform sila.enqueue('refund.verified', 'refund.verified:' || r.id, jsonb_build_object('allocation_id', al.id, 'session_id', s.id));
      result := sila.ok(jsonb_build_object('refund', sila.refund_json(al.id), 'version', s.version + 1));
    exception when unique_violation then result := sila.err('DUPLICATE_RECEIPT', 'This venue has already recorded that refund reference.'); end;
  end if;
  return sila.idem_finish(p_actor, p_key, 'record_refund', request, result);
end $$;

alter function sila_api.get_my_plan(uuid, uuid) rename to get_my_plan_before_refunds;
create function sila_api.get_my_plan(p_actor uuid, p_plan uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; allocation uuid;
begin
  result := sila_api.get_my_plan_before_refunds(p_actor, p_plan);
  if not (result->>'ok')::boolean then return result; end if;
  select id into allocation from sila.allocations where plan_id = p_plan order by committed_at desc, id desc limit 1;
  return jsonb_set(result, '{data,refund}', coalesce(sila.refund_json(allocation), 'null'::jsonb));
end $$;
alter function sila_api.get_venue_session(uuid, uuid) rename to get_venue_session_before_refunds;
create function sila_api.get_venue_session(p_actor uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; refunds jsonb;
begin
  result := sila_api.get_venue_session_before_refunds(p_actor, p_session);
  if not (result->>'ok')::boolean then return result; end if;
  select coalesce(jsonb_agg(sila.refund_json(a.id) order by a.id), '[]'::jsonb) into refunds
    from sila.allocations a where a.session_id = p_session and exists(select 1 from sila.session_closures where session_id = p_session);
  return jsonb_set(result, '{data,refunds}', refunds);
end $$;

revoke all on all functions in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila_api from public, anon, authenticated;
revoke all on function sila_api.get_my_plan_before_refunds(uuid,uuid), sila_api.get_venue_session_before_refunds(uuid,uuid) from scb_app;
grant execute on function sila_api.close_session(uuid,text,uuid,int,text,text), sila_api.close_decision_sessions(),
  sila_api.record_refund(uuid,text,uuid,int,bigint,text,timestamptz,text),
  sila_api.get_my_plan(uuid,uuid), sila_api.get_venue_session(uuid,uuid) to scb_app;

-- §18: preserve money arriving after closure; it increases the derived refund due.
create or replace function sila.record_receipt(p_actor uuid, p_key text, p_allocation uuid, p_kind text, p_amount_minor int,
                                    p_received_at timestamptz, p_receipt_id text, p_evidence text,
                                    p_now timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('allocation', p_allocation, 'kind', p_kind, 'amount_minor', p_amount_minor,
                                      'received_at', p_received_at, 'receipt_id', p_receipt_id,
                                      'evidence', p_evidence);
  replay jsonb; result jsonb; errors jsonb; v_session uuid; v_venue uuid; v_now timestamptz;
  v_receipt text := trim(coalesce(p_receipt_id, ''));
  v_evidence text := nullif(trim(coalesce(p_evidence, '')), '');
  s sila.sessions; al sila.allocations; e sila.financial_entries;
begin
  select a.session_id, ss.venue_id into v_session, v_venue
    from sila.allocations a join sila.sessions ss on ss.id = a.session_id where a.id = p_allocation;
  if not found or not (sila.venue_roles(p_actor, v_venue) && array['coordinator', 'finance']) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  replay := sila.idem_begin(p_actor, p_key, 'record_receipt', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = v_session for update;
  v_now := coalesce(p_now, clock_timestamp());
  select * into al from sila.allocations where id = p_allocation for update;

  errors := sila.payment_field_errors(p_kind, p_amount_minor);
  if p_received_at is null then
    errors := errors || jsonb_build_object('received_at', jsonb_build_array('Enter when the money was received.'));
  elsif p_received_at > v_now then
    errors := errors || jsonb_build_object('received_at', jsonb_build_array('The receipt time cannot be in the future.'));
  end if;
  if char_length(v_receipt) not between 1 and 100 then
    errors := errors || jsonb_build_object('receipt_id', jsonb_build_array('Enter the venue receipt identifier (up to 100 characters).'));
  end if;
  if char_length(v_evidence) > 1000 then
    errors := errors || jsonb_build_object('evidence', jsonb_build_array('Use at most 1000 characters.'));
  end if;

  if errors <> '{}'::jsonb then
    result := sila.invalid_fields(errors);
  elsif s.payment_opened_at is null and s.phase not in ('closed','cancelled') then
    result := sila.err('PAYMENT_NOT_OPEN', 'Payment has not opened for this session.');
  elsif al.status <> 'live' and not (s.phase in ('closed','cancelled') and al.status in ('released','withdrawn')) then
    result := sila.err('NOT_COMMITTED', 'This club has no committed places.');
  elsif exists (select 1 from sila.financial_entries
                where venue_id = s.venue_id and entry_type = 'receipt' and receipt_id_norm = upper(v_receipt)) then
    result := sila.err('DUPLICATE_RECEIPT', 'This venue has already recorded that receipt identifier.');
  else
    begin
      insert into sila.financial_entries (venue_id, allocation_id, kind, entry_type, amount_minor, receipt_id,
                                          receipt_id_norm, received_at, verified_at, evidence, actor_id)
      values (s.venue_id, al.id, p_kind, 'receipt', p_amount_minor, v_receipt, upper(v_receipt), p_received_at,
              v_now, v_evidence, p_actor)
      returning * into e;
      perform sila.audit(p_actor, s.venue_id, 'record_receipt', 'financial_entry', e.id, null, p_kind);
      perform sila.enqueue('receipt.recorded', 'receipt.recorded:' || e.id,
                           jsonb_build_object('entry_id', e.id, 'allocation_id', al.id, 'plan_id', al.plan_id,
                                              'session_id', s.id));
      result := sila.ok(jsonb_build_object(
        'entry_id', e.id, 'allocation_id', al.id, 'session_id', s.id, 'kind', e.kind,
        'amount_minor', e.amount_minor, 'currency', e.currency, 'receipt_id', e.receipt_id,
        'received_at', e.received_at, 'verified_at', e.verified_at, 'timely', e.received_at <= s.pay_by,
        'verified_deposit_minor', sila.verified_minor(al.id, 'deposit'),
        'verified_balance_minor', sila.verified_minor(al.id, 'balance')));
    exception when unique_violation then
      -- The same identifier was recorded concurrently on another session of this venue.
      result := sila.err('DUPLICATE_RECEIPT', 'This venue has already recorded that receipt identifier.');
    end;
  end if;
  return sila.idem_finish(p_actor, p_key, 'record_receipt', request, result);
end $$;

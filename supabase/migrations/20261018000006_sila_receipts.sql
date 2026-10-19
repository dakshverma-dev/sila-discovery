-- Sila pilot (Gate B): organiser payment reports, the venue's append-only
-- receipt ledger and venue confirmation (§12, §17, §18, §24).
-- A report is only what someone says they paid; only a verified receipt
-- recorded by venue finance or a coordinator counts (§18). There is no function
-- letting an organiser or an operator verify a payment (§24). Confirmation
-- repeats confirmationBlockers (lib/sila/confirmation.ts) under the session
-- lock, in the same order and with the same names.
-- Clocked steps are internal sila.<name>(…, p_now) functions so tests can set
-- the time; with p_now null (the sila_api wrappers) the clock is read just after
-- the session lock, so a deadline is judged after any lock wait.

-- ---------------------------------------------------------------- tables

create table sila.payment_reports (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references sila.allocations (id) on delete restrict,
  kind text not null check (kind in ('deposit', 'balance')),
  amount_minor int not null check (amount_minor > 0),
  reference text not null check (char_length(reference) between 1 and 100 and reference = trim(reference)),
  reported_by uuid references sila.people (id) on delete set null,
  reported_at timestamptz not null default now()
);
create index payment_reports_allocation_idx on sila.payment_reports (allocation_id, reported_at);

-- Append-only ledger (§18). A receipt carries the venue's own identifier,
-- unique per venue after trimming and upper-casing, so the same money cannot
-- count twice. A correction is a new row that references the original entry.
create table sila.financial_entries (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references sila.venues (id) on delete restrict,
  allocation_id uuid not null references sila.allocations (id) on delete restrict,
  kind text not null check (kind in ('deposit', 'balance')),
  entry_type text not null default 'receipt' check (entry_type in ('receipt', 'correction')),
  amount_minor int not null check (amount_minor <> 0),
  currency text not null default 'GBP' check (currency = 'GBP'),
  receipt_id text check (char_length(receipt_id) between 1 and 100 and receipt_id = trim(receipt_id)),
  receipt_id_norm text,
  received_at timestamptz,
  verified_at timestamptz not null default now(),
  evidence text check (char_length(evidence) <= 1000),
  -- Restrict, not set null: the ledger keeps its actor and cannot be updated.
  actor_id uuid references sila.people (id) on delete restrict,
  corrects_entry_id uuid references sila.financial_entries (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (receipt_id_norm is not distinct from upper(receipt_id)),
  check (entry_type <> 'receipt'
         or (amount_minor > 0 and receipt_id is not null and received_at is not null and corrects_entry_id is null)),
  check (entry_type <> 'correction' or corrects_entry_id is not null)
);
create unique index financial_entries_receipt_uq on sila.financial_entries (venue_id, receipt_id_norm)
  where entry_type = 'receipt';
create index financial_entries_allocation_idx on sila.financial_entries (allocation_id, created_at);

create function sila.financial_entries_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'sila.financial_entries is append-only; record a correction entry instead'
    using errcode = 'restrict_violation';
end $$;

create trigger financial_entries_append_only
  before update or delete on sila.financial_entries
  for each row execute function sila.financial_entries_append_only();

create table sila.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sila.sessions (id) on delete restrict,
  booking_number bigint generated always as identity (start with 1001) unique,
  confirmed_by uuid references sila.people (id) on delete set null,
  confirmed_at timestamptz not null,
  diary_checked_at timestamptz not null,
  snapshot jsonb not null
);

-- Each group's own financial snapshot at confirmation.
create table sila.booking_groups (
  booking_id uuid not null references sila.bookings (id) on delete restrict,
  allocation_id uuid not null unique references sila.allocations (id) on delete restrict,
  plan_id uuid not null references sila.plans (id) on delete restrict,
  places int not null check (places > 0),
  total_minor bigint not null check (total_minor >= 0),
  deposit_minor bigint not null check (deposit_minor >= 0),
  balance_minor bigint not null check (balance_minor >= 0),
  deposit_verified_minor bigint not null,
  primary key (booking_id, allocation_id)
);
create index booking_groups_plan_idx on sila.booking_groups (plan_id);

alter table sila.payment_reports enable row level security;
alter table sila.financial_entries enable row level security;
alter table sila.bookings enable row level security;
alter table sila.booking_groups enable row level security;

-- ---------------------------------------------------------------- helpers

-- Net verified amount for one allocation and obligation: receipts plus any
-- corrections that reference them.
create function sila.verified_minor(p_allocation uuid, p_kind text) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(amount_minor), 0)::bigint from sila.financial_entries
  where allocation_id = p_allocation and kind = p_kind
$$;

create function sila.booking_ref(p_number bigint) returns text
language sql immutable set search_path = '' as $$
  select 'SL' || p_number
$$;

-- Blockers in the order and with the names of confirmationBlockers
-- (lib/sila/confirmation.ts): [{code, allocation_id?}].
create function sila.confirmation_blockers(s sila.sessions, p_diary_checked boolean, p_now timestamptz)
returns jsonb language plpgsql stable set search_path = '' as $$
declare b jsonb := '[]'; al record;
begin
  if s.payment_opened_at is null then
    b := b || jsonb_build_array(jsonb_build_object('code', 'PAYMENT_NOT_OPENED'));
  end if;
  if sila.committed_places(s.id) < s.minimum then
    b := b || jsonb_build_array(jsonb_build_object('code', 'MINIMUM_NOT_MET'));
  end if;
  for al in select a.id, a.deposit_minor from sila.allocations a
             where a.session_id = s.id and a.status = 'live' order by a.committed_at, a.id loop
    if sila.verified_minor(al.id, 'deposit') < al.deposit_minor then
      b := b || jsonb_build_array(jsonb_build_object('code', 'DEPOSIT_NOT_VERIFIED', 'allocation_id', al.id));
    end if;
  end loop;
  if s.hold_expires_at is null or s.hold_expires_at < p_now then
    b := b || jsonb_build_array(jsonb_build_object('code', 'RESOURCE_HOLD_EXPIRED'));
  end if;
  if not coalesce(p_diary_checked, false) then
    b := b || jsonb_build_array(jsonb_build_object('code', 'DIARY_NOT_CHECKED'));
  end if;
  if p_now > s.decision_by then
    b := b || jsonb_build_array(jsonb_build_object('code', 'DECISION_DEADLINE_PASSED'));
  end if;
  return b;
end $$;

-- Field errors shared by reports and receipts.
create function sila.payment_field_errors(p_kind text, p_amount_minor int) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare errors jsonb := '{}';
begin
  if p_kind is null or p_kind not in ('deposit', 'balance') then
    errors := errors || jsonb_build_object('kind', jsonb_build_array('Choose deposit or balance.'));
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    errors := errors || jsonb_build_object('amount_minor', jsonb_build_array('Enter an amount above zero.'));
  end if;
  return errors;
end $$;

create function sila.report_json(r sila.payment_reports) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('report_id', r.id, 'allocation_id', r.allocation_id, 'kind', r.kind,
                            'amount_minor', r.amount_minor, 'reference', r.reference, 'reported_at', r.reported_at)
$$;

create function sila.reports_json(p_allocation uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(sila.report_json(r) order by r.reported_at, r.id), '[]'::jsonb)
  from sila.payment_reports r where r.allocation_id = p_allocation
$$;

-- Ledger entries for one allocation (venue view). timely compares received_at
-- with the session's pay_by; verification time never affects it (§12).
create function sila.receipts_json(p_allocation uuid, p_pay_by timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'entry_id', e.id, 'entry_type', e.entry_type, 'kind', e.kind, 'amount_minor', e.amount_minor,
           'currency', e.currency, 'receipt_id', e.receipt_id, 'received_at', e.received_at,
           'verified_at', e.verified_at, 'evidence', e.evidence, 'corrects_entry_id', e.corrects_entry_id,
           'timely', case when e.received_at is not null and p_pay_by is not null
                          then e.received_at <= p_pay_by end)
         order by e.created_at, e.id), '[]'::jsonb)
  from sila.financial_entries e where e.allocation_id = p_allocation
$$;

-- ---------------------------------------------------------------- read models

-- PlanFacts with the payment, verification and confirmation facts filled.
-- Own facts describe this plan's live allocation only; allDepositsVerified
-- covers every live allocation on the session without revealing amounts.
-- confirmed requires this plan's group to be part of the session's booking.
create or replace function sila.plan_facts(p sila.plans, p_session_phase text) returns jsonb
language sql stable set search_path = '' as $$
  with f as (
    select exists (select 1 from sila.approvals a where a.plan_id = p.id) as approved,
           al.id is not null as committed,
           s.minimum_reached_at, s.payment_scheduled_for, s.payment_opening_blocked_reason, s.payment_opened_at,
           exists (select 1 from sila.payment_reports r where r.allocation_id = al.id) as reported,
           al.id is not null and sila.verified_minor(al.id, 'deposit') >= al.deposit_minor as own_verified,
           not exists (select 1 from sila.allocations o
                       where o.session_id = s.id and o.status = 'live'
                         and sila.verified_minor(o.id, 'deposit') < o.deposit_minor) as all_verified,
           s.phase = 'confirmed'
             and exists (select 1 from sila.bookings b join sila.booking_groups g on g.booking_id = b.id
                         where b.session_id = s.id and g.plan_id = p.id) as booked
    from sila.sessions s
    left join sila.allocations al on al.plan_id = p.id and al.status = 'live'
    where s.id = p.session_id
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
    'ownPaymentReported', f.committed and f.reported,
    'ownDepositVerified', f.committed and f.own_verified,
    'allDepositsVerified', f.committed and f.payment_opened_at is not null and f.all_verified,
    'confirmed', f.booked,
    'balanceDefaultEstablished', false,
    'amendmentPending', false)
  from f
$$;

create or replace function sila_api.get_my_plan(p_actor uuid, p_plan uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p sila.plans; s sila.sessions; al sila.allocations; v_committed boolean; v_opened boolean; v_booking text;
begin
  select * into p from sila.plans where id = p_plan and organiser_id = p_actor;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  select * into s from sila.sessions where id = p.session_id;
  select * into al from sila.allocations where plan_id = p.id and status = 'live';
  v_committed := al.id is not null;
  v_opened := v_committed and s.payment_opened_at is not null;
  select sila.booking_ref(b.booking_number) into v_booking
    from sila.bookings b join sila.booking_groups g on g.booking_id = b.id
   where b.session_id = s.id and g.plan_id = p.id and s.phase = 'confirmed';
  return sila.ok(jsonb_build_object(
    'plan', jsonb_build_object('id', p.id, 'plan_ref', 'PL' || p.plan_number, 'club_name', p.club_name,
                               'requested_places', p.requested_places, 'source', p.source, 'status', p.status,
                               'declined_reason', p.declined_reason, 'version', p.version),
    'session', sila.public_session_json(p.session_id),
    'messages', sila.plan_messages_json(p.id, p_actor),
    'facts', sila.plan_facts(p, s.phase),
    'approval', sila.plan_approval_json(p.id),
    'allocation', sila.plan_allocation_json(p.id),
    -- Payment facts are shown only to a committed club, and only its own:
    -- never another club's amounts, reports or receipts. The payment route
    -- appears once payment has opened.
    'payment', jsonb_build_object(
      'scheduled_for', case when v_committed then s.payment_scheduled_for end,
      'blocked_reason', case when v_committed and s.payment_scheduled_for is null and s.payment_opened_at is null
                             then s.payment_opening_blocked_reason end,
      'opened_at', case when v_committed then s.payment_opened_at end,
      'pay_by', case when v_committed then s.pay_by end,
      'verify_by', case when v_committed then s.verify_by end,
      'payment_route', case when v_opened then s.payment_route end,
      'reports', case when v_committed then sila.reports_json(al.id) else '[]'::jsonb end,
      'verified_deposit_minor', case when v_committed then sila.verified_minor(al.id, 'deposit') end),
    'booking', case when v_booking is not null then jsonb_build_object('booking_ref', v_booking) end));
end $$;

-- Venue view of one session: every column, the venue, the caller's roles, each
-- club's allocation with its reports, ledger entries and verified totals, and
-- the booking once confirmed. Coordinator, finance or operator (read-only).
create or replace function sila_api.get_venue_session(p_actor uuid, p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s sila.sessions; v sila.venues;
begin
  select * into s from sila.sessions where id = p_session;
  if not found or not sila.can_view_venue(p_actor, s.venue_id) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  select * into v from sila.venues where id = s.venue_id;
  return sila.ok(jsonb_build_object(
    'session', to_jsonb(s),
    'venue', jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address, 'time_zone', v.time_zone,
                                'access_facts', v.access_facts, 'contact_email', v.contact_email,
                                'contact_phone', v.contact_phone),
    'roles', to_jsonb(sila.venue_roles(p_actor, s.venue_id)),
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

-- ---------------------------------------------------------------- commands

-- Venue finance or coordinator records money actually received (§18).
-- verified_at is the clock at recording; timeliness uses received_at only.
create function sila.record_receipt(p_actor uuid, p_key text, p_allocation uuid, p_kind text, p_amount_minor int,
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
  elsif s.payment_opened_at is null then
    result := sila.err('PAYMENT_NOT_OPEN', 'Payment has not opened for this session.');
  elsif al.status <> 'live' then
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

-- Only the venue coordinator confirms (§08, §17). Blockers are returned as
-- NOT_READY and stored under the key; a retry with a new key re-evaluates.
-- Success creates the booking and each group's snapshot, then queues
-- booking.confirmed for practical details (an email failure cannot undo it).
create function sila.confirm_session(p_actor uuid, p_key text, p_session uuid, p_expected_version int,
                                     p_diary_checked boolean, p_now timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('session', p_session, 'expected_version', p_expected_version,
                                      'diary_checked', p_diary_checked);
  replay jsonb; result jsonb; blockers jsonb; groups jsonb; v_venue uuid; v_now timestamptz;
  s sila.sessions; b sila.bookings;
begin
  select venue_id into v_venue from sila.sessions where id = p_session;
  if not found or not ('coordinator' = any(sila.venue_roles(p_actor, v_venue))) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  replay := sila.idem_begin(p_actor, p_key, 'confirm_session', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = p_session for update;
  v_now := coalesce(p_now, clock_timestamp());
  perform 1 from sila.allocations where session_id = s.id and status = 'live' order by id for update;

  if s.phase <> 'published' then
    result := sila.err('SESSION_NOT_OPEN', 'This session is not awaiting confirmation.');
  elsif p_expected_version is distinct from s.version then
    result := sila.err('VERSION_CONFLICT', 'This session changed since you opened it. Reload and try again.',
                       jsonb_build_object('current_version', s.version));
  else
    blockers := sila.confirmation_blockers(s, p_diary_checked, v_now);
    if jsonb_array_length(blockers) > 0 then
      result := sila.err('NOT_READY', 'This session cannot be confirmed yet.', jsonb_build_object('blockers', blockers));
    else
      select jsonb_agg(jsonb_build_object(
               'allocation_id', a.id, 'plan_id', p.id, 'plan_ref', 'PL' || p.plan_number, 'club_name', p.club_name,
               'places', a.places, 'price_minor', a.price_minor, 'total_minor', a.total_minor,
               'deposit_minor', a.deposit_minor, 'balance_minor', a.balance_minor,
               'deposit_verified_minor', sila.verified_minor(a.id, 'deposit'),
               'terms_version', a.terms_version, 'platform_terms_version', a.platform_terms_version,
               'committed_at', a.committed_at)
             order by a.committed_at, a.id)
        into groups
        from sila.allocations a join sila.plans p on p.id = a.plan_id
       where a.session_id = s.id and a.status = 'live';
      insert into sila.bookings (session_id, confirmed_by, confirmed_at, diary_checked_at, snapshot)
      values (s.id, p_actor, v_now, v_now, jsonb_build_object(
        'session', jsonb_build_object(
          'id', s.id, 'title', s.title, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
          'meeting_point', s.meeting_point, 'price_minor', s.price_minor, 'minimum', s.minimum,
          'capacity', s.capacity, 'deposit_bp', s.deposit_bp, 'decision_by', s.decision_by,
          'balance_due_at', s.balance_due_at, 'terms_version', s.terms_version,
          'venue_terms_version', s.venue_terms_version, 'venue_terms_text', s.venue_terms_text,
          'platform_terms_version', s.platform_terms_version, 'resource_name', s.resource_name,
          'hold_expires_at', s.hold_expires_at, 'payment_opened_at', s.payment_opened_at,
          'pay_by', s.pay_by, 'verify_by', s.verify_by),
        'venue', (select jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address)
                  from sila.venues v where v.id = s.venue_id),
        'groups', groups))
      returning * into b;
      insert into sila.booking_groups (booking_id, allocation_id, plan_id, places, total_minor, deposit_minor,
                                       balance_minor, deposit_verified_minor)
      select b.id, a.id, a.plan_id, a.places, a.total_minor, a.deposit_minor, a.balance_minor,
             sila.verified_minor(a.id, 'deposit')
        from sila.allocations a where a.session_id = s.id and a.status = 'live';
      update sila.sessions
         set phase = 'confirmed', confirmed_at = v_now, version = version + 1, updated_at = v_now
       where id = s.id
      returning * into s;
      perform sila.audit(p_actor, s.venue_id, 'confirm_session', 'booking', b.id, s.version, null);
      perform sila.enqueue('booking.confirmed', 'booking.confirmed:' || b.id,
                           jsonb_build_object('booking_id', b.id, 'session_id', s.id));
      result := sila.ok(jsonb_build_object('booking_id', b.id, 'booking_ref', sila.booking_ref(b.booking_number),
                                           'session_id', s.id, 'version', s.version,
                                           'confirmed_at', s.confirmed_at));
    end if;
  end if;
  return sila.idem_finish(p_actor, p_key, 'confirm_session', request, result);
end $$;

-- ---------------------------------------------------------------- API

-- The organiser says what they paid (§18). Unverified: it creates no
-- financial entry and changes no condition. Organiser of the plan only.
create function sila_api.report_payment(p_actor uuid, p_key text, p_allocation uuid, p_kind text,
                                        p_amount_minor int, p_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('allocation', p_allocation, 'kind', p_kind, 'amount_minor', p_amount_minor,
                                      'reference', p_reference);
  replay jsonb; result jsonb; errors jsonb; v_session uuid;
  v_reference text := trim(coalesce(p_reference, ''));
  s sila.sessions; al sila.allocations; r sila.payment_reports;
begin
  select a.session_id into v_session
    from sila.allocations a join sila.plans p on p.id = a.plan_id
   where a.id = p_allocation and p.organiser_id = p_actor;
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  replay := sila.idem_begin(p_actor, p_key, 'report_payment', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = v_session;
  select * into al from sila.allocations where id = p_allocation;
  errors := sila.payment_field_errors(p_kind, p_amount_minor);
  if char_length(v_reference) not between 1 and 100 then
    errors := errors || jsonb_build_object('reference', jsonb_build_array('Enter a payment reference (up to 100 characters).'));
  end if;

  if errors <> '{}'::jsonb then
    result := sila.invalid_fields(errors);
  elsif s.payment_opened_at is null then
    result := sila.err('PAYMENT_NOT_OPEN', 'Payment has not opened for this session.');
  elsif al.status <> 'live' then
    result := sila.err('NOT_COMMITTED', 'This club has no committed places.');
  else
    insert into sila.payment_reports (allocation_id, kind, amount_minor, reference, reported_by)
    values (al.id, p_kind, p_amount_minor, v_reference, p_actor)
    returning * into r;
    perform sila.audit(p_actor, s.venue_id, 'report_payment', 'payment_report', r.id, null, p_kind);
    perform sila.enqueue('payment.reported', 'payment.reported:' || r.id,
                         jsonb_build_object('report_id', r.id, 'allocation_id', al.id, 'plan_id', al.plan_id,
                                            'session_id', s.id));
    result := sila.ok(sila.report_json(r));
  end if;
  return sila.idem_finish(p_actor, p_key, 'report_payment', request, result);
end $$;

create function sila_api.record_receipt(p_actor uuid, p_key text, p_allocation uuid, p_kind text,
                                        p_amount_minor int, p_received_at timestamptz, p_receipt_id text,
                                        p_evidence text)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select sila.record_receipt(p_actor, p_key, p_allocation, p_kind, p_amount_minor, p_received_at, p_receipt_id,
                             p_evidence, null)
$$;

create function sila_api.confirm_session(p_actor uuid, p_key text, p_session uuid, p_expected_version int,
                                         p_diary_checked boolean)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select sila.confirm_session(p_actor, p_key, p_session, p_expected_version, p_diary_checked, null)
$$;

-- ---------------------------------------------------------------- grants

revoke all on all tables in schema sila from public, anon, authenticated;
revoke all on all sequences in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila_api from public, anon, authenticated;
grant usage on schema sila_api to scb_app;
grant execute on all functions in schema sila_api to scb_app;

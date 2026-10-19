-- Organiser plan view: the agreed terms, the live allocation id and released places.
--
-- get_my_plan already returns the plan, public session, conversation, facts,
-- approval, allocation and this club's own payment facts. The organiser screens
-- (O3 conditional commitment, O5 deposit instructions, O6, the agreement tab)
-- also need the balance due date, the payment window, the venue's own conditions
-- and the platform terms version; the "I have paid" form needs the id of the
-- club's live allocation; and the closed-session screen needs how many places
-- the session had when it closed (live places are zero once released).
-- Everything is added under one new key, `terms`; every existing key and shape
-- is unchanged. `terms` is visible to the plan's organiser in every state:
--   * allocation_id: the club's own live allocation, null unless committed.
--   * released_places: an aggregate over released allocations, never per club.

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
    'terms', jsonb_build_object('terms_version', s.terms_version,
                                'venue_terms_version', s.venue_terms_version,
                                'venue_terms_text', s.venue_terms_text,
                                'platform_terms_version', s.platform_terms_version,
                                'balance_due_at', s.balance_due_at,
                                'payment_window_days', s.payment_window_days,
                                'allocation_id', case when v_committed then al.id end,
                                'released_places', (select coalesce(sum(r.places), 0)::int
                                                      from sila.allocations r
                                                     where r.session_id = s.id and r.status = 'released')),
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

revoke all on function sila_api.get_my_plan(uuid, uuid) from public, anon, authenticated;
grant execute on function sila_api.get_my_plan(uuid, uuid) to scb_app;

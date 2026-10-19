-- Offline practical details (§17, §19, §22, §27). An organiser receives only
-- its own confirmed allocation. Venue staff and scoped operators receive the
-- session's clubs, never raw messages, payment evidence or another tenant.
create function sila_api.get_practical_summary(p_actor uuid, p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s sila.sessions; b sila.bookings; v sila.venues;
  venue_view boolean; groups jsonb;
begin
  -- Consistent snapshot and session-first lock order with closure/confirmation.
  select * into s from sila.sessions where id=p_session for share;
  if not found then return sila.err('NOT_FOUND','Not found.'); end if;
  select * into b from sila.bookings where session_id=s.id;
  if not found then return sila.err('NOT_FOUND','Not found.'); end if;
  venue_view := sila.can_view_venue(p_actor,s.venue_id);
  if not venue_view and not exists (
    select 1 from sila.booking_groups bg join sila.plans p on p.id=bg.plan_id
    where bg.booking_id=b.id and p.organiser_id=p_actor
  ) then return sila.err('NOT_FOUND','Not found.'); end if;
  select * into v from sila.venues where id=s.venue_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'club_name',p.club_name,'plan_ref','PL'||p.plan_number,'places',bg.places,
    'total_minor',bg.total_minor,'deposit_minor',bg.deposit_minor,'balance_minor',bg.balance_minor)
    order by p.id),'[]'::jsonb) into groups
  from sila.booking_groups bg join sila.plans p on p.id=bg.plan_id
  where bg.booking_id=b.id and (venue_view or p.organiser_id=p_actor);
  perform sila.audit(p_actor,s.venue_id,'export_practical_summary','booking',b.id,s.version,null);
  return sila.ok(jsonb_build_object(
    'booking_ref',sila.booking_ref(b.booking_number),'phase',s.phase,
    'closed_reason',s.closed_reason,'confirmed_at',b.confirmed_at,'generated_at',clock_timestamp(),
    'title',b.snapshot->'session'->>'title',
    'starts_at',b.snapshot->'session'->>'starts_at','ends_at',b.snapshot->'session'->>'ends_at',
    'balance_due_at',b.snapshot->'session'->>'balance_due_at',
    'terms_version',b.snapshot->'session'->>'venue_terms_version',
    'venue_terms_text',b.snapshot->'session'->>'venue_terms_text',
    'meeting_point',s.meeting_point,
    'venue',jsonb_build_object('name',v.name,'address',v.address,
      'access_facts',v.access_facts,'contact_email',v.contact_email,'contact_phone',v.contact_phone),
    'groups',groups));
end $$;
revoke all on function sila_api.get_practical_summary(uuid,uuid) from public,anon,authenticated;
grant execute on function sila_api.get_practical_summary(uuid,uuid) to scb_app;

-- Venue-only quote terms, used when a manager revises the ticket price.
create function scb_api.get_quote_terms(p_actor uuid, p_quote uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q scb.quotes; venue uuid;
begin
  select * into q from scb.quotes where id = p_quote;
  select venue_organisation_id into venue from scb.experiences where id = q.experience_id;
  if q.id is null or not scb.is_venue_manager(p_actor, venue) then
    return scb.err('NOT_FOUND', 'Quote not found.');
  end if;
  return scb.ok(jsonb_build_object('id', q.id, 'version', q.version, 'fixed_pence', q.fixed_pence,
    'variable_pence', q.variable_pence, 'platform_fee_pence', q.platform_fee_pence,
    'ticket_pence', q.ticket_pence, 'minimum_venue_charge_pence', q.minimum_venue_charge_pence,
    'venue_min_seats', q.venue_min_seats));
end $$;

-- Judge sandbox only: lets the other fictional organisers accept, or fictional
-- members reserve, through the same guarded functions a person would call.
-- The acting judge persona's own groups and seat are never touched.
create function scb_api.demo_simulate(p_workspace uuid, p_actor uuid, p_proposal uuid, p_what text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p scb.proposals; v scb.proposal_versions; g record; m record; r jsonb; attempted integer := 0;
begin
  if not scb_api.demo_persona_valid(p_workspace, p_actor) then
    return scb.err('FORBIDDEN', 'Simulation is available only inside a judge sandbox.');
  end if;
  select * into p from scb.proposals where id = p_proposal and workspace_id = p_workspace;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  select * into v from scb.proposal_versions where id = p.current_version_id;

  if p_what = 'ACCEPT' then
    for g in
      select pg.group_id, gr.organiser_user_id from scb.proposal_groups pg
      join scb.groups gr on gr.id = pg.group_id
      where pg.proposal_version_id = v.id and not scb.is_group_organiser(p_actor, pg.group_id)
        and not exists (select 1 from scb.group_decisions d where d.proposal_version_id = v.id
                        and d.group_id = pg.group_id and d.decision = 'ACCEPT')
    loop
      r := scb_api.respond_to_proposal(g.organiser_user_id, p.id, v.id, v.version, g.group_id, 'ACCEPT',
                                       null, null, gen_random_uuid(), 'sim-' || gen_random_uuid());
      attempted := attempted + 1;
      if not (r->>'ok')::boolean then return r; end if;
    end loop;
  elsif p_what = 'RESERVE' then
    for m in
      select gm.user_id, gm.group_id from scb.proposal_groups pg
      join scb.group_memberships gm on gm.group_id = pg.group_id
      join scb.users u on u.id = gm.user_id and u.is_synthetic
      where pg.proposal_version_id = v.id and gm.user_id <> p_actor
        and exists (select 1 from scb.group_decisions d where d.proposal_version_id = v.id
                    and d.group_id = pg.group_id and d.decision = 'ACCEPT')
        and not exists (select 1 from scb.reservations x where x.slot_id = p.slot_id
                        and x.participant_id = gm.user_id and x.status = 'RESERVED')
      order by gm.group_id, gm.role desc, gm.user_id
    loop
      exit when scb.active_seats(v.id) >= v.required_seats;
      r := scb_api.reserve_seat(m.user_id, p.id, v.id, v.version, m.group_id, true, true,
                                gen_random_uuid(), 'sim-' || gen_random_uuid());
      attempted := attempted + 1;
      exit when not (r->>'ok')::boolean;
    end loop;
  else
    return scb.err('VALIDATION_FAILED', 'Unknown simulation.');
  end if;
  return scb.ok(jsonb_build_object('attempted', attempted));
end $$;

revoke all on all functions in schema scb_api from public, anon, authenticated;
grant execute on all functions in schema scb_api to scb_app;

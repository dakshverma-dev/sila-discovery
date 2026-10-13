-- Guarded booking lifecycle functions (D10, D14, D15). Each function:
--   * receives the actor ID only from the verified application session,
--   * independently checks the actor's authority over the object,
--   * locks the proposal row and then its slot row (consistent order),
--   * uses database time, and returns a typed result envelope.

-- Draft created by the matching job for human review (BR15: never published here).
create function scb_api.save_draft(
  p_actor uuid, p_workspace uuid, p_slot uuid, p_quote uuid, p_group_ids uuid[],
  p_required_seats integer, p_source_mode text, p_rationale jsonb, p_run uuid default null,
  p_request uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s scb.slots; q scb.quotes; e scb.experiences;
  computed integer; proposal_id uuid; version_id uuid; g uuid; brief uuid; n integer;
begin
  n := coalesce(cardinality(p_group_ids), 0);
  if n < 2 or n > 4 or (select count(distinct x) from unnest(p_group_ids) x) <> n then
    return scb.err('VALIDATION_FAILED', 'A coalition has two to four distinct groups.');
  end if;
  if p_source_mode not in ('live', 'cached', 'synthetic', 'unavailable') then
    return scb.err('VALIDATION_FAILED', 'Unknown evidence source.');
  end if;
  select * into s from scb.slots where id = p_slot and workspace_id = p_workspace;
  select * into q from scb.quotes where id = p_quote and workspace_id = p_workspace;
  if s.id is null or q.id is null or q.experience_id <> s.experience_id then
    return scb.err('NOT_FOUND', 'Slot or quote not found.');
  end if;
  select * into e from scb.experiences where id = s.experience_id;

  if not (scb.is_operator(p_actor, p_workspace)
          or scb.is_venue_manager(p_actor, e.venue_organisation_id)
          or exists (select 1 from unnest(p_group_ids) x where scb.is_group_organiser(p_actor, x))) then
    return scb.err('FORBIDDEN', 'You cannot create proposals in this workspace.');
  end if;
  if (select count(*) from scb.groups where id = any(p_group_ids) and workspace_id = p_workspace) <> n then
    return scb.err('NOT_FOUND', 'Group not found.');
  end if;
  computed := scb.quote_required_seats(q.id, s.capacity);
  if computed is null or computed <> p_required_seats then
    return scb.err('VALIDATION_FAILED', 'Required seats do not match the venue quote.');
  end if;

  -- A recovered worker may replay a run (T14). The same run, slot and coalition
  -- returns the existing draft instead of creating a duplicate.
  if p_run is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_run::text || p_slot::text, 0));
    select p.id, p.current_version_id into proposal_id, version_id
      from scb.proposals p
     where p.run_id = p_run and p.slot_id = p_slot
       and (select array_agg(pg.group_id order by pg.group_id) from scb.proposal_groups pg
            where pg.proposal_version_id = p.current_version_id)
           = (select array_agg(x order by x) from unnest(p_group_ids) x)
     limit 1;
    if proposal_id is not null then
      return scb.ok(jsonb_build_object('proposal_id', proposal_id, 'proposal_version_id', version_id,
                                       'replayed', true));
    end if;
  end if;

  insert into scb.proposals (workspace_id, slot_id, experience_id, run_id, state, source_mode, rationale, created_by)
  values (p_workspace, s.id, s.experience_id, p_run, 'DRAFT', p_source_mode, coalesce(p_rationale, '{}'), p_actor)
  returning id into proposal_id;
  insert into scb.proposal_versions (workspace_id, proposal_id, slot_id, experience_id, quote_id, version, required_seats)
  values (p_workspace, proposal_id, s.id, s.experience_id, q.id, 1, computed)
  returning id into version_id;
  update scb.proposals set current_version_id = version_id where id = proposal_id;

  foreach g in array p_group_ids loop
    select b.id into brief from scb.group_briefs b where b.group_id = g order by b.version desc limit 1;
    if brief is null then
      raise exception 'NEEDS_INPUT' using errcode = 'P0001';
    end if;
    insert into scb.proposal_groups (workspace_id, proposal_version_id, slot_id, group_id, brief_id)
    values (p_workspace, version_id, s.id, g, brief);
  end loop;

  perform scb.audit(p_workspace, p_actor, 'proposal.draft_saved', proposal_id, p_request,
                    jsonb_build_object('source_mode', p_source_mode, 'run_id', p_run));
  return scb.ok(jsonb_build_object('proposal_id', proposal_id, 'proposal_version_id', version_id));
exception when raise_exception then
  if sqlerrm = 'NEEDS_INPUT' then
    return scb.err('NEEDS_INPUT', 'Every included group needs a saved brief.');
  end if;
  raise;
end $$;

-- Venue publishes immutable terms (DRAFT -> OPEN). Rechecks every hard constraint.
create function scb_api.publish_proposal(
  p_actor uuid, p_proposal uuid, p_deadline timestamptz, p_request uuid, p_idem_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p scb.proposals; v scb.proposal_versions; s scb.slots; e scb.experiences;
  payload jsonb := jsonb_build_object('proposal', p_proposal, 'deadline', p_deadline);
  replay jsonb; result jsonb; pg record; blockers text[]; n integer; snapshot jsonb;
begin
  select * into p from scb.proposals where id = p_proposal for update;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  replay := scb.idem_begin(p.workspace_id, p_actor, 'publish', p_idem_key, payload);
  if replay is not null then return replay; end if;

  if not scb.is_venue_manager(p_actor, scb.proposal_venue(p.id)) then
    result := scb.err('FORBIDDEN', 'Only the venue manager can publish terms.');
  elsif p.state <> 'DRAFT' then
    result := scb.err('PROPOSAL_CLOSED', 'Only a draft can be published.');
  end if;
  if result is not null then
    return scb.idem_finish(p.workspace_id, p_actor, 'publish', p_idem_key, payload, result);
  end if;

  select * into s from scb.slots where id = p.slot_id for update;
  select * into v from scb.proposal_versions where id = p.current_version_id;
  select * into e from scb.experiences where id = p.experience_id;
  select count(*) into n from scb.proposal_groups where proposal_version_id = v.id;

  if p_deadline is null or p_deadline <= now() or p_deadline > s.start_at then
    result := scb.err('VALIDATION_FAILED', 'The reservation deadline must be in the future and before the session starts.');
  elsif e.approval_status <> 'APPROVED' then
    result := scb.err('NOT_READY', 'The programme is not approved.');
  elsif not scb.quote_is_current(v.quote_id) then
    result := scb.err('VERSION_CONFLICT', 'The venue quote has changed. Re-run matching.');
  elsif scb.quote_required_seats(v.quote_id, s.capacity) is distinct from v.required_seats then
    result := scb.err('VERSION_CONFLICT', 'The quote threshold no longer matches.');
  elsif s.status <> 'AVAILABLE' then
    result := scb.err('SLOT_UNAVAILABLE', 'This session is already held or booked.');
  elsif n < 2 or n > 4 then
    result := scb.err('VALIDATION_FAILED', 'A coalition has two to four groups.');
  end if;
  if result is null then
    for pg in select g.group_id, g.brief_id from scb.proposal_groups g where g.proposal_version_id = v.id loop
      if exists (select 1 from scb.group_briefs b where b.group_id = pg.group_id
                 and b.version > (select version from scb.group_briefs where id = pg.brief_id)) then
        result := scb.err('VERSION_CONFLICT', 'A group brief has changed since this draft. Re-run matching.');
        exit;
      end if;
      blockers := scb.brief_blockers(pg.brief_id, s.id, v.quote_id);
      if cardinality(blockers) > 0 then
        result := scb.err('NOT_READY', 'A group no longer meets the session requirements.',
                          false, jsonb_build_object('group_id', pg.group_id, 'blockers', to_jsonb(blockers)));
        exit;
      end if;
    end loop;
  end if;
  if result is not null then
    return scb.idem_finish(p.workspace_id, p_actor, 'publish', p_idem_key, payload, result);
  end if;

  begin
    -- All publish writes sit in one block so a slot race rolls every one back.
    update scb.proposals set state = 'OPEN', updated_at = now() where id = p.id;
    update scb.proposal_versions set deadline = p_deadline where id = v.id;
    snapshot := scb.terms_snapshot(v.id);
    update scb.proposal_versions
       set terms_snapshot = snapshot, terms_hash = scb.sha256(snapshot::text),
           published_at = now(), published_by = p_actor
     where id = v.id;
    update scb.slots set status = 'HELD' where id = s.id;
  exception when unique_violation then
    return scb.idem_finish(p.workspace_id, p_actor, 'publish', p_idem_key, payload,
      scb.err('SLOT_UNAVAILABLE', 'Another proposal already holds this session.'));
  end;
  perform scb.audit(p.workspace_id, p_actor, 'proposal.published', p.id, p_request,
                    jsonb_build_object('version', v.version, 'deadline', p_deadline));
  result := scb.ok(jsonb_build_object('proposal_id', p.id, 'proposal_version_id', v.id,
                                      'version', v.version, 'state', 'OPEN'));
  return scb.idem_finish(p.workspace_id, p_actor, 'publish', p_idem_key, payload, result);
end $$;

-- Material revision (R09): new immutable version; old decisions and seats lapse.
create function scb_api.revise_proposal(
  p_actor uuid, p_proposal uuid, p_expected_version integer, p_quote uuid,
  p_deadline timestamptz, p_request uuid, p_idem_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p scb.proposals; v scb.proposal_versions; s scb.slots; q scb.quotes;
  payload jsonb := jsonb_build_object('proposal', p_proposal, 'expected_version', p_expected_version,
                                      'quote', p_quote, 'deadline', p_deadline);
  replay jsonb; result jsonb; new_id uuid; computed integer; released integer; snapshot jsonb;
begin
  select * into p from scb.proposals where id = p_proposal for update;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  replay := scb.idem_begin(p.workspace_id, p_actor, 'revise', p_idem_key, payload);
  if replay is not null then return replay; end if;

  select * into s from scb.slots where id = p.slot_id for update;
  select * into v from scb.proposal_versions where id = p.current_version_id;
  select * into q from scb.quotes where id = p_quote and experience_id = p.experience_id;
  computed := case when q.id is null then null else scb.quote_required_seats(q.id, s.capacity) end;

  if not scb.is_venue_manager(p_actor, scb.proposal_venue(p.id)) then
    result := scb.err('FORBIDDEN', 'Only the venue manager can revise terms.');
  elsif p.state not in ('OPEN', 'READY') then
    result := scb.err('PROPOSAL_CLOSED', 'Only open proposals can be revised.');
  elsif v.version <> p_expected_version then
    result := scb.err('VERSION_CONFLICT', 'The proposal terms changed.');
  elsif q.id is null or not scb.quote_is_current(q.id) then
    result := scb.err('VALIDATION_FAILED', 'Choose the current venue quote.');
  elsif computed is null then
    result := scb.err('VALIDATION_FAILED', 'This quote cannot be met within capacity.');
  elsif p_deadline is null or p_deadline <= now() or p_deadline > s.start_at then
    result := scb.err('VALIDATION_FAILED', 'The reservation deadline must be in the future and before the session starts.');
  end if;
  if result is not null then
    return scb.idem_finish(p.workspace_id, p_actor, 'revise', p_idem_key, payload, result);
  end if;

  update scb.reservations set status = 'INVALIDATED', updated_at = now()
   where proposal_version_id = v.id and status = 'RESERVED';
  get diagnostics released = row_count;
  update scb.proposal_versions set superseded_at = now() where id = v.id;

  insert into scb.proposal_versions (workspace_id, proposal_id, slot_id, experience_id, quote_id,
                                     version, required_seats, deadline)
  values (p.workspace_id, p.id, p.slot_id, p.experience_id, q.id, v.version + 1, computed, p_deadline)
  returning id into new_id;
  insert into scb.proposal_groups (workspace_id, proposal_version_id, slot_id, group_id, brief_id)
  select workspace_id, new_id, slot_id, group_id, brief_id from scb.proposal_groups
   where proposal_version_id = v.id;
  snapshot := scb.terms_snapshot(new_id);
  update scb.proposal_versions
     set terms_snapshot = snapshot, terms_hash = scb.sha256(snapshot::text),
         published_at = now(), published_by = p_actor
   where id = new_id;
  update scb.proposals set current_version_id = new_id, state = 'OPEN', updated_at = now() where id = p.id;

  perform scb.audit(p.workspace_id, p_actor, 'proposal.revised', p.id, p_request,
    jsonb_build_object('from_version', v.version, 'to_version', v.version + 1, 'released_reservations', released));
  result := scb.ok(jsonb_build_object('proposal_id', p.id, 'proposal_version_id', new_id,
    'version', v.version + 1, 'state', 'OPEN', 'released_reservations', released));
  return scb.idem_finish(p.workspace_id, p_actor, 'revise', p_idem_key, payload, result);
end $$;

-- Organiser accepts or declines the current version for their group (R10, BR11).
create function scb_api.respond_to_proposal(
  p_actor uuid, p_proposal uuid, p_version_id uuid, p_expected_version integer, p_group uuid,
  p_decision text, p_reason_category text, p_reason text, p_request uuid, p_idem_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p scb.proposals; v scb.proposal_versions;
  payload jsonb := jsonb_build_object('proposal', p_proposal, 'version_id', p_version_id,
    'expected_version', p_expected_version, 'group', p_group, 'decision', p_decision,
    'reason_category', p_reason_category, 'reason', p_reason);
  replay jsonb; result jsonb; state text;
begin
  select * into p from scb.proposals where id = p_proposal for update;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  replay := scb.idem_begin(p.workspace_id, p_actor, 'decision', p_idem_key, payload);
  if replay is not null then return replay; end if;
  perform 1 from scb.slots where id = p.slot_id for update;
  select * into v from scb.proposal_versions where id = p.current_version_id;

  if p_decision not in ('ACCEPT', 'DECLINE') then
    result := scb.err('VALIDATION_FAILED', 'Decision must be ACCEPT or DECLINE.');
  elsif not exists (select 1 from scb.proposal_groups where proposal_version_id = v.id and group_id = p_group)
        or not scb.is_group_organiser(p_actor, p_group) then
    result := scb.err('FORBIDDEN', 'Only an included group''s organiser can respond.');
  elsif p.state = 'EXPIRED' or (p.state in ('OPEN', 'READY') and now() >= v.deadline) then
    result := scb.err('PROPOSAL_EXPIRED', 'The reservation deadline has passed.');
  elsif p.state not in ('OPEN', 'READY') then
    result := scb.err('PROPOSAL_CLOSED', 'This proposal is not open for decisions.');
  elsif v.id <> p_version_id or v.version <> p_expected_version then
    result := scb.err('VERSION_CONFLICT', 'The proposal terms changed. Review the new version.');
  end if;
  if result is not null then
    return scb.idem_finish(p.workspace_id, p_actor, 'decision', p_idem_key, payload, result);
  end if;

  insert into scb.group_decisions (workspace_id, proposal_version_id, group_id, decision, reason_category, reason, actor_id)
  values (p.workspace_id, v.id, p_group, p_decision, p_reason_category, nullif(trim(p_reason), ''), p_actor)
  on conflict (proposal_version_id, group_id) do update
    set decision = excluded.decision, reason_category = excluded.reason_category,
        reason = excluded.reason, actor_id = excluded.actor_id, updated_at = now();
  perform scb.audit(p.workspace_id, p_actor, 'proposal.decision', p.id, p_request,
    jsonb_build_object('group_id', p_group, 'decision', p_decision, 'version', v.version,
                       'reason_category', p_reason_category));
  state := scb.sync_readiness(p.id, p_actor, p_request);
  result := scb.ok(jsonb_build_object('proposal_id', p.id, 'group_id', p_group,
                                      'decision', p_decision, 'state', state));
  return scb.idem_finish(p.workspace_id, p_actor, 'decision', p_idem_key, payload, result);
end $$;

-- One participant reserves one seat (R11, BR01, BR09, BR10, BR12).
create function scb_api.reserve_seat(
  p_actor uuid, p_proposal uuid, p_version_id uuid, p_expected_version integer, p_group uuid,
  p_accept_shared boolean, p_adult boolean, p_request uuid, p_idem_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p scb.proposals; v scb.proposal_versions; s scb.slots;
  payload jsonb := jsonb_build_object('proposal', p_proposal, 'version_id', p_version_id,
    'expected_version', p_expected_version, 'group', p_group,
    'accept_shared', p_accept_shared, 'adult', p_adult);
  replay jsonb; result jsonb; active integer; reservation_id uuid; state text;
begin
  select * into p from scb.proposals where id = p_proposal for update;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  replay := scb.idem_begin(p.workspace_id, p_actor, 'reserve', p_idem_key, payload);
  if replay is not null then return replay; end if;
  select * into s from scb.slots where id = p.slot_id for update;
  select * into v from scb.proposal_versions where id = p.current_version_id;

  if p_accept_shared is not true or p_adult is not true then
    result := scb.err('VALIDATION_FAILED', 'Confirm you are an adult and accept the shared session.', false,
      jsonb_build_object('field_errors', jsonb_build_object(
        'adult_declaration', case when p_adult is not true then jsonb_build_array('Required') end,
        'accept_shared_session', case when p_accept_shared is not true then jsonb_build_array('Required') end)));
  elsif not exists (select 1 from scb.proposal_groups where proposal_version_id = v.id and group_id = p_group)
        or not scb.is_group_member(p_actor, p_group) then
    result := scb.err('FORBIDDEN', 'You can reserve only through your own included group.');
  elsif p.state = 'EXPIRED' or (p.state in ('OPEN', 'READY') and now() >= v.deadline) then
    result := scb.err('PROPOSAL_EXPIRED', 'The reservation deadline has passed.');
  elsif p.state not in ('OPEN', 'READY') then
    result := scb.err('PROPOSAL_CLOSED', 'This proposal is not open for reservations.');
  elsif v.id <> p_version_id or v.version <> p_expected_version then
    result := scb.err('VERSION_CONFLICT', 'The proposal terms changed. Review the new version.');
  elsif not exists (select 1 from scb.group_decisions where proposal_version_id = v.id
                    and group_id = p_group and decision = 'ACCEPT') then
    result := scb.err('NOT_READY', 'Your group organiser has not accepted these terms yet.');
  elsif exists (select 1 from scb.reservations where slot_id = s.id and participant_id = p_actor
                and status = 'RESERVED') then
    result := scb.err('ALREADY_RESERVED', 'You already hold a seat for this session.');
  end if;
  if result is null then
    active := scb.active_seats(v.id);
    if active >= s.capacity then
      result := scb.err('CAPACITY_EXCEEDED', 'No seats remain for this session.', false,
                        jsonb_build_object('capacity', s.capacity, 'active_reservations', active));
    end if;
  end if;
  if result is not null then
    return scb.idem_finish(p.workspace_id, p_actor, 'reserve', p_idem_key, payload, result);
  end if;

  insert into scb.reservations (workspace_id, proposal_version_id, slot_id, participant_id, group_id,
                                status, accept_shared_session, adult_declaration)
  values (p.workspace_id, v.id, s.id, p_actor, p_group, 'RESERVED', true, true)
  returning id into reservation_id;
  perform scb.audit(p.workspace_id, p_actor, 'reservation.created', reservation_id, p_request,
                    jsonb_build_object('proposal_id', p.id, 'version', v.version));
  state := scb.sync_readiness(p.id, p_actor, p_request);
  result := scb.ok(jsonb_build_object('reservation_id', reservation_id, 'proposal_id', p.id,
    'state', state, 'active_reservations', active + 1, 'payment_status', 'NOT_COLLECTED'));
  return scb.idem_finish(p.workspace_id, p_actor, 'reserve', p_idem_key, payload, result);
end $$;

-- Participant withdraws their own seat before confirmation (BR13).
create function scb_api.withdraw_seat(
  p_actor uuid, p_reservation uuid, p_request uuid, p_idem_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r scb.reservations; p scb.proposals;
  payload jsonb := jsonb_build_object('reservation', p_reservation);
  replay jsonb; result jsonb; state text;
begin
  select * into r from scb.reservations where id = p_reservation;
  if r.id is null or r.participant_id <> p_actor then
    return scb.err('NOT_FOUND', 'Reservation not found.');
  end if;
  select pr.* into p from scb.proposals pr
    join scb.proposal_versions v on v.proposal_id = pr.id where v.id = r.proposal_version_id
    for update of pr;
  perform 1 from scb.slots where id = p.slot_id for update;
  select * into r from scb.reservations where id = p_reservation;
  replay := scb.idem_begin(p.workspace_id, p_actor, 'withdraw', p_idem_key, payload);
  if replay is not null then return replay; end if;

  if r.status <> 'RESERVED' then
    result := scb.err('PROPOSAL_CLOSED', 'This reservation is no longer active.');
  elsif p.state not in ('OPEN', 'READY') then
    result := scb.err('PROPOSAL_CLOSED', 'After confirmation, contact the venue to change your reservation.');
  end if;
  if result is not null then
    return scb.idem_finish(p.workspace_id, p_actor, 'withdraw', p_idem_key, payload, result);
  end if;

  update scb.reservations set status = 'WITHDRAWN', updated_at = now() where id = r.id;
  perform scb.audit(p.workspace_id, p_actor, 'reservation.withdrawn', r.id, p_request,
                    jsonb_build_object('proposal_id', p.id));
  state := scb.sync_readiness(p.id, p_actor, p_request);
  result := scb.ok(jsonb_build_object('reservation_id', r.id, 'status', 'WITHDRAWN', 'proposal_state', state));
  return scb.idem_finish(p.workspace_id, p_actor, 'withdraw', p_idem_key, payload, result);
end $$;

-- Venue confirms the reservation booking (R12): READY -> CONFIRMED, slot BOOKED.
create function scb_api.confirm_booking(
  p_actor uuid, p_proposal uuid, p_expected_version integer, p_request uuid, p_idem_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p scb.proposals; v scb.proposal_versions;
  payload jsonb := jsonb_build_object('proposal', p_proposal, 'expected_version', p_expected_version);
  replay jsonb; result jsonb; blockers text[];
begin
  select * into p from scb.proposals where id = p_proposal for update;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  replay := scb.idem_begin(p.workspace_id, p_actor, 'confirm', p_idem_key, payload);
  if replay is not null then return replay; end if;
  perform 1 from scb.slots where id = p.slot_id for update;
  select * into v from scb.proposal_versions where id = p.current_version_id;

  if not scb.is_venue_manager(p_actor, scb.proposal_venue(p.id)) then
    result := scb.err('FORBIDDEN', 'Only the venue manager can confirm.');
  elsif p.state = 'EXPIRED' or (p.state in ('OPEN', 'READY') and now() >= v.deadline) then
    result := scb.err('PROPOSAL_EXPIRED', 'The reservation deadline has passed.');
  elsif p.state not in ('OPEN', 'READY') then
    result := scb.err('PROPOSAL_CLOSED', 'This proposal cannot be confirmed.');
  elsif v.version <> p_expected_version then
    result := scb.err('VERSION_CONFLICT', 'The proposal terms changed.');
  else
    blockers := scb.readiness_blockers(p.id);
    if cardinality(blockers) > 0 then
      result := scb.err('NOT_READY', 'The booking is not ready to confirm.', false,
                        jsonb_build_object('blockers', to_jsonb(blockers)));
    end if;
  end if;
  if result is not null then
    return scb.idem_finish(p.workspace_id, p_actor, 'confirm', p_idem_key, payload, result);
  end if;

  update scb.proposals set state = 'CONFIRMED', updated_at = now() where id = p.id;
  update scb.slots set status = 'BOOKED' where id = p.slot_id;
  perform scb.audit(p.workspace_id, p_actor, 'proposal.confirmed', p.id, p_request,
    jsonb_build_object('version', v.version, 'active_reservations', scb.active_seats(v.id)));
  result := scb.ok(jsonb_build_object('proposal_id', p.id, 'state', 'CONFIRMED',
                                      'payment_status', 'NOT_COLLECTED'));
  return scb.idem_finish(p.workspace_id, p_actor, 'confirm', p_idem_key, payload, result);
end $$;

-- Venue manager or operator cancels with an audited reason (BR18).
create function scb_api.cancel_proposal(
  p_actor uuid, p_proposal uuid, p_reason text, p_request uuid, p_idem_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p scb.proposals;
  payload jsonb := jsonb_build_object('proposal', p_proposal, 'reason', p_reason);
  replay jsonb; result jsonb; affected integer;
begin
  select * into p from scb.proposals where id = p_proposal for update;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  replay := scb.idem_begin(p.workspace_id, p_actor, 'cancel', p_idem_key, payload);
  if replay is not null then return replay; end if;
  perform 1 from scb.slots where id = p.slot_id for update;

  if not (scb.is_venue_manager(p_actor, scb.proposal_venue(p.id)) or scb.is_operator(p_actor, p.workspace_id)) then
    result := scb.err('FORBIDDEN', 'Only the venue manager or an operator can cancel.');
  elsif p_reason is null or length(trim(p_reason)) < 3 or length(p_reason) > 1000 then
    result := scb.err('VALIDATION_FAILED', 'A cancellation reason is required.');
  elsif p.state not in ('DRAFT', 'OPEN', 'READY', 'CONFIRMED') then
    result := scb.err('PROPOSAL_CLOSED', 'This proposal is already closed.');
  end if;
  if result is not null then
    return scb.idem_finish(p.workspace_id, p_actor, 'cancel', p_idem_key, payload, result);
  end if;

  update scb.reservations r set status = 'CANCELLED', updated_at = now()
    from scb.proposal_versions v
   where v.proposal_id = p.id and r.proposal_version_id = v.id and r.status = 'RESERVED';
  get diagnostics affected = row_count;
  if p.state in ('OPEN', 'READY', 'CONFIRMED') then
    update scb.slots set status = 'AVAILABLE' where id = p.slot_id;
  end if;
  update scb.proposals set state = 'CANCELLED', updated_at = now() where id = p.id;
  perform scb.audit(p.workspace_id, p_actor, 'proposal.cancelled', p.id, p_request,
    jsonb_build_object('from', p.state, 'reason', trim(p_reason), 'affected_reservations', affected));
  result := scb.ok(jsonb_build_object('proposal_id', p.id, 'state', 'CANCELLED',
                                      'affected_reservations', affected));
  return scb.idem_finish(p.workspace_id, p_actor, 'cancel', p_idem_key, payload, result);
end $$;

-- Venue records delivery (CONFIRMED -> COMPLETED).
create function scb_api.complete_proposal(
  p_actor uuid, p_proposal uuid, p_request uuid, p_idem_key text, p_attended uuid[] default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p scb.proposals; payload jsonb := jsonb_build_object('proposal', p_proposal, 'attended', p_attended);
  attended integer := 0;
  replay jsonb; result jsonb;
begin
  select * into p from scb.proposals where id = p_proposal for update;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  replay := scb.idem_begin(p.workspace_id, p_actor, 'complete', p_idem_key, payload);
  if replay is not null then return replay; end if;
  if not scb.is_venue_manager(p_actor, scb.proposal_venue(p.id)) then
    result := scb.err('FORBIDDEN', 'Only the venue manager can record delivery.');
  elsif p.state <> 'CONFIRMED' then
    result := scb.err('PROPOSAL_CLOSED', 'Only a confirmed booking can be completed.');
  else
    update scb.proposals set state = 'COMPLETED', updated_at = now() where id = p.id;
    -- Attendance is recorded separately from reservation (D14). An omitted list
    -- leaves seats as reserved; a supplied list marks everyone else a no-show.
    if p_attended is not null then
      update scb.reservations set status = case when id = any(p_attended) then 'ATTENDED' else 'NO_SHOW' end,
             updated_at = now()
       where proposal_version_id = p.current_version_id and status = 'RESERVED';
      select count(*) into attended from scb.reservations
       where proposal_version_id = p.current_version_id and status = 'ATTENDED';
    end if;
    perform scb.audit(p.workspace_id, p_actor, 'proposal.completed', p.id, p_request,
                      jsonb_build_object('attended', attended));
    result := scb.ok(jsonb_build_object('proposal_id', p.id, 'state', 'COMPLETED', 'attended', attended));
  end if;
  return scb.idem_finish(p.workspace_id, p_actor, 'complete', p_idem_key, payload, result);
end $$;

-- Scheduled expiry (pg_cron or worker). Idempotent; uses database time.
create function scb_api.expire_proposals() returns integer
language plpgsql security definer set search_path = '' as $$
declare rec record; total integer := 0;
begin
  for rec in
    select p.id, p.workspace_id, p.slot_id from scb.proposals p
    join scb.proposal_versions v on v.id = p.current_version_id
    where p.state in ('OPEN', 'READY') and v.deadline <= now()
    order by p.id
    for update of p skip locked
  loop
    perform 1 from scb.slots where id = rec.slot_id for update;
    update scb.reservations r set status = 'INVALIDATED', updated_at = now()
      from scb.proposal_versions v
     where v.proposal_id = rec.id and r.proposal_version_id = v.id and r.status = 'RESERVED';
    update scb.slots set status = 'AVAILABLE' where id = rec.slot_id and status = 'HELD';
    update scb.proposals set state = 'EXPIRED', updated_at = now() where id = rec.id;
    perform scb.audit(rec.workspace_id, null, 'proposal.expired', rec.id, gen_random_uuid());
    total := total + 1;
  end loop;
  return total;
end $$;

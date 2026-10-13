-- Durable, bounded matching jobs (D10, D12) and the organiser review request.

alter table scb.match_runs add column requested_group_id uuid;
alter table scb.match_runs add constraint match_runs_group_fk
  foreign key (requested_group_id, workspace_id) references scb.groups(id, workspace_id) on delete cascade;
alter table scb.proposals add column review_requested_at timestamptz;
alter table scb.proposals add column review_requested_by uuid references scb.users(id);

-- Queues a run for one organiser's group, freezing every input it may use.
-- The snapshot is server-side only; requesters never receive other groups' briefs.
create function scb_api.create_match_run(
  p_actor uuid, p_group uuid, p_source_mode text, p_request uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare g scb.groups; snapshot jsonb; run_id uuid; missing text[];
begin
  select * into g from scb.groups where id = p_group;
  if g.id is null or not (scb.is_group_organiser(p_actor, p_group) or scb.is_operator(p_actor, g.workspace_id)) then
    return scb.err('NOT_FOUND', 'Group not found.');
  end if;
  if p_source_mode not in ('live', 'synthetic') then
    return scb.err('VALIDATION_FAILED', 'Unsupported evidence mode.');
  end if;
  if exists (select 1 from scb.match_runs where requested_group_id = p_group and state in ('QUEUED', 'RUNNING')
             and deadline_at > now()) then
    return scb.err('RATE_LIMITED', 'A matching run for this group is already in progress.', true);
  end if;

  -- NEEDS_INPUT (D12): the requesting group must have a complete, consented brief.
  select array_remove(array[
    case when b.id is null then 'brief' end,
    case when b.id is not null and b.sharing_choice <> 'WILLING_TO_SHARE' then 'sharing_choice' end,
    case when b.id is not null and jsonb_array_length(b.availability) = 0 then 'availability' end,
    case when p_source_mode = 'live' and b.id is not null and not b.external_query_consent
         then 'external_query_consent' end,
    case when p_source_mode = 'live' and not exists (select 1 from scb.group_references r
         where r.brief_id = b.id and r.resolved) then 'references' end], null)
  into missing
  from (select 1) one
  left join lateral (select * from scb.group_briefs where group_id = p_group order by version desc limit 1) b on true;
  if cardinality(missing) > 0 then
    return scb.err('NEEDS_INPUT', 'Complete the group brief before requesting suggestions.', false,
                   jsonb_build_object('fields', to_jsonb(missing), 'actor', 'ORGANISER'));
  end if;

  select jsonb_build_object(
    'workspace_id', g.workspace_id,
    'requested_group_id', p_group,
    'source_mode', p_source_mode,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'group_id', gr.id, 'name', gr.name, 'brief_id', b.id, 'brief_version', b.version,
        'expected_seats', b.expected_seats, 'budget_pence', b.budget_pence,
        'availability', b.availability, 'sharing_choice', b.sharing_choice,
        'external_query_consent', b.external_query_consent,
        'access_requirements', to_jsonb(b.access_requirements),
        'confirmed_entity_ids', coalesce((select jsonb_agg(r.entity_id order by r.entity_id) from scb.group_references r
                                          where r.brief_id = b.id and r.resolved), '[]'))
        order by gr.id)
      from scb.groups gr
      join lateral (select * from scb.group_briefs where group_id = gr.id order by version desc limit 1) b on true
      where gr.workspace_id = g.workspace_id
      limit 20), '[]'),
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'experience', jsonb_build_object('id', e.id, 'title', e.title, 'approved', e.approval_status = 'APPROVED',
                                         'access_support', to_jsonb(e.access_support),
                                         'anchor_entity_ids', coalesce((select jsonb_agg(a.entity_id order by a.entity_id)
                                            from scb.experience_anchors a where a.experience_id = e.id), '[]')),
        'quote', (select jsonb_build_object('id', q.id, 'version', q.version, 'fixed_pence', q.fixed_pence,
                    'variable_pence', q.variable_pence, 'platform_fee_pence', q.platform_fee_pence,
                    'ticket_pence', q.ticket_pence, 'minimum_venue_charge_pence', q.minimum_venue_charge_pence,
                    'venue_min_seats', q.venue_min_seats, 'currency', q.currency)
                  from scb.quotes q where q.experience_id = e.id order by q.version desc limit 1),
        'slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'experience_id', s.experience_id,
                    'start_at', s.start_at, 'end_at', s.end_at, 'capacity', s.capacity) order by s.start_at)
                  from (select * from scb.slots where experience_id = e.id and status = 'AVAILABLE'
                        and start_at > now() order by start_at limit 5) s), '[]'))
        order by e.id)
      from scb.experiences e
      where e.workspace_id = g.workspace_id and e.approval_status = 'APPROVED'
        and exists (select 1 from scb.quotes q where q.experience_id = e.id)
      limit 10), '[]'),
    'anchor_universe', coalesce((
      select jsonb_agg(distinct a.entity_id) from scb.experience_anchors a
      join scb.experiences e on e.id = a.experience_id
      where e.workspace_id = g.workspace_id and e.approval_status = 'APPROVED'), '[]'),
    'anchor_labels', coalesce((
      select jsonb_object_agg(a.entity_id, a.label) from (select distinct on (entity_id) entity_id, label
        from scb.experience_anchors where workspace_id = g.workspace_id) a), '{}'))
  into snapshot;

  if jsonb_array_length(snapshot->'anchor_universe') > 30 then
    return scb.err('VALIDATION_FAILED', 'The approved anchor universe exceeds 30 entities.');
  end if;

  insert into scb.match_runs (workspace_id, requested_by, requested_group_id, state, source_mode,
                              snapshot_hash, snapshot, deadline_at)
  values (g.workspace_id, p_actor, p_group, 'QUEUED', p_source_mode,
          scb.sha256(snapshot::text), snapshot, now() + interval '90 seconds')
  returning id into run_id;
  perform scb.audit(g.workspace_id, p_actor, 'match_run.queued', run_id, p_request,
                    jsonb_build_object('group_id', p_group, 'source_mode', p_source_mode));
  return scb.ok(jsonb_build_object('run_id', run_id, 'state', 'QUEUED'));
end $$;

-- Worker lease: QUEUED runs, or RUNNING runs whose lease expired (crash recovery).
create function scb_api.lease_match_run(p_run uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r scb.match_runs;
begin
  update scb.match_runs set state = 'RUNNING', lease_until = now() + interval '30 seconds',
         attempts = attempts + 1, updated_at = now()
   where id = p_run and deadline_at > now() and attempts < 3
     and (state = 'QUEUED' or (state = 'RUNNING' and lease_until < now()))
  returning * into r;
  if r.id is null then return scb.err('NOT_READY', 'Run is not available to lease.'); end if;
  return scb.ok(jsonb_build_object('run_id', r.id, 'snapshot', r.snapshot, 'checkpoint', r.checkpoint,
    'call_count', r.call_count, 'deadline_at', r.deadline_at, 'requested_by', r.requested_by,
    'source_mode', r.source_mode));
end $$;

create function scb_api.checkpoint_match_run(p_run uuid, p_checkpoint jsonb, p_call_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update scb.match_runs set checkpoint = checkpoint || coalesce(p_checkpoint, '{}'),
         call_count = greatest(call_count, least(p_call_count, 24)),
         lease_until = now() + interval '30 seconds', updated_at = now()
   where id = p_run and state = 'RUNNING';
  if not found then return scb.err('NOT_READY', 'Run is not running.'); end if;
  return scb.ok('{}');
end $$;

create function scb_api.finish_match_run(p_run uuid, p_state text, p_result jsonb, p_error_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r scb.match_runs;
begin
  if p_state not in ('SUCCEEDED', 'FAILED', 'NEEDS_INPUT') then
    return scb.err('VALIDATION_FAILED', 'Invalid terminal state.');
  end if;
  update scb.match_runs set state = p_state, result = p_result, error_code = p_error_code,
         lease_until = null, updated_at = now()
   where id = p_run and state = 'RUNNING'
  returning * into r;
  if r.id is null then return scb.err('NOT_READY', 'Run is not running.'); end if;
  perform scb.audit(r.workspace_id, r.requested_by, 'match_run.' || lower(p_state), r.id, gen_random_uuid(),
                    jsonb_build_object('error_code', p_error_code, 'call_count', r.call_count));
  return scb.ok(jsonb_build_object('run_id', r.id, 'state', p_state));
end $$;

-- Marks runs whose deadline passed as failed (cron / worker tick).
create function scb_api.fail_stale_match_runs() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update scb.match_runs set state = 'FAILED', error_code = 'JOB_DEADLINE_EXCEEDED', lease_until = null,
         updated_at = now()
   where state in ('QUEUED', 'RUNNING') and (deadline_at <= now() or attempts >= 3 and lease_until < now());
  get diagnostics n = row_count;
  return n;
end $$;

create function scb_api.list_recoverable_match_runs() returns jsonb
language sql stable security definer set search_path = '' as $$
  select scb.ok(jsonb_build_object('run_ids', coalesce(jsonb_agg(id), '[]'))) from (
    select id from scb.match_runs
    where deadline_at > now() and attempts < 3
      and (state = 'QUEUED' or (state = 'RUNNING' and lease_until < now()))
    order by created_at limit 10) r
$$;

create function scb_api.record_evidence(p_run uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r scb.match_runs; n integer;
begin
  select * into r from scb.match_runs where id = p_run and state = 'RUNNING';
  if r.id is null then return scb.err('NOT_READY', 'Run is not running.'); end if;
  insert into scb.evidence_records (workspace_id, run_id, group_id, source_mode, query_hash, entity_id, rank,
                                    raw_score, coverage, fetched_at, expires_at)
  select r.workspace_id, r.id, (i->>'group_id')::uuid, i->>'source_mode', i->>'query_hash', i->>'entity_id',
         nullif(i->>'rank', '')::integer, nullif(i->>'raw_score', '')::double precision,
         coalesce(i->'coverage', '{}'), (i->>'fetched_at')::timestamptz, (i->>'fetched_at')::timestamptz + interval '24 hours'
  from jsonb_array_elements(p_items) i
  where exists (select 1 from scb.groups g where g.id = (i->>'group_id')::uuid and g.workspace_id = r.workspace_id);
  get diagnostics n = row_count;
  return scb.ok(jsonb_build_object('recorded', n));
end $$;

create function scb_api.get_match_run(p_actor uuid, p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r scb.match_runs;
begin
  select * into r from scb.match_runs where id = p_run;
  if r.id is null or not (r.requested_by = p_actor or scb.is_operator(p_actor, r.workspace_id)) then
    return scb.err('NOT_FOUND', 'Run not found.');
  end if;
  return scb.ok(jsonb_build_object('id', r.id, 'state', r.state, 'source_mode', r.source_mode,
    'requested_group_id', r.requested_group_id, 'call_count', r.call_count, 'error_code', r.error_code,
    'checkpoint', r.checkpoint - 'private', 'result', r.result, 'created_at', r.created_at,
    'updated_at', r.updated_at, 'deadline_at', r.deadline_at));
end $$;

-- Organiser picks one draft for the venue to review (D17 comparison screen).
create function scb_api.request_venue_review(p_actor uuid, p_proposal uuid, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p scb.proposals;
begin
  select * into p from scb.proposals where id = p_proposal for update;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  if not exists (select 1 from scb.proposal_groups pg where pg.proposal_version_id = p.current_version_id
                 and scb.is_group_organiser(p_actor, pg.group_id)) then
    return scb.err('FORBIDDEN', 'Only an included organiser can request review.');
  end if;
  if p.state <> 'DRAFT' then return scb.err('PROPOSAL_CLOSED', 'Only drafts can be sent for review.'); end if;
  if p.review_requested_at is null then
    update scb.proposals set review_requested_at = now(), review_requested_by = p_actor, updated_at = now()
     where id = p.id;
    perform scb.audit(p.workspace_id, p_actor, 'proposal.review_requested', p.id, p_request);
  end if;
  return scb.ok(jsonb_build_object('proposal_id', p.id, 'review_requested', true));
end $$;

-- Rationale projection: shared reasons for every privileged viewer, but
-- per-group fit only for the venue, operators and that group's own organiser.
create or replace function scb.rationale_for(p_actor uuid, p_proposal uuid) returns jsonb
language sql stable set search_path = '' as $$
  select case
    when scb.is_venue_manager(p_actor, scb.proposal_venue(p.id)) or scb.is_operator(p_actor, p.workspace_id)
      then p.rationale
    else (p.rationale - 'by_group') || jsonb_build_object('by_group', coalesce((
      select jsonb_object_agg(k, v) from jsonb_each(coalesce(p.rationale->'by_group', '{}')) as e(k, v)
      where scb.is_group_organiser(p_actor, k::uuid)), '{}'))
  end
  from scb.proposals p where p.id = p_proposal
$$;

-- Redefine the proposal view to use the projected rationale and expose review status.
create or replace function scb_api.get_proposal_detail(p_actor uuid, p_proposal uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p scb.proposals; v scb.proposal_versions; is_venue boolean; is_op boolean;
  organiser_of jsonb; member_of jsonb; mine jsonb; privileged boolean;
begin
  select * into p from scb.proposals where id = p_proposal;
  if p.id is null or not scb.can_view_proposal(p_actor, p_proposal) then
    return scb.err('NOT_FOUND', 'Proposal not found.');
  end if;
  select * into v from scb.proposal_versions where id = p.current_version_id;
  is_venue := scb.is_venue_manager(p_actor, scb.proposal_venue(p.id));
  is_op := scb.is_operator(p_actor, p.workspace_id);
  select coalesce(jsonb_agg(pg.group_id), '[]') into organiser_of from scb.proposal_groups pg
   where pg.proposal_version_id = v.id and scb.is_group_organiser(p_actor, pg.group_id);
  select coalesce(jsonb_agg(pg.group_id), '[]') into member_of from scb.proposal_groups pg
   where pg.proposal_version_id = v.id and scb.is_group_member(p_actor, pg.group_id);
  select jsonb_build_object('id', r.id, 'status', r.status, 'group_id', r.group_id,
                            'proposal_version_id', r.proposal_version_id)
    into mine from scb.reservations r
   join scb.proposal_versions rv on rv.id = r.proposal_version_id
   where rv.proposal_id = p.id and r.participant_id = p_actor
   order by (r.status = 'RESERVED') desc, r.created_at desc limit 1;
  privileged := is_venue or is_op or jsonb_array_length(organiser_of) > 0;

  return scb.ok(scb.proposal_summary(p.id) || jsonb_build_object(
    'terms_hash', v.terms_hash, 'published_at', v.published_at,
    'review_requested_at', p.review_requested_at,
    'experience_id', p.experience_id,
    'experience_description', (select description from scb.experiences where id = p.experience_id),
    'venue_name', (select o.name from scb.experiences e join scb.organisations o
                     on o.id = e.venue_organisation_id where e.id = p.experience_id),
    'access_support', (select to_jsonb(access_support) from scb.experiences where id = p.experience_id),
    'timezone', (select timezone from scb.workspaces where id = p.workspace_id),
    'currency', 'GBP', 'quote_id', v.quote_id,
    'quote_is_current', scb.quote_is_current(v.quote_id),
    'current_quote', (select jsonb_build_object('id', q.id, 'version', q.version, 'ticket_pence', q.ticket_pence)
                      from scb.quotes q where q.experience_id = p.experience_id order by q.version desc limit 1),
    'group_summaries', (
      select jsonb_agg(jsonb_build_object(
        'group_id', g.id, 'name', g.name, 'summary', g.public_summary,
        'decision', d.decision) order by g.name)
      from scb.proposal_groups pg join scb.groups g on g.id = pg.group_id
      left join scb.group_decisions d on d.proposal_version_id = pg.proposal_version_id and d.group_id = g.id
      where pg.proposal_version_id = v.id),
    'rationale', case when privileged then scb.rationale_for(p_actor, p.id) else null end,
    'readiness_blockers', case when privileged and p.state in ('OPEN', 'READY')
                               then to_jsonb(scb.readiness_blockers(p.id)) else null end,
    'superseded_versions', (select count(*) from scb.proposal_versions where proposal_id = p.id
                              and superseded_at is not null),
    'viewer', jsonb_build_object('is_venue_manager', is_venue, 'is_operator', is_op,
                                 'organiser_of', organiser_of, 'member_of', member_of,
                                 'my_reservation', mine)));
end $$;

-- Venue sees drafts only once an organiser requests review.
create or replace function scb.proposal_summary(p_proposal uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'state', p.state, 'version', v.version, 'proposal_version_id', v.id,
    'experience_title', e.title, 'slot_start_at', s.start_at, 'slot_end_at', s.end_at,
    'capacity', s.capacity, 'required_seats', v.required_seats,
    'active_reservations', scb.active_seats(v.id), 'deadline', v.deadline,
    'ticket_pence', q.ticket_pence, 'source_mode', p.source_mode,
    'review_requested_at', p.review_requested_at,
    'group_names', (select jsonb_agg(g.name order by g.name) from scb.proposal_groups pg
                    join scb.groups g on g.id = pg.group_id where pg.proposal_version_id = v.id),
    'payment_status', 'NOT_COLLECTED')
  from scb.proposals p
  join scb.proposal_versions v on v.id = p.current_version_id
  join scb.slots s on s.id = p.slot_id
  join scb.experiences e on e.id = p.experience_id
  join scb.quotes q on q.id = v.quote_id
  where p.id = p_proposal
$$;

revoke all on all functions in schema scb from public, anon, authenticated;
revoke all on all functions in schema scb_api from public, anon, authenticated;
grant execute on all functions in schema scb_api to scb_app;

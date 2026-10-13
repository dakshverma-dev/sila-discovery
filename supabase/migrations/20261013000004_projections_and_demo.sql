-- Role-scoped read projections, brief and catalogue writes, the isolated judge
-- sandbox loader, and the restricted application role.

-- ---------------------------------------------------------------- identities

-- Links a verified Supabase Auth user to an application identity.
create function scb_api.ensure_user_for_auth(p_auth_user uuid, p_display_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not exists (select 1 from auth.users where id = p_auth_user) then
    return scb.err('AUTH_REQUIRED', 'Unknown account.');
  end if;
  select id into uid from scb.users where auth_user_id = p_auth_user and deleted_at is null;
  if uid is null then
    insert into scb.users (auth_user_id, display_name)
    values (p_auth_user, left(coalesce(nullif(trim(p_display_name), ''), 'Member'), 120))
    returning id into uid;
  end if;
  return scb.ok(jsonb_build_object('user_id', uid));
end $$;

create function scb_api.get_actor_context(p_actor uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select scb.ok(jsonb_build_object(
    'user', jsonb_build_object('id', u.id, 'display_name', u.display_name, 'is_synthetic', u.is_synthetic),
    'workspaces', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'mode', w.mode,
                                          'timezone', w.timezone, 'expires_at', w.expires_at))
      from scb.workspaces w
      where exists (select 1 from scb.memberships m where m.workspace_id = w.id and m.user_id = u.id)
         or exists (select 1 from scb.operator_memberships o where o.workspace_id = w.id and o.user_id = u.id)
    ), '[]'::jsonb)))
  from scb.users u where u.id = p_actor and u.deleted_at is null
$$;

-- ---------------------------------------------------------------- projections

create function scb.proposal_summary(p_proposal uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'state', p.state, 'version', v.version, 'proposal_version_id', v.id,
    'experience_title', e.title, 'slot_start_at', s.start_at, 'slot_end_at', s.end_at,
    'capacity', s.capacity, 'required_seats', v.required_seats,
    'active_reservations', scb.active_seats(v.id), 'deadline', v.deadline,
    'ticket_pence', q.ticket_pence, 'source_mode', p.source_mode,
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

-- Full proposal view for an authorised viewer. Excludes member lists, private
-- briefs, access notes and other groups' decline reasons (BR17).
create function scb_api.get_proposal_detail(p_actor uuid, p_proposal uuid)
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
    'experience_id', p.experience_id,
    'experience_description', (select description from scb.experiences where id = p.experience_id),
    'venue_name', (select o.name from scb.experiences e join scb.organisations o
                     on o.id = e.venue_organisation_id where e.id = p.experience_id),
    'access_support', (select to_jsonb(access_support) from scb.experiences where id = p.experience_id),
    'timezone', (select timezone from scb.workspaces where id = p.workspace_id),
    'currency', 'GBP', 'quote_id', v.quote_id,
    'quote_is_current', scb.quote_is_current(v.quote_id),
    'group_summaries', (
      select jsonb_agg(jsonb_build_object(
        'group_id', g.id, 'name', g.name, 'summary', g.public_summary,
        'decision', d.decision) order by g.name)
      from scb.proposal_groups pg join scb.groups g on g.id = pg.group_id
      left join scb.group_decisions d on d.proposal_version_id = pg.proposal_version_id and d.group_id = g.id
      where pg.proposal_version_id = v.id),
    'rationale', case when privileged then p.rationale else null end,
    'readiness_blockers', case when privileged and p.state in ('OPEN', 'READY')
                               then to_jsonb(scb.readiness_blockers(p.id)) else null end,
    'superseded_versions', (select count(*) from scb.proposal_versions where proposal_id = p.id
                              and superseded_at is not null),
    'viewer', jsonb_build_object('is_venue_manager', is_venue, 'is_operator', is_op,
                                 'organiser_of', organiser_of, 'member_of', member_of,
                                 'my_reservation', mine)));
end $$;

-- Dashboard data scoped to what the actor may see in one workspace.
create function scb_api.get_workspace_overview(p_actor uuid, p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w scb.workspaces; venues jsonb; organised jsonb; joined jsonb; operator boolean;
begin
  select * into w from scb.workspaces where id = p_workspace;
  operator := scb.is_operator(p_actor, p_workspace);
  if w.id is null or not (operator or exists (
       select 1 from scb.memberships where workspace_id = p_workspace and user_id = p_actor)) then
    return scb.err('NOT_FOUND', 'Workspace not found.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'name', o.name,
    'experiences', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'description', e.description,
        'approval_status', e.approval_status, 'access_support', to_jsonb(e.access_support),
        'is_synthetic', e.is_synthetic,
        'quote', (select to_jsonb(q) - 'workspace_id' from scb.quotes q
                  where q.experience_id = e.id order by q.version desc limit 1),
        'anchors', coalesce((select jsonb_agg(jsonb_build_object('entity_id', a.entity_id,
                    'label', a.label, 'mapping_reason', a.mapping_reason) order by a.label)
                    from scb.experience_anchors a where a.experience_id = e.id), '[]'),
        'slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'start_at', s.start_at,
                  'end_at', s.end_at, 'capacity', s.capacity, 'status', s.status) order by s.start_at)
                  from scb.slots s where s.experience_id = e.id), '[]')) order by e.title)
      from scb.experiences e where e.venue_organisation_id = o.id), '[]'),
    'proposals', coalesce((select jsonb_agg(scb.proposal_summary(p.id) order by p.created_at desc)
      from scb.proposals p join scb.experiences e on e.id = p.experience_id
      where e.venue_organisation_id = o.id), '[]')) order by o.name), '[]')
  into venues
  from scb.organisations o
  where o.workspace_id = p_workspace and o.kind = 'VENUE'
    and scb.is_venue_manager(p_actor, o.id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'public_summary', g.public_summary,
    'member_count', (select count(*) from scb.group_memberships gm where gm.group_id = g.id),
    'brief', (select jsonb_build_object('id', b.id, 'version', b.version, 'budget_pence', b.budget_pence,
                'expected_seats', b.expected_seats, 'availability', b.availability,
                'sharing_choice', b.sharing_choice, 'external_query_consent', b.external_query_consent,
                'access_requirements', to_jsonb(b.access_requirements), 'created_at', b.created_at,
                'references', coalesce((select jsonb_agg(jsonb_build_object('input_label', r.input_label,
                    'entity_id', r.entity_id, 'subtype', r.subtype, 'declared_meaning', r.declared_meaning,
                    'resolved', r.resolved)) from scb.group_references r where r.brief_id = b.id), '[]'))
              from scb.group_briefs b where b.group_id = g.id order by b.version desc limit 1),
    'proposals', coalesce((select jsonb_agg(scb.proposal_summary(p.id) order by p.created_at desc)
      from scb.proposals p join scb.proposal_groups pg on pg.proposal_version_id = p.current_version_id
      where pg.group_id = g.id), '[]')) order by g.name), '[]')
  into organised
  from scb.groups g where g.workspace_id = p_workspace and scb.is_group_organiser(p_actor, g.id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name,
    'proposals', coalesce((select jsonb_agg(scb.proposal_summary(p.id) || jsonb_build_object(
        'my_reservation', (select jsonb_build_object('id', r.id, 'status', r.status)
                           from scb.reservations r where r.proposal_version_id = p.current_version_id
                             and r.participant_id = p_actor order by r.created_at desc limit 1))
        order by p.created_at desc)
      from scb.proposals p join scb.proposal_groups pg on pg.proposal_version_id = p.current_version_id
      where pg.group_id = g.id and p.state <> 'DRAFT'), '[]')) order by g.name), '[]')
  into joined
  from scb.groups g where g.workspace_id = p_workspace
   and exists (select 1 from scb.group_memberships gm where gm.group_id = g.id
               and gm.user_id = p_actor and gm.role = 'PARTICIPANT');

  return scb.ok(jsonb_build_object(
    'workspace', jsonb_build_object('id', w.id, 'name', w.name, 'mode', w.mode,
                                    'timezone', w.timezone, 'expires_at', w.expires_at),
    'is_operator', operator, 'venues', venues, 'organised_groups', organised,
    'participant_groups', joined));
end $$;

create function scb_api.list_audit_events(p_actor uuid, p_workspace uuid, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not scb.is_operator(p_actor, p_workspace) then
    return scb.err('NOT_FOUND', 'Workspace not found.');
  end if;
  return scb.ok(jsonb_build_object('events', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select a.id, a.action, a.object_id, a.created_at, u.display_name as actor
      from scb.audit_events a left join scb.users u on u.id = a.actor_id
      where a.workspace_id = p_workspace
      order by a.created_at desc limit least(greatest(p_limit, 1), 200)) x), '[]')));
end $$;

-- ---------------------------------------------------------------- briefs

-- Organiser saves a new immutable brief version (R03).
create function scb_api.save_group_brief(
  p_actor uuid, p_group uuid, p_budget_pence integer, p_expected_seats integer,
  p_availability jsonb, p_sharing_choice text, p_external_query_consent boolean,
  p_access_requirements text[], p_references jsonb, p_request uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare g scb.groups; previous scb.group_briefs; next_version integer; brief_id uuid; ref jsonb; w jsonb; errors jsonb := '{}';
begin
  select * into g from scb.groups where id = p_group;
  if g.id is null or not scb.is_group_member(p_actor, p_group) then
    return scb.err('NOT_FOUND', 'Group not found.');
  end if;
  if not scb.is_group_organiser(p_actor, p_group) then
    return scb.err('FORBIDDEN', 'Only the group organiser can edit the brief.');
  end if;
  if p_budget_pence is null or p_budget_pence < 0 or p_budget_pence > 1000000 then
    errors := errors || '{"budget_pence": ["Enter a whole number of pence from 0."]}';
  end if;
  if p_expected_seats is null or p_expected_seats < 1 or p_expected_seats > 100 then
    errors := errors || '{"expected_seats": ["Enter 1 to 100 people."]}';
  end if;
  if p_sharing_choice not in ('WILLING_TO_SHARE', 'PRIVATE_ONLY', 'ASK_FIRST') then
    errors := errors || '{"sharing_choice": ["Choose a sharing option."]}';
  end if;
  if not coalesce(p_access_requirements <@ array['step_free', 'seating', 'quiet_space', 'hearing_support'], true) then
    errors := errors || '{"access_requirements": ["Unknown access requirement."]}';
  end if;
  if jsonb_typeof(p_availability) <> 'array' or jsonb_array_length(p_availability) > 10 then
    errors := errors || '{"availability": ["Provide up to 10 time windows."]}';
  else
    for w in select * from jsonb_array_elements(p_availability) loop
      begin
        if (w->>'start_at')::timestamptz >= (w->>'end_at')::timestamptz then
          errors := errors || '{"availability": ["Each window must end after it starts."]}';
        end if;
      exception when others then
        errors := errors || '{"availability": ["Use exact dates and times."]}';
      end;
    end loop;
  end if;
  if jsonb_typeof(coalesce(p_references, '[]')) <> 'array' or jsonb_array_length(coalesce(p_references, '[]')) > 8 then
    errors := errors || '{"references": ["Provide up to 8 cultural references."]}';
  end if;
  if errors <> '{}' then
    return scb.err('VALIDATION_FAILED', 'Check the highlighted fields.', false,
                   jsonb_build_object('field_errors', errors));
  end if;

  select coalesce(max(version), 0) + 1 into next_version from scb.group_briefs where group_id = p_group;
  -- Consent choices made on the brief are recorded as purpose-specific consent
  -- events whenever they change (D19), separately for sharing and external queries.
  select * into previous from scb.group_briefs where group_id = p_group order by version desc limit 1;
  if previous.id is null or previous.external_query_consent is distinct from coalesce(p_external_query_consent, false) then
    insert into scb.consents (workspace_id, user_id, purpose, notice_version, accepted_at, revoked_at)
    values (g.workspace_id, p_actor, 'EXTERNAL_TASTE_QUERY', 'brief-2026-10',
            case when coalesce(p_external_query_consent, false) then now() end,
            case when not coalesce(p_external_query_consent, false) then now() end);
  end if;
  if previous.id is null or (previous.sharing_choice = 'WILLING_TO_SHARE') <> (p_sharing_choice = 'WILLING_TO_SHARE') then
    insert into scb.consents (workspace_id, user_id, purpose, notice_version, accepted_at, revoked_at)
    values (g.workspace_id, p_actor, 'SHARED_SESSION', 'brief-2026-10',
            case when p_sharing_choice = 'WILLING_TO_SHARE' then now() end,
            case when p_sharing_choice <> 'WILLING_TO_SHARE' then now() end);
  end if;
  insert into scb.group_briefs (workspace_id, group_id, version, budget_pence, expected_seats, availability,
    sharing_choice, external_query_consent, access_requirements, created_by)
  values (g.workspace_id, p_group, next_version, p_budget_pence, p_expected_seats, p_availability,
    p_sharing_choice, coalesce(p_external_query_consent, false), coalesce(p_access_requirements, '{}'), p_actor)
  returning id into brief_id;
  for ref in select * from jsonb_array_elements(coalesce(p_references, '[]')) loop
    insert into scb.group_references (workspace_id, brief_id, input_label, entity_id, subtype,
                                      declared_meaning, resolved)
    values (g.workspace_id, brief_id, left(ref->>'input_label', 200), ref->>'entity_id', ref->>'subtype',
            left(ref->>'declared_meaning', 1000),
            coalesce((ref->>'resolved')::boolean, false) and ref->>'entity_id' is not null
              and ref->>'subtype' is not null);
  end loop;
  perform scb.audit(g.workspace_id, p_actor, 'brief.saved', brief_id, p_request,
                    jsonb_build_object('group_id', p_group, 'version', next_version));
  return scb.ok(jsonb_build_object('brief_id', brief_id, 'version', next_version));
end $$;

-- ---------------------------------------------------------------- catalogue

-- Venue issues a new immutable quote version; open proposals on older quotes
-- stop being ready until the venue revises them (BR07).
create function scb_api.create_quote(
  p_actor uuid, p_experience uuid, p_fixed integer, p_variable integer, p_fee integer,
  p_ticket integer, p_min_charge integer, p_min_seats integer, p_request uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e scb.experiences; next_version integer; quote_id uuid;
begin
  select * into e from scb.experiences where id = p_experience;
  if e.id is null or not scb.is_venue_manager(p_actor, e.venue_organisation_id) then
    return scb.err('NOT_FOUND', 'Programme not found.');
  end if;
  if least(p_fixed, p_variable, p_fee, p_ticket, p_min_charge) < 0
     or p_min_seats is null or p_min_seats < 1 or p_ticket is null then
    return scb.err('VALIDATION_FAILED', 'Quote amounts must be whole, non-negative pence.');
  end if;
  select coalesce(max(version), 0) + 1 into next_version from scb.quotes where experience_id = e.id;
  insert into scb.quotes (workspace_id, experience_id, version, fixed_pence, variable_pence,
    platform_fee_pence, ticket_pence, minimum_venue_charge_pence, venue_min_seats)
  values (e.workspace_id, e.id, next_version, p_fixed, p_variable, p_fee, p_ticket,
    coalesce(p_min_charge, 0), p_min_seats)
  returning id into quote_id;
  perform scb.audit(e.workspace_id, p_actor, 'quote.created', quote_id, p_request,
                    jsonb_build_object('experience_id', e.id, 'version', next_version));
  return scb.ok(jsonb_build_object('quote_id', quote_id, 'version', next_version));
end $$;

-- ---------------------------------------------------------------- judge sandbox

-- Builds an isolated synthetic DEMO workspace from a definition supplied by the
-- server (lib/demo). Every person, group and venue in it is fictional.
create function scb_api.create_demo_workspace(p_definition jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ws uuid; venue_org uuid; users jsonb := '{}'; groups jsonb := '{}';
  experiences jsonb := '{}'; slots jsonb := '{}';
  u jsonb; c jsonb; e jsonb; s jsonb; a jsonb; part text;
  uid uuid; org uuid; gid uuid; eid uuid; sid uuid; manager uuid;
begin
  if jsonb_array_length(coalesce(p_definition->'users', '[]')) > 80
     or jsonb_array_length(coalesce(p_definition->'experiences', '[]')) > 10
     or jsonb_array_length(coalesce(p_definition->'communities', '[]')) > 20 then
    return scb.err('VALIDATION_FAILED', 'Demo definition exceeds sandbox limits.');
  end if;
  insert into scb.workspaces (mode, name, expires_at)
  values ('DEMO', left(coalesce(p_definition->>'name', 'Judge sandbox'), 150),
          now() + make_interval(hours => least(coalesce((p_definition->>'expires_in_hours')::integer, 24), 24)))
  returning id into ws;

  for u in select * from jsonb_array_elements(p_definition->'users') loop
    insert into scb.users (display_name, is_synthetic) values (u->>'display_name', true) returning id into uid;
    users := users || jsonb_build_object(u->>'key', uid);
  end loop;

  insert into scb.organisations (workspace_id, kind, name, verified)
  values (ws, 'VENUE', p_definition->'venue'->>'name', true) returning id into venue_org;
  manager := (users->>(p_definition->'venue'->>'manager'))::uuid;
  insert into scb.memberships (workspace_id, organisation_id, user_id, role)
  values (ws, venue_org, manager, 'VENUE_MANAGER');
  if p_definition ? 'operator' then
    insert into scb.operator_memberships (workspace_id, user_id)
    values (ws, (users->>(p_definition->>'operator'))::uuid);
  end if;

  for e in select * from jsonb_array_elements(p_definition->'experiences') loop
    insert into scb.experiences (workspace_id, venue_organisation_id, title, description, approval_status,
                                 access_support, is_synthetic)
    values (ws, venue_org, e->>'title', e->>'description', 'APPROVED',
            array(select jsonb_array_elements_text(e->'access_support')), true)
    returning id into eid;
    experiences := experiences || jsonb_build_object(e->>'key', eid);
    for a in select * from jsonb_array_elements(e->'anchors') loop
      insert into scb.experience_anchors (workspace_id, experience_id, entity_id, label, subtype,
                                          mapping_reason, approved_by)
      values (ws, eid, a->>'entity_id', a->>'label', 'urn:entity:book', a->>'mapping_reason', manager);
    end loop;
    insert into scb.quotes (workspace_id, experience_id, version, fixed_pence, variable_pence,
      platform_fee_pence, ticket_pence, minimum_venue_charge_pence, venue_min_seats)
    values (ws, eid, 1, (e->'quote'->>'fixed_pence')::integer, (e->'quote'->>'variable_pence')::integer,
      (e->'quote'->>'platform_fee_pence')::integer, (e->'quote'->>'ticket_pence')::integer,
      (e->'quote'->>'minimum_venue_charge_pence')::integer, (e->'quote'->>'venue_min_seats')::integer);
    for s in select * from jsonb_array_elements(e->'slots') loop
      insert into scb.slots (workspace_id, experience_id, start_at, end_at, capacity)
      values (ws, eid, (s->>'start_at')::timestamptz, (s->>'end_at')::timestamptz, (s->>'capacity')::integer)
      returning id into sid;
      slots := slots || jsonb_build_object(s->>'key', sid);
    end loop;
  end loop;

  for c in select * from jsonb_array_elements(p_definition->'communities') loop
    insert into scb.organisations (workspace_id, kind, name, verified)
    values (ws, 'COMMUNITY', c->>'name', true) returning id into org;
    uid := (users->>(c->>'organiser'))::uuid;
    insert into scb.memberships (workspace_id, organisation_id, user_id, role) values (ws, org, uid, 'ORGANISER');
    insert into scb.groups (workspace_id, organisation_id, organiser_user_id, name, public_summary)
    values (ws, org, uid, c->>'name', coalesce(c->>'public_summary', '')) returning id into gid;
    groups := groups || jsonb_build_object(c->>'key', gid);
    insert into scb.group_memberships (workspace_id, group_id, user_id, role) values (ws, gid, uid, 'ORGANISER');
    for part in select * from jsonb_array_elements_text(c->'participants') loop
      insert into scb.memberships (workspace_id, organisation_id, user_id, role)
      values (ws, org, (users->>part)::uuid, 'PARTICIPANT') on conflict do nothing;
      insert into scb.group_memberships (workspace_id, group_id, user_id, role)
      values (ws, gid, (users->>part)::uuid, 'PARTICIPANT') on conflict do nothing;
    end loop;
    if c ? 'brief' then
      insert into scb.group_briefs (workspace_id, group_id, version, budget_pence, expected_seats, availability,
        sharing_choice, external_query_consent, access_requirements, created_by)
      values (ws, gid, 1, (c->'brief'->>'budget_pence')::integer, (c->'brief'->>'expected_seats')::integer,
        c->'brief'->'availability', c->'brief'->>'sharing_choice',
        coalesce((c->'brief'->>'external_query_consent')::boolean, false),
        array(select jsonb_array_elements_text(coalesce(c->'brief'->'access_requirements', '[]'))), uid);
    end if;
  end loop;

  perform scb.audit(ws, null, 'demo.created', ws, gen_random_uuid());
  return scb.ok(jsonb_build_object('workspace_id', ws, 'users', users, 'groups', groups,
                                   'experiences', experiences, 'slots', slots));
end $$;

-- Confirms that a persona belongs to a DEMO workspace that has not expired.
create function scb_api.demo_persona_valid(p_workspace uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from scb.workspaces w join scb.users u on u.id = p_user and u.is_synthetic
    where w.id = p_workspace and w.mode = 'DEMO' and w.expires_at > now()
      and (exists (select 1 from scb.memberships m where m.workspace_id = w.id and m.user_id = u.id)
           or exists (select 1 from scb.operator_memberships o where o.workspace_id = w.id and o.user_id = u.id)))
$$;

create function scb_api.list_demo_personas(p_workspace uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select scb.ok(jsonb_build_object('personas', coalesce(jsonb_agg(x order by x->>'sort', x->>'display_name'), '[]')))
  from (
    select distinct on (u.id) jsonb_build_object(
      'user_id', u.id, 'display_name', u.display_name,
      'role', coalesce(m.role, 'OPERATOR'),
      'organisation', o.name,
      'sort', case coalesce(m.role, 'OPERATOR') when 'VENUE_MANAGER' then '1' when 'ORGANISER' then '2'
                   when 'PARTICIPANT' then '3' else '4' end) as x
    from scb.users u
    left join scb.memberships m on m.user_id = u.id and m.workspace_id = p_workspace
    left join scb.organisations o on o.id = m.organisation_id
    where u.is_synthetic and (m.user_id is not null or exists (
      select 1 from scb.operator_memberships op where op.user_id = u.id and op.workspace_id = p_workspace))
      and exists (select 1 from scb.workspaces w where w.id = p_workspace and w.mode = 'DEMO' and w.expires_at > now())
    order by u.id, case m.role when 'VENUE_MANAGER' then 1 when 'ORGANISER' then 2 else 3 end
  ) personas
$$;

-- Removes expired judge sandboxes and their synthetic people (24-hour lifetime).
create function scb_api.purge_expired_demos() returns integer
language plpgsql security definer set search_path = '' as $$
declare removed integer; doomed uuid[]; personas uuid[];
begin
  select array_agg(id) into doomed from scb.workspaces where mode = 'DEMO' and expires_at <= now();
  if doomed is null then return 0; end if;
  select array_agg(distinct m.user_id) into personas from scb.memberships m
    join scb.users u on u.id = m.user_id where u.is_synthetic and m.workspace_id = any(doomed);
  delete from scb.workspaces where id = any(doomed);
  get diagnostics removed = row_count;
  delete from scb.users u where u.id = any(coalesce(personas, '{}')) and u.is_synthetic
    and not exists (select 1 from scb.memberships m where m.user_id = u.id);
  return removed;
end $$;

-- ---------------------------------------------------------------- app role

-- The Next.js server assumes this role per connection. It may only execute the
-- guarded API functions; it has no table privileges at all.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'scb_app') then
    create role scb_app nologin;
  end if;
end $$;

grant usage on schema scb_api to scb_app;
revoke all on all functions in schema scb_api from public, anon, authenticated;
grant execute on all functions in schema scb_api to scb_app;
alter default privileges in schema scb_api grant execute on functions to scb_app;
grant scb_app to postgres;

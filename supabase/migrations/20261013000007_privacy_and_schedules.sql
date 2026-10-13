-- R16: the requester's own authorised data only. No other person's details,
-- no other group's brief, and no raw provider payloads.
create function scb_api.export_my_data(p_actor uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when u.id is null then scb.err('AUTH_REQUIRED', 'Unknown account.') else scb.ok(jsonb_build_object(
    'exported_at', now(),
    'user', jsonb_build_object('id', u.id, 'display_name', u.display_name, 'created_at', u.created_at,
                               'is_synthetic', u.is_synthetic),
    'organisation_memberships', coalesce((
      select jsonb_agg(jsonb_build_object('workspace_id', m.workspace_id, 'organisation_id', o.id,
                                          'organisation', o.name, 'kind', o.kind, 'role', m.role))
      from scb.memberships m join scb.organisations o on o.id = m.organisation_id where m.user_id = u.id), '[]'),
    'group_memberships', coalesce((
      select jsonb_agg(jsonb_build_object('group_id', g.id, 'group', g.name, 'role', gm.role,
                                          'joined_at', gm.joined_at,
                                          'latest_brief_version', (select max(version) from scb.group_briefs b
                                                                   where b.group_id = g.id)))
      from scb.group_memberships gm join scb.groups g on g.id = gm.group_id where gm.user_id = u.id), '[]'),
    'briefs_authored', coalesce((
      select jsonb_agg(jsonb_build_object('group_id', b.group_id, 'version', b.version,
        'budget_pence', b.budget_pence, 'expected_seats', b.expected_seats, 'availability', b.availability,
        'sharing_choice', b.sharing_choice, 'external_query_consent', b.external_query_consent,
        'access_requirements', to_jsonb(b.access_requirements), 'created_at', b.created_at,
        'references', coalesce((select jsonb_agg(jsonb_build_object('input_label', r.input_label,
            'entity_id', r.entity_id, 'declared_meaning', r.declared_meaning, 'resolved', r.resolved))
            from scb.group_references r where r.brief_id = b.id), '[]')) order by b.created_at)
      from scb.group_briefs b where b.created_by = u.id), '[]'),
    'decisions', coalesce((
      select jsonb_agg(jsonb_build_object('proposal_version_id', d.proposal_version_id, 'group_id', d.group_id,
                                          'decision', d.decision, 'reason_category', d.reason_category,
                                          'reason', d.reason, 'updated_at', d.updated_at))
      from scb.group_decisions d where d.actor_id = u.id), '[]'),
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'proposal_version_id', r.proposal_version_id,
                                          'group_id', r.group_id, 'status', r.status,
                                          'payment_status', r.payment_status, 'created_at', r.created_at))
      from scb.reservations r where r.participant_id = u.id), '[]'),
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object('purpose', c.purpose, 'notice_version', c.notice_version,
                                          'accepted_at', c.accepted_at, 'revoked_at', c.revoked_at))
      from scb.consents c where c.user_id = u.id), '[]'),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object('action', a.action, 'object_id', a.object_id, 'created_at', a.created_at)
                       order by a.created_at)
      from scb.audit_events a where a.actor_id = u.id), '[]')
  )) end
  from (select 1) one left join scb.users u on u.id = p_actor and u.deleted_at is null
$$;

-- Database-side schedules (D23): expiry and sandbox purge do not depend on a
-- web request. Match-run recovery still needs the app worker (/api/v1/internal/tick).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('scb-expire-proposals', '* * * * *', 'select scb_api.expire_proposals()');
    perform cron.schedule('scb-fail-stale-runs', '* * * * *', 'select scb_api.fail_stale_match_runs()');
    perform cron.schedule('scb-purge-demos', '*/15 * * * *', 'select scb_api.purge_expired_demos()');
  end if;
end $$;

revoke all on all functions in schema scb_api from public, anon, authenticated;
grant execute on all functions in schema scb_api to scb_app;

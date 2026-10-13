-- T13: in-app status updates. A projection of audited lifecycle events on
-- proposals the viewer may see; no other person's identity or private data.
create function scb_api.list_my_updates(p_actor uuid, p_workspace uuid, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from scb.memberships where workspace_id = p_workspace and user_id = p_actor)
     and not scb.is_operator(p_actor, p_workspace) then
    return scb.err('NOT_FOUND', 'Workspace not found.');
  end if;
  return scb.ok(jsonb_build_object('updates', coalesce((
    select jsonb_agg(x order by x->>'at' desc) from (
      select jsonb_build_object(
        'id', a.id, 'at', a.created_at, 'action', a.action, 'proposal_id', p.id,
        'experience_title', e.title, 'state', p.state,
        'reason', case when a.action = 'proposal.cancelled' then a.metadata->>'reason' end) as x
      from scb.audit_events a
      join scb.proposals p on p.id = a.object_id
      join scb.experiences e on e.id = p.experience_id
      where a.workspace_id = p_workspace
        and a.action in ('proposal.published', 'proposal.revised', 'proposal.ready', 'proposal.open',
                         'proposal.confirmed', 'proposal.cancelled', 'proposal.expired', 'proposal.completed',
                         'proposal.review_requested')
        and scb.can_view_proposal(p_actor, p.id)
        -- Review requests concern only the venue and organisers.
        and (a.action <> 'proposal.review_requested'
             or scb.is_venue_manager(p_actor, e.venue_organisation_id) or scb.is_operator(p_actor, p.workspace_id))
      order by a.created_at desc
      limit least(greatest(p_limit, 1), 50)) t), '[]')));
end $$;

revoke all on all functions in schema scb_api from public, anon, authenticated;
grant execute on all functions in schema scb_api to scb_app;

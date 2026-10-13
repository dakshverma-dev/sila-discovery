-- R16: purpose-specific consent records and account deletion (D19, D20).

create function scb_api.record_consent(
  p_actor uuid, p_workspace uuid, p_purpose text, p_notice_version text, p_accepted boolean, p_request uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare consent_id uuid;
begin
  if not exists (select 1 from scb.memberships where workspace_id = p_workspace and user_id = p_actor)
     and not scb.is_operator(p_actor, p_workspace) then
    return scb.err('NOT_FOUND', 'Workspace not found.');
  end if;
  if p_purpose not in ('EXTERNAL_TASTE_QUERY', 'SHARED_SESSION', 'OPTIONAL_MEANING') then
    return scb.err('VALIDATION_FAILED', 'Unknown consent purpose.');
  end if;
  if p_notice_version is null or length(p_notice_version) not between 1 and 40 then
    return scb.err('VALIDATION_FAILED', 'A notice version is required.');
  end if;
  insert into scb.consents (workspace_id, user_id, purpose, notice_version, accepted_at, revoked_at)
  values (p_workspace, p_actor, p_purpose, p_notice_version,
          case when p_accepted then now() end, case when not p_accepted then now() end)
  returning id into consent_id;
  perform scb.audit(p_workspace, p_actor, 'consent.' || case when p_accepted then 'accepted' else 'revoked' end,
                    consent_id, p_request, jsonb_build_object('purpose', p_purpose, 'notice_version', p_notice_version));
  return scb.ok(jsonb_build_object('id', consent_id, 'purpose', p_purpose, 'accepted', p_accepted));
end $$;

-- Deletion: withdraw pre-confirmation seats (recomputing readiness), keep
-- confirmed bookings pseudonymised for venue support, clear optional private
-- meanings, revoke consents and unlink the auth identity. Group ownership is
-- retained by the pseudonymised record so other members are not stranded.
create function scb_api.delete_my_account(p_actor uuid, p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u scb.users; r record; withdrawn integer := 0; retained integer := 0;
begin
  select * into u from scb.users where id = p_actor and deleted_at is null for update;
  if u.id is null then return scb.err('AUTH_REQUIRED', 'Unknown account.'); end if;

  for r in
    select res.id, pr.id as proposal_id, pr.state, pr.workspace_id, pr.slot_id
    from scb.reservations res
    join scb.proposal_versions v on v.id = res.proposal_version_id
    join scb.proposals pr on pr.id = v.proposal_id
    where res.participant_id = p_actor and res.status = 'RESERVED'
    order by pr.id
  loop
    if r.state in ('OPEN', 'READY') then
      perform 1 from scb.proposals where id = r.proposal_id for update;
      perform 1 from scb.slots where id = r.slot_id for update;
      update scb.reservations set status = 'WITHDRAWN', updated_at = now() where id = r.id;
      perform scb.sync_readiness(r.proposal_id, p_actor, p_request);
      withdrawn := withdrawn + 1;
    else
      -- Confirmed seats need venue handling; they stay, linked to a pseudonym.
      perform scb.audit(r.workspace_id, null, 'account.deleted_with_confirmed_seat', r.proposal_id, p_request);
      retained := retained + 1;
    end if;
  end loop;

  update scb.group_references gr set declared_meaning = null
    from scb.group_briefs b where b.id = gr.brief_id and b.created_by = p_actor;
  update scb.consents set revoked_at = coalesce(revoked_at, now()) where user_id = p_actor;
  delete from scb.group_memberships where user_id = p_actor and role = 'PARTICIPANT';
  delete from scb.memberships where user_id = p_actor and role = 'PARTICIPANT';
  update scb.users set display_name = 'Deleted member', auth_user_id = null, deleted_at = now() where id = p_actor;

  insert into scb.audit_events (workspace_id, actor_id, action, object_id, request_id, metadata)
  select distinct m.workspace_id, null::uuid, 'account.deleted', p_actor, coalesce(p_request, gen_random_uuid()),
         jsonb_build_object('withdrawn_reservations', withdrawn, 'retained_confirmed', retained)
  from (select workspace_id from scb.memberships where user_id = p_actor
        union select workspace_id from scb.group_memberships where user_id = p_actor
        union select workspace_id from scb.consents where user_id = p_actor) m;

  return scb.ok(jsonb_build_object('withdrawn_reservations', withdrawn, 'retained_confirmed_reservations', retained));
end $$;

-- A deleted identity can no longer act: every guarded path checks membership,
-- and the sandbox persona check now also requires an active account.
create or replace function scb_api.demo_persona_valid(p_workspace uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from scb.workspaces w join scb.users u on u.id = p_user and u.is_synthetic and u.deleted_at is null
    where w.id = p_workspace and w.mode = 'DEMO' and w.expires_at > now()
      and (exists (select 1 from scb.memberships m where m.workspace_id = w.id and m.user_id = u.id)
           or exists (select 1 from scb.operator_memberships o where o.workspace_id = w.id and o.user_id = u.id)))
$$;

revoke all on all functions in schema scb_api from public, anon, authenticated;
grant execute on all functions in schema scb_api to scb_app;

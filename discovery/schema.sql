-- Isolated hackathon database. Never apply to the live pilot database.
create schema if not exists discovery;
create table if not exists discovery.sessions (
  id text primary key, snapshot jsonb not null
);
create table if not exists discovery.runs (
  id uuid primary key, owner uuid not null, input jsonb not null, result jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists discovery.requests (
  id uuid primary key, owner uuid not null, request_key uuid not null, fingerprint text not null,
  snapshot jsonb not null, created_at timestamptz not null default now(), unique(owner, request_key)
);
create table if not exists discovery.quota (
  owner uuid not null, bucket timestamptz not null, used integer not null check(used > 0), primary key(owner, bucket)
);
alter table discovery.quota enable row level security;
alter table discovery.quota force row level security;
drop policy if exists own_quota on discovery.quota;
create policy own_quota on discovery.quota to sila_discovery using (owner::text = current_setting('sila.visitor', true)) with check (owner::text = current_setting('sila.visitor', true));
alter table discovery.runs enable row level security;
alter table discovery.runs force row level security;
alter table discovery.requests enable row level security;
alter table discovery.requests force row level security;
drop policy if exists own_runs on discovery.runs;
create policy own_runs on discovery.runs to sila_discovery using (owner::text = current_setting('sila.visitor', true)) with check (owner::text = current_setting('sila.visitor', true));
drop policy if exists own_requests on discovery.requests;
create policy own_requests on discovery.requests to sila_discovery using (owner::text = current_setting('sila.visitor', true)) with check (owner::text = current_setting('sila.visitor', true));
revoke all on schema discovery from public;
revoke all on all tables in schema discovery from public;
grant usage on schema discovery to sila_discovery;
grant select on discovery.sessions to sila_discovery;
grant select, insert on discovery.runs, discovery.requests to sila_discovery;
grant select, insert, update on discovery.quota to sila_discovery;
-- SELECT FOR SHARE requires UPDATE privilege. A narrow definer function holds
-- the row lock without giving the application any catalogue mutation rights.
create or replace function discovery.locked_session(p_id text) returns jsonb
language sql volatile security definer set search_path = '' as $function$
  select snapshot from discovery.sessions where id = p_id for share;
$function$;
revoke all on function discovery.locked_session(text) from public;
grant execute on function discovery.locked_session(text) to sila_discovery;
create table if not exists discovery.provider_budget (
  day date primary key, reserved integer not null check(reserved >= 0)
);
revoke all on discovery.provider_budget from public, sila_discovery;
create or replace function discovery.reserve_provider_calls(p_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $function$
declare total integer;
begin
  if p_limit < 1 or p_limit > 10000 then return false; end if;
  insert into discovery.provider_budget(day,reserved) values((now() at time zone 'UTC')::date,2)
  on conflict(day) do update set reserved=discovery.provider_budget.reserved+2
  returning reserved into total;
  -- Conservative reservation includes one possible retry; unused calls stay counted.
  return total <= p_limit;
end;
$function$;
revoke all on function discovery.reserve_provider_calls(integer) from public;
grant execute on function discovery.reserve_provider_calls(integer) to sila_discovery;

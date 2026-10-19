-- LOCAL DEVELOPMENT ONLY. Creates the least-privilege login the Next.js server
-- uses. In hosted environments create this role once with a generated secret:
--   create role scb_app_login login password '<secret>' in role scb_app;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'scb_app_login') then
    create role scb_app_login login password 'scb_local_dev_only' in role scb_app;
  end if;
end $$;

-- LOCAL DEVELOPMENT ONLY. Synthetic Sila operator for local sign-in; hosted
-- environments add real operators deliberately, never from this seed.
insert into sila.operators (email) values ('ops@sila.example') on conflict do nothing;

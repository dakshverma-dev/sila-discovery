-- Sila pilot (Gate B): dated sessions — draft, publish, read and pause intake.
-- Offering (activity) fields live on the session row for Gate B; the API and
-- form keep them as a separate group until sessions repeat an offering.

-- ---------------------------------------------------------------- tables

create table sila.sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references sila.venues (id) on delete restrict,
  version int not null default 1 check (version >= 1),
  phase text not null default 'draft'
    check (phase in ('draft', 'published', 'closed', 'confirmed', 'cancelled')),
  terms_version int not null default 1 check (terms_version >= 1),
  -- Activity (offering) fields.
  title text not null check (char_length(title) between 3 and 100),
  description text check (char_length(description) <= 4000),
  inclusions text check (char_length(inclusions) <= 2000),
  image_url text check (char_length(image_url) <= 2000 and image_url ~ '^https://'),
  meeting_point text check (char_length(meeting_point) <= 300),
  -- Dated session fields.
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_minor int not null check (price_minor between 0 and 10000000),
  minimum int not null check (minimum between 1 and 1000),
  capacity int not null check (capacity between 1 and 1000),
  max_clubs int not null default 2 check (max_clubs between 1 and 2),
  deposit_bp int not null default 2500 check (deposit_bp between 1 and 10000),
  payment_window_days int not null default 5 check (payment_window_days between 1 and 60),
  fill_by timestamptz not null,
  decision_by timestamptz not null,
  balance_due_at timestamptz not null,
  resource_name text check (char_length(resource_name) <= 200),
  hold_expires_at timestamptz,
  hold_checked_by text check (char_length(hold_checked_by) <= 200),
  hold_checked_at timestamptz,
  covered_dates date[] not null default '{}' check (cardinality(covered_dates) <= 120),
  venue_terms_version text check (char_length(venue_terms_version) <= 100),
  venue_terms_text text check (char_length(venue_terms_text) <= 20000),
  platform_terms_version text check (char_length(platform_terms_version) <= 100),
  access_facts_reviewed boolean not null default false,
  run_at_minimum_approved boolean not null default false,
  payment_route text check (char_length(payment_route) <= 2000),
  calendar_version text check (char_length(calendar_version) <= 100),
  intake_paused boolean not null default false,
  intake_paused_reason text check (char_length(intake_paused_reason) <= 500),
  -- Lifecycle facts written by later commands, each stored separately (§22, §24).
  minimum_reached_at timestamptz,
  payment_scheduled_for timestamptz,
  payment_opened_at timestamptz,
  pay_by timestamptz,
  verify_by timestamptz,
  payment_opening_blocked_reason text check (char_length(payment_opening_blocked_reason) <= 500),
  published_at timestamptz,
  closed_at timestamptz,
  closed_reason text check (char_length(closed_reason) <= 500),
  confirmed_at timestamptz,
  created_by uuid references sila.people (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (not intake_paused or intake_paused_reason is not null),
  check (phase = 'draft' or published_at is not null)
);
create index sessions_venue_idx on sila.sessions (venue_id, starts_at);

alter table sila.sessions enable row level security;
revoke all on table sila.sessions from public, anon, authenticated;

-- ---------------------------------------------------------------- helpers

-- Operator, or a live coordinator of an existing venue.
create function sila.can_prepare_sessions(p_actor uuid, p_venue uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from sila.venues v where v.id = p_venue)
     and (sila.is_operator(p_actor) or 'coordinator' = any(sila.venue_roles(p_actor, p_venue)))
$$;

-- Operator, or any live member (coordinator or finance) of an existing venue.
create function sila.can_view_venue(p_actor uuid, p_venue uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from sila.venues v where v.id = p_venue)
     and (sila.is_operator(p_actor) or cardinality(sila.venue_roles(p_actor, p_venue)) > 0)
$$;

-- An ISO 8601 instant with an explicit offset, so the server time zone never applies.
create function sila.is_iso_instant(p_value text) returns boolean
language plpgsql stable set search_path = '' as $$
begin
  if p_value is null
     or p_value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)$' then
    return false;
  end if;
  perform p_value::timestamptz;
  return true;
exception when others then
  return false;
end $$;

create function sila.is_local_date(p_value text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  perform p_value::date;
  return true;
exception when others then
  return false;
end $$;

-- Editable draft fields and their simple limits. Lifecycle fields are not editable.
create function sila.session_text_caps() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"title": 100, "description": 4000, "inclusions": 2000, "image_url": 2000, "meeting_point": 300,
           "resource_name": 200, "hold_checked_by": 200, "venue_terms_version": 100,
           "venue_terms_text": 20000, "platform_terms_version": 100, "payment_route": 2000}'::jsonb
$$;

create function sila.session_int_ranges() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"price_minor": [0, 10000000], "minimum": [1, 1000], "capacity": [1, 1000], "max_clubs": [1, 2],
           "deposit_bp": [1, 10000], "payment_window_days": [1, 60]}'::jsonb
$$;

-- Type and range errors for a draft patch, as {field: [message]}.
create function sila.session_draft_errors(p_draft jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  caps jsonb := sila.session_text_caps();
  ranges jsonb := sila.session_int_ranges();
  instants text[] := array['starts_at', 'ends_at', 'fill_by', 'decision_by', 'balance_due_at', 'hold_expires_at'];
  nullable_instants text[] := array['hold_expires_at'];
  booleans text[] := array['access_facts_reviewed', 'run_at_minimum_approved'];
  errors jsonb := '{}';
  k text; v jsonb; t text; s text; n numeric; msg text;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then
    return jsonb_build_object('draft', jsonb_build_array('Send the session fields as an object.'));
  end if;
  for k, v in select e.key, e.value from jsonb_each(p_draft) e loop
    msg := null;
    t := jsonb_typeof(v);
    if not (caps ? k or ranges ? k or k = any(instants) or k = any(booleans) or k = 'covered_dates') then
      msg := 'This field cannot be changed here.';
    elsif t = 'null' then
      if k = 'title' or ranges ? k or (k = any(instants) and not k = any(nullable_instants))
         or k = any(booleans) or k = 'covered_dates' then
        msg := 'This field is required.';
      end if;
    elsif caps ? k then
      s := trim(v #>> '{}');
      if t <> 'string' then
        msg := 'Enter text.';
      elsif k = 'title' and char_length(s) not between 3 and 100 then
        msg := 'Use 3 to 100 characters.';
      elsif char_length(s) > (caps ->> k)::int then
        msg := format('Use at most %s characters.', caps ->> k);
      elsif k = 'image_url' and s <> '' and s !~ '^https://\S+$' then
        msg := 'Enter an https:// address.';
      end if;
    elsif ranges ? k then
      if t <> 'number' then
        msg := 'Enter a whole number.';
      else
        n := (v #>> '{}')::numeric;
        if n <> trunc(n) then
          msg := 'Enter a whole number.';
        elsif n not between (ranges -> k ->> 0)::numeric and (ranges -> k ->> 1)::numeric then
          msg := format('Use %s to %s.', ranges -> k ->> 0, ranges -> k ->> 1);
        end if;
      end if;
    elsif k = any(instants) then
      if t <> 'string' or not sila.is_iso_instant(v #>> '{}') then
        msg := 'Enter a date and time with a UTC offset.';
      end if;
    elsif k = any(booleans) then
      if t <> 'boolean' then msg := 'Choose yes or no.'; end if;
    elsif k = 'covered_dates' then
      if t <> 'array' then
        msg := 'Send a list of dates.';
      elsif jsonb_array_length(v) > 120 then
        msg := 'Use at most 120 dates.';
      elsif exists (select 1 from jsonb_array_elements(v) d
                    where jsonb_typeof(d) <> 'string' or not sila.is_local_date(d #>> '{}')) then
        msg := 'Enter dates as YYYY-MM-DD.';
      end if;
    end if;
    if msg is not null then errors := errors || jsonb_build_object(k, jsonb_build_array(msg)); end if;
  end loop;
  return errors;
end $$;

-- Normalises a validated patch for jsonb_populate_record: trimmed text (empty
-- becomes null), integers without fractions, sorted distinct covered dates.
create function sila.session_draft_normalise(p_draft jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(e.key, case
      when jsonb_typeof(e.value) = 'null' then e.value
      when sila.session_text_caps() ? e.key
        then coalesce(to_jsonb(nullif(trim(e.value #>> '{}'), '')), 'null'::jsonb)
      when sila.session_int_ranges() ? e.key then to_jsonb((e.value #>> '{}')::numeric::int)
      when e.key = 'covered_dates' then coalesce(
        (select jsonb_agg(d order by d) from (select distinct (x #>> '{}')::date as d
                                              from jsonb_array_elements(e.value) x) dates), '[]'::jsonb)
      else e.value end), '{}'::jsonb)
  from jsonb_each(p_draft) e
$$;

-- Required fields still missing after a patch is applied.
create function sila.session_required_errors(p_session sila.sessions) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(e.key, jsonb_build_array('This field is required.')), '{}'::jsonb)
  from jsonb_each(to_jsonb(p_session)) e
  where e.key in ('title', 'starts_at', 'ends_at', 'price_minor', 'minimum', 'capacity', 'fill_by',
                  'decision_by', 'balance_due_at')
    and e.value = 'null'::jsonb
$$;

-- Publication checks SQL can repeat, using PublicationBlocker names
-- (lib/sila/session.ts). Calendar, noon and coverage rules are checked by
-- checkPublication in the server command before publish_session is called.
create function sila.publication_blockers(s sila.sessions) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  b text[] := '{}';
  minutes numeric := extract(epoch from (s.ends_at - s.starts_at)) / 60;
begin
  if char_length(trim(s.title)) not between 3 and 100 then b := b || 'TITLE_LENGTH'::text; end if;
  if minutes <= 0 then b := b || 'END_NOT_AFTER_START'::text;
  elsif minutes < 30 or minutes > 480 then b := b || 'DURATION_OUT_OF_RANGE'::text; end if;
  if s.price_minor <= 0 then b := b || 'PRICE_NOT_POSITIVE'::text; end if;
  if s.minimum <= 0 then b := b || 'MINIMUM_NOT_POSITIVE'::text;
  elsif s.minimum > s.capacity then b := b || 'MINIMUM_ABOVE_CAPACITY'::text; end if;
  if s.max_clubs not between 1 and 2 then b := b || 'CLUB_LIMIT_OUT_OF_RANGE'::text; end if;
  if s.deposit_bp not between 1 and 10000 then b := b || 'DEPOSIT_OUT_OF_RANGE'::text; end if;
  if s.payment_window_days < 5 then b := b || 'PAYMENT_WINDOW_TOO_SHORT'::text; end if;
  -- Final decision at least seven London calendar days before the event.
  if ((s.decision_by at time zone 'Europe/London') + interval '7 days') at time zone 'Europe/London'
     > s.starts_at then
    b := b || 'FINAL_NOTICE_TOO_SHORT'::text;
  end if;
  if s.fill_by >= s.decision_by then b := b || 'FILL_BY_TOO_LATE'::text; end if;
  if s.balance_due_at <= s.decision_by then b := b || 'BALANCE_NOT_AFTER_DECISION'::text; end if;
  if s.hold_expires_at is null or s.hold_checked_by is null then b := b || 'RESOURCE_HOLD_MISSING'::text;
  elsif s.hold_expires_at < s.decision_by then b := b || 'RESOURCE_HOLD_TOO_SHORT'::text; end if;
  if s.venue_terms_version is null then b := b || 'VENUE_TERMS_MISSING'::text; end if;
  if s.platform_terms_version is null then b := b || 'PLATFORM_TERMS_MISSING'::text; end if;
  if not s.access_facts_reviewed then b := b || 'ACCESS_FACTS_UNREVIEWED'::text; end if;
  if not s.run_at_minimum_approved then b := b || 'RUN_AT_MINIMUM_UNAPPROVED'::text; end if;
  return b;
end $$;

create function sila.invalid_fields(p_errors jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select sila.err('INVALID_FIELDS', 'Check the highlighted fields.', jsonb_build_object('field_errors', p_errors))
$$;

-- ---------------------------------------------------------------- API

-- Creates (p_session null) or updates a draft. p_draft holds only editable
-- fields; absent keys are left unchanged. Operator or coordinator only.
create function sila_api.save_session_draft(p_actor uuid, p_key text, p_venue uuid, p_session uuid,
                                            p_expected_version int, p_draft jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('venue', p_venue, 'session', p_session,
                                      'expected_version', p_expected_version, 'draft', p_draft);
  replay jsonb; errors jsonb; result jsonb;
  s sila.sessions; old sila.sessions;
begin
  if not sila.can_prepare_sessions(p_actor, p_venue)
     or (p_session is not null
         and not exists (select 1 from sila.sessions where id = p_session and venue_id = p_venue)) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  replay := sila.idem_begin(p_actor, p_key, 'save_session_draft', request);
  if replay is not null then return replay; end if;

  if p_session is null then
    s.id := gen_random_uuid();
    s.venue_id := p_venue;
    s.version := 1;
    s.phase := 'draft';
    s.terms_version := 1;
    s.max_clubs := 2;
    s.deposit_bp := 2500;
    s.payment_window_days := 5;
    s.covered_dates := '{}';
    s.access_facts_reviewed := false;
    s.run_at_minimum_approved := false;
    s.intake_paused := false;
    s.created_by := p_actor;
  else
    select * into old from sila.sessions where id = p_session for update;
    if old.phase <> 'draft' then
      return sila.idem_finish(p_actor, p_key, 'save_session_draft', request,
        sila.err('NOT_DRAFT', 'This session has been published, so its draft can no longer be edited.'));
    end if;
    if p_expected_version is null then
      return sila.idem_finish(p_actor, p_key, 'save_session_draft', request,
        sila.invalid_fields(jsonb_build_object('expected_version',
                                               jsonb_build_array('Required when editing a session.'))));
    end if;
    if old.version <> p_expected_version then
      return sila.idem_finish(p_actor, p_key, 'save_session_draft', request,
        sila.err('VERSION_CONFLICT', 'This session changed since you opened it. Reload and try again.',
                 jsonb_build_object('current_version', old.version)));
    end if;
    s := old;
  end if;

  errors := sila.session_draft_errors(p_draft);
  if errors = '{}'::jsonb then
    s := jsonb_populate_record(s, sila.session_draft_normalise(p_draft));
    errors := sila.session_required_errors(s);
  end if;
  if errors <> '{}'::jsonb then
    return sila.idem_finish(p_actor, p_key, 'save_session_draft', request, sila.invalid_fields(errors));
  end if;

  -- The hold check is stamped by the server whenever the hold details change.
  if old.id is null or s.hold_expires_at is distinct from old.hold_expires_at
     or s.hold_checked_by is distinct from old.hold_checked_by then
    s.hold_checked_at := case when s.hold_expires_at is not null and s.hold_checked_by is not null
                              then now() end;
  end if;
  s.updated_at := now();

  if old.id is null then
    insert into sila.sessions values (s.*);
  else
    s.version := old.version + 1;
    update sila.sessions set
      title = s.title, description = s.description, inclusions = s.inclusions, image_url = s.image_url,
      meeting_point = s.meeting_point, starts_at = s.starts_at, ends_at = s.ends_at,
      price_minor = s.price_minor, minimum = s.minimum, capacity = s.capacity, max_clubs = s.max_clubs,
      deposit_bp = s.deposit_bp, payment_window_days = s.payment_window_days, fill_by = s.fill_by,
      decision_by = s.decision_by, balance_due_at = s.balance_due_at, resource_name = s.resource_name,
      hold_expires_at = s.hold_expires_at, hold_checked_by = s.hold_checked_by,
      hold_checked_at = s.hold_checked_at, covered_dates = s.covered_dates,
      venue_terms_version = s.venue_terms_version, venue_terms_text = s.venue_terms_text,
      platform_terms_version = s.platform_terms_version, access_facts_reviewed = s.access_facts_reviewed,
      run_at_minimum_approved = s.run_at_minimum_approved, payment_route = s.payment_route,
      version = s.version, updated_at = s.updated_at
    where id = s.id;
  end if;
  perform sila.audit(p_actor, p_venue, 'save_session_draft', 'session', s.id, s.version, null);
  result := sila.ok(jsonb_build_object('session_id', s.id, 'version', s.version));
  return sila.idem_finish(p_actor, p_key, 'save_session_draft', request, result);
end $$;

-- Venue view of one session: every column, the venue and the caller's roles.
create function sila_api.get_venue_session(p_actor uuid, p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s sila.sessions; v sila.venues;
begin
  select * into s from sila.sessions where id = p_session;
  if not found or not sila.can_view_venue(p_actor, s.venue_id) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  select * into v from sila.venues where id = s.venue_id;
  return sila.ok(jsonb_build_object(
    'session', to_jsonb(s),
    'venue', jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address, 'time_zone', v.time_zone,
                                'access_facts', v.access_facts, 'contact_email', v.contact_email,
                                'contact_phone', v.contact_phone),
    'roles', to_jsonb(sila.venue_roles(p_actor, s.venue_id))));
end $$;

create function sila_api.list_venue_sessions(p_actor uuid, p_venue uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not sila.can_view_venue(p_actor, p_venue) then return sila.err('NOT_FOUND', 'Not found.'); end if;
  return sila.ok(jsonb_build_object('sessions', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'version', s.version, 'phase', s.phase, 'title', s.title,
             'starts_at', s.starts_at, 'ends_at', s.ends_at, 'fill_by', s.fill_by, 'decision_by', s.decision_by,
             'price_minor', s.price_minor, 'minimum', s.minimum, 'capacity', s.capacity,
             'intake_paused', s.intake_paused, 'published_at', s.published_at)
           order by s.starts_at, s.id)
    from sila.sessions s where s.venue_id = p_venue), '[]'::jsonb)));
end $$;

-- Coordinator only. The server command runs the full checkPublication first;
-- these checks repeat what SQL can verify under the row lock.
create function sila_api.publish_session(p_actor uuid, p_key text, p_session uuid, p_expected_version int,
                                         p_calendar_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb := jsonb_build_object('session', p_session, 'expected_version', p_expected_version,
                                      'calendar_version', p_calendar_version);
  replay jsonb; result jsonb; v_venue uuid; blockers text[];
  v_calendar text := nullif(trim(coalesce(p_calendar_version, '')), '');
  s sila.sessions;
begin
  select venue_id into v_venue from sila.sessions where id = p_session;
  if not found or not ('coordinator' = any(sila.venue_roles(p_actor, v_venue))) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  replay := sila.idem_begin(p_actor, p_key, 'publish_session', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = p_session for update;
  if s.phase <> 'draft' then
    result := sila.err('NOT_DRAFT', 'This session has already been published.');
  elsif p_expected_version is null or s.version <> p_expected_version then
    result := sila.err('VERSION_CONFLICT', 'This session changed since you opened it. Reload and try again.',
                       jsonb_build_object('current_version', s.version));
  elsif v_calendar is null or char_length(v_calendar) > 100 then
    result := sila.invalid_fields(jsonb_build_object('calendar_version',
                                                     jsonb_build_array('A business calendar version is required.')));
  else
    blockers := sila.publication_blockers(s);
    if cardinality(blockers) > 0 then
      result := sila.err('NOT_READY', 'This session cannot be published yet.',
                         jsonb_build_object('blockers', to_jsonb(blockers)));
    else
      update sila.sessions
         set phase = 'published', published_at = now(), calendar_version = v_calendar,
             version = version + 1, updated_at = now()
       where id = p_session
      returning * into s;
      perform sila.audit(p_actor, s.venue_id, 'publish_session', 'session', s.id, s.version, null);
      result := sila.ok(jsonb_build_object('session_id', s.id, 'version', s.version,
                                           'published_at', s.published_at));
    end if;
  end if;
  return sila.idem_finish(p_actor, p_key, 'publish_session', request, result);
end $$;

-- Public view for organisers: published, closed or confirmed sessions only.
-- committed_places is 0 until commitments exist (replaced by a later migration).
create function sila_api.get_public_session(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s sila.sessions; v sila.venues;
begin
  select * into s from sila.sessions where id = p_session and phase in ('published', 'closed', 'confirmed');
  if not found then return sila.err('NOT_FOUND', 'Not found.'); end if;
  select * into v from sila.venues where id = s.venue_id;
  return sila.ok(jsonb_build_object(
    'id', s.id, 'title', s.title, 'description', s.description, 'inclusions', s.inclusions,
    'meeting_point', s.meeting_point, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'price_minor', s.price_minor, 'minimum', s.minimum, 'capacity', s.capacity, 'max_clubs', s.max_clubs,
    'deposit_bp', s.deposit_bp, 'fill_by', s.fill_by, 'decision_by', s.decision_by, 'phase', s.phase,
    'intake_open', s.phase = 'published' and not s.intake_paused and now() <= s.fill_by,
    'committed_places', 0,
    'venue', jsonb_build_object('name', v.name, 'address', v.address, 'access_facts', v.access_facts,
                                'contact_email', v.contact_email, 'contact_phone', v.contact_phone)));
end $$;

-- Pauses or resumes new requests on a published session. Coordinator or
-- operator; a reason is required when pausing and is audited.
create function sila_api.set_session_intake(p_actor uuid, p_key text, p_session uuid, p_paused boolean,
                                            p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  request jsonb := jsonb_build_object('session', p_session, 'paused', p_paused, 'reason', v_reason);
  replay jsonb; result jsonb; v_venue uuid;
  s sila.sessions;
begin
  select venue_id into v_venue from sila.sessions where id = p_session;
  if not found or not sila.can_prepare_sessions(p_actor, v_venue) then
    return sila.err('NOT_FOUND', 'Not found.');
  end if;
  replay := sila.idem_begin(p_actor, p_key, 'set_session_intake', request);
  if replay is not null then return replay; end if;

  select * into s from sila.sessions where id = p_session for update;
  if p_paused is null then
    result := sila.invalid_fields(jsonb_build_object('paused', jsonb_build_array('Choose pause or resume.')));
  elsif p_paused and v_reason is null then
    result := sila.invalid_fields(jsonb_build_object('reason',
                                  jsonb_build_array('Give a reason for pausing new requests.')));
  elsif char_length(v_reason) > 500 then
    result := sila.invalid_fields(jsonb_build_object('reason', jsonb_build_array('Use at most 500 characters.')));
  elsif s.phase <> 'published' then
    result := sila.err('SESSION_NOT_OPEN', 'Only a published session can have requests paused or resumed.');
  elsif s.intake_paused = p_paused and s.intake_paused_reason is not distinct from
        (case when p_paused then v_reason end) then
    result := sila.ok(jsonb_build_object('session_id', s.id, 'version', s.version,
                                         'intake_paused', s.intake_paused));
  else
    update sila.sessions
       set intake_paused = p_paused, intake_paused_reason = case when p_paused then v_reason end,
           version = version + 1, updated_at = now()
     where id = p_session
    returning * into s;
    perform sila.audit(p_actor, s.venue_id, 'set_session_intake', 'session', s.id, s.version, v_reason);
    result := sila.ok(jsonb_build_object('session_id', s.id, 'version', s.version,
                                         'intake_paused', s.intake_paused));
  end if;
  return sila.idem_finish(p_actor, p_key, 'set_session_intake', request, result);
end $$;

-- ---------------------------------------------------------------- grants

-- Default-privilege revokes do not cover these objects, so revoke explicitly.
revoke all on all tables in schema sila from public, anon, authenticated;
revoke all on all sequences in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila from public, anon, authenticated;
revoke all on all functions in schema sila_api from public, anon, authenticated;
grant usage on schema sila_api to scb_app;
grant execute on all functions in schema sila_api to scb_app;

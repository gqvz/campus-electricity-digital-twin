-- Run after migrations + seed:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
-- Each block raises if a security expectation fails; all changes are rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'auditor@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'reviewer@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'outsider@example.test');
insert into public.team_members (user_id, display_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Auditor', 'auditor'),
  ('00000000-0000-0000-0000-0000000000b1', 'Reviewer', 'reviewer');
insert into public.buildings (id, name, kind, floors, audit_scope) values ('t1', 'Test', 'Academic', 3, true)
  on conflict do nothing;

-- auditor creates a session and a draft
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.audit_sessions (id, started_at) values ('11111111-1111-1111-1111-111111111111', now());
insert into public.observations (id, session_id, building_id, floor, zone_name, device, device_count, unit_watts, occupied, observed_at)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 't1', 1, 'Room 101', 'fans', 4, 65, false, now());

do $$ begin  -- watts are computed, kWh is null without a verified duration
  assert (select watts from public.observations where id = '22222222-2222-2222-2222-222222222222') = 260;
  assert (select kwh from public.observations where id = '22222222-2222-2222-2222-222222222222') is null;
end $$;

do $$ begin  -- auditor cannot publish
  begin
    update public.observations set state = 'published' where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'auditor published an observation';
  exception when others then
    if sqlerrm = 'auditor published an observation' then raise; end if;
  end;
end $$;

do $$ begin  -- a duration without a later verified_at is rejected
  begin
    update public.observations set verified_hours = 2 where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'duration accepted without verified_at';
  exception when check_violation then null; end;
end $$;

-- anonymous sees nothing from the base tables and no drafts through the view
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.observations;
    raise exception 'anon read observations table';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from public.public_observations) = 0;
  begin
    insert into public.observations (session_id, building_id, floor, zone_name, device, device_count, unit_watts, occupied, observed_at)
      values ('11111111-1111-1111-1111-111111111111', 't1', 0, 'x', 'fans', 1, 1, false, now());
    raise exception 'anon inserted';
  exception when insufficient_privilege or others then
    if sqlerrm = 'anon inserted' then raise; end if;
  end;
end $$;

-- reviewer publishes; anon then sees it, without identity fields
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
update public.observations set state = 'reviewed' where id = '22222222-2222-2222-2222-222222222222';
update public.observations set state = 'published' where id = '22222222-2222-2222-2222-222222222222';
reset role;
set local role anon;
do $$ begin
  assert (select count(*) from public.public_observations) = 1;
  assert not exists (select 1 from information_schema.columns
                     where table_name = 'public_observations' and column_name in ('auditor', 'session_id', 'private_notes'));
end $$;

rollback;

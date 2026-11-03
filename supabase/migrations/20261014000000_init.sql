-- IITR Pulse: schema, row-level security and public views.
-- Rules that protect data honesty live here, not in the UI:
--   * watts = device_count * unit_watts (generated, never user-supplied)
--   * kWh exists only when a verified duration exists
--   * anonymous visitors can read published, sanitized data through views only

create extension if not exists pgcrypto;

create type obs_state as enum ('draft', 'reviewed', 'published', 'resolved');
create type device_kind as enum ('lights', 'fans', 'ac', 'other');
create type team_role as enum ('auditor', 'reviewer', 'admin');

create table public.team_members (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  role team_role not null default 'auditor',
  created_at timestamptz not null default now()
);

create table public.buildings (
  id text primary key,                       -- same ids the app uses ('lhc', 'osm-way-123')
  name text not null,
  kind text not null,
  floors int not null default 1 check (floors between 1 and 40),
  audit_scope boolean not null default false
);

create table public.audit_sessions (
  id uuid primary key default gen_random_uuid(),
  auditor uuid not null references auth.users on delete restrict default auth.uid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text                                 -- private
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audit_sessions on delete restrict,
  auditor uuid not null references auth.users default auth.uid(),
  building_id text not null references public.buildings,
  floor int not null check (floor >= 0),
  zone_name text not null check (char_length(zone_name) between 1 and 120),
  device device_kind not null,
  device_count int not null check (device_count between 1 and 500),
  unit_watts int not null check (unit_watts between 1 and 5000),
  occupied boolean not null,
  observed_at timestamptz not null,
  verified_at timestamptz,
  verified_hours numeric(6,2),
  confidence text not null default 'direct' check (confidence in ('direct', 'inferred')),
  recommendation text check (char_length(recommendation) <= 400),
  private_notes text,
  state obs_state not null default 'draft',
  submitted_at timestamptz,                  -- set when the auditor asks for review
  reviewed_by uuid references auth.users,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  -- generated, so a client can never claim a different load
  watts int generated always as (device_count * unit_watts) stored,
  kwh numeric generated always as (
    case when verified_hours is not null then device_count * unit_watts * verified_hours / 1000 end
  ) stored,
  -- a duration needs a revisit/shutdown timestamp after the sighting
  constraint verified_duration_supported check (
    verified_hours is null
    or (verified_at is not null and verified_at > observed_at and verified_hours > 0 and verified_hours <= 24)
  )
);
create index observations_building_idx on public.observations (building_id, state);
create index observations_state_idx on public.observations (state, submitted_at);

create table public.evidence_photos (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations on delete cascade,
  storage_path text not null,                -- bucket 'evidence' (private)
  public_path text,                          -- bucket 'evidence-public', set after review
  sanitized boolean not null default false,  -- faces/screens/IDs checked, EXIF stripped
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

create function public.is_team() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where user_id = auth.uid())
$$;
create function public.is_reviewer() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where user_id = auth.uid() and role in ('reviewer', 'admin'))
$$;

-- ------------------------------------------------- state-transition guard

create function public.guard_observation_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_reviewer() then
    if new.state is distinct from old.state then
      if not ((old.state = 'draft' and new.state = 'reviewed')
           or (old.state = 'reviewed' and new.state in ('published', 'draft'))
           or (old.state = 'published' and new.state = 'resolved')) then
        raise exception 'invalid state change % -> %', old.state, new.state;
      end if;
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      if new.state = 'published' then
        if exists (select 1 from public.evidence_photos p where p.observation_id = new.id and not p.sanitized) then
          raise exception 'publish blocked: unsanitized photos attached';
        end if;
        new.published_at := now();
      end if;
    end if;
    return new;
  end if;
  -- auditors: own drafts only, cannot change state or review fields
  if old.auditor <> auth.uid() or old.state <> 'draft' then
    raise exception 'only the author may edit a draft';
  end if;
  if new.state <> 'draft' or new.reviewed_by is distinct from old.reviewed_by or new.published_at is distinct from old.published_at then
    raise exception 'auditors cannot change review state';
  end if;
  return new;
end $$;
create trigger observations_guard before update on public.observations
  for each row execute function public.guard_observation_update();

-- ------------------------------------------------------------------- RLS

alter table public.team_members enable row level security;
alter table public.buildings enable row level security;
alter table public.audit_sessions enable row level security;
alter table public.observations enable row level security;
alter table public.evidence_photos enable row level security;

create policy buildings_read on public.buildings for select using (true);
create policy buildings_admin on public.buildings for all
  using (exists (select 1 from public.team_members where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.team_members where user_id = auth.uid() and role = 'admin'));

create policy team_self on public.team_members for select using (user_id = auth.uid() or public.is_reviewer());

create policy sessions_own on public.audit_sessions for select using (auditor = auth.uid() or public.is_reviewer());
create policy sessions_insert on public.audit_sessions for insert with check (public.is_team() and auditor = auth.uid());
create policy sessions_update on public.audit_sessions for update using (auditor = auth.uid()) with check (auditor = auth.uid());

create policy obs_read_own on public.observations for select using (auditor = auth.uid() or public.is_reviewer());
create policy obs_insert on public.observations for insert
  with check (public.is_team() and auditor = auth.uid() and state = 'draft'
              and exists (select 1 from public.audit_sessions s where s.id = session_id and s.auditor = auth.uid()));
create policy obs_update on public.observations for update
  using (auditor = auth.uid() or public.is_reviewer())
  with check (auditor = auth.uid() or public.is_reviewer());
create policy obs_delete on public.observations for delete using (auditor = auth.uid() and state = 'draft');

create policy photos_read on public.evidence_photos for select
  using (exists (select 1 from public.observations o where o.id = observation_id and (o.auditor = auth.uid() or public.is_reviewer())));
create policy photos_insert on public.evidence_photos for insert
  with check (exists (select 1 from public.observations o where o.id = observation_id and o.auditor = auth.uid() and o.state = 'draft'));
create policy photos_review on public.evidence_photos for update using (public.is_reviewer()) with check (public.is_reviewer());

-- ------------------------------------------------------- public read API
-- Views run with the owner's rights, so they are the only door for anon.
-- No auditor id, session id, private notes, or drafts leave through here.

create view public.public_observations as
  select o.id, o.building_id, o.floor, o.zone_name, o.device, o.device_count, o.unit_watts, o.watts,
         o.occupied, o.observed_at, o.verified_at, o.verified_hours, o.kwh, o.confidence,
         o.recommendation, o.state, o.published_at
  from public.observations o
  where o.state in ('published', 'resolved');

create view public.public_evidence_photos as
  select p.id, p.observation_id, p.public_path
  from public.evidence_photos p
  join public.observations o on o.id = p.observation_id
  where p.sanitized and p.public_path is not null and o.state in ('published', 'resolved');

revoke all on public.observations, public.evidence_photos, public.audit_sessions, public.team_members from anon;
grant select on public.buildings, public.public_observations, public.public_evidence_photos to anon, authenticated;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false), ('evidence-public', 'evidence-public', true)
  on conflict (id) do nothing;

create policy evidence_team_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and public.is_team() and (storage.foldername(name))[1] = auth.uid()::text);
create policy evidence_team_read on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_reviewer()));
create policy evidence_public_write on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence-public' and public.is_reviewer());

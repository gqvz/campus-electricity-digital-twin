-- Once an author submits an observation for review it is locked: the reviewer must approve
-- exactly what they saw. A reviewer returning it to the author (submitted_at -> null) unlocks it.
create or replace function public.guard_observation_update() returns trigger language plpgsql security definer set search_path = public as $$
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
  if old.auditor <> auth.uid() or old.state <> 'draft' then
    raise exception 'only the author may edit a draft';
  end if;
  if old.submitted_at is not null then
    raise exception 'submitted observations are locked until a reviewer returns them';
  end if;
  if new.state <> 'draft' or new.reviewed_by is distinct from old.reviewed_by or new.published_at is distinct from old.published_at then
    raise exception 'auditors cannot change review state';
  end if;
  return new;
end $$;

drop policy if exists obs_delete on public.observations;
create policy obs_delete on public.observations for delete using (auditor = auth.uid() and state = 'draft' and submitted_at is null);

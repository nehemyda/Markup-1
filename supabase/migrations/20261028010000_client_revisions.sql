-- Client revisions. Clients (guests) add pins, then submit them to the developers as a revision. The guest link is
-- then view-only until someone on the team opens it for the next revision. The team sees client pins live either way;
-- submitting is for tracking (how many revisions a client used) and tells the developers the round is complete.

-- open: the client can add pins and comments; submitted: view-only for the client
alter table public.projects add column review_state text not null default 'open' check (review_state in ('open', 'submitted'));
alter table public.projects add column revision_count integer not null default 0;

-- The revision a client pin was submitted in (null = not submitted yet, 0 = from before revisions were counted)
alter table public.pins add column revision integer;
update public.pins set revision = 0
where revision is null and (author ->> 'role' = 'Guest' or author ->> 'id' like 'guest\_%');

create table public.revisions (
  id text primary key,
  project_id text not null,
  number integer not null,
  -- submitted: the developers are working on it; done: every pin in it is resolved or ready for review
  status text not null default 'submitted' check (status in ('submitted', 'done')),
  pin_ids text[] not null default '{}',
  -- Who added the pins: [{ name, email, count }]
  people jsonb not null default '[]',
  -- { id, name, email, isGuest } (a team member can submit for the client)
  submitted_by jsonb,
  submitted_at timestamptz not null default now(),
  done_at timestamptz,
  reopened_at timestamptz,
  reopened_by jsonb,
  unique (project_id, number)
);
create index revisions_project_idx on public.revisions (project_id, number desc);

create function public.project_is_open(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select review_state = 'open' from public.projects where id = p_id), false)
$$;

-- Submitting, reopening and revision numbers are set by the server only. A browser saving an older copy of a
-- project or pin keeps the saved values instead of overwriting them.
create or replace function public.projects_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.from_browser() then
    new.review_state := old.review_state;
    new.revision_count := old.revision_count;
    if not public.is_member() then
      if not public.changed_columns(to_jsonb(old), to_jsonb(new)) <@ array['assets', 'updated_at']
         or jsonb_array_length(new.assets) <= jsonb_array_length(old.assets) then
        raise exception 'Guests can only add pages to the shared project.';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.pins_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.from_browser() then
    new.revision := old.revision;
    if not public.is_member() then
      if not public.changed_columns(to_jsonb(old), to_jsonb(new)) <@ array['comments', 'is_unread', 'updated_at'] then
        raise exception 'Guests can only comment on pins.';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- New rows from browsers start unsubmitted
create function public.new_row_defaults() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.from_browser() then
    if tg_table_name = 'pins' then
      new.revision := null;
    elsif tg_table_name = 'projects' then
      new.review_state := 'open';
      new.revision_count := 0;
    end if;
  end if;
  return new;
end $$;
create trigger pins_new_row before insert on public.pins for each row execute function public.new_row_defaults();
create trigger projects_new_row before insert on public.projects for each row execute function public.new_row_defaults();

-- Guests can add pins, comment and add pages only while their project is open
drop policy "update projects" on public.projects;
create policy "update projects" on public.projects for update to authenticated
  using (public.is_member() or (id = public.guest_project() and review_state = 'open'))
  with check (public.is_member() or (id = public.guest_project() and review_state = 'open'));

drop policy "add pins" on public.pins;
create policy "add pins" on public.pins for insert to authenticated
  with check (public.is_member() or (project_id = public.guest_project() and public.project_is_open(project_id)));

drop policy "update pins" on public.pins;
create policy "update pins" on public.pins for update to authenticated
  using (public.is_member() or (project_id = public.guest_project() and public.project_is_open(project_id)))
  with check (public.is_member() or (project_id = public.guest_project() and public.project_is_open(project_id)));

alter table public.revisions enable row level security;
create policy "read revisions" on public.revisions for select to authenticated
  using (public.is_member() or project_id = public.guest_project());
grant select on public.revisions to authenticated;
grant all on public.revisions to service_role;

alter publication supabase_realtime add table public.revisions;

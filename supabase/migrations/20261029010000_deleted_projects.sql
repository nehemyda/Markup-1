-- Recently deleted projects: a deleted project and its pins are kept here for 30 days, so the team can restore it.
-- The server moves projects in and out (server/trash.ts) and removes them for good after 30 days; browsers only read.

create table public.deleted_projects (
  id text primary key,            -- the project's id
  name text not null default '',
  url text,
  project jsonb not null,         -- the projects row as it was
  pins jsonb not null default '[]',  -- its pins rows as they were
  deleted_by jsonb,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_projects enable row level security;
create policy "members read deleted projects" on public.deleted_projects for select to authenticated using (public.is_member());

-- Projects are deleted through the server only, so nothing skips the 30-day list
drop policy "members delete projects" on public.projects;

grant select on public.deleted_projects to authenticated;
grant all on public.deleted_projects to service_role;

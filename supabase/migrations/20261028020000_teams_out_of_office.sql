-- Teams and out of office. Admins group people into teams: a Manager, a Team Lead and the team's developers.
-- While someone is out of office, what they would be told also goes to their Team Lead (or the Manager when the
-- lead is out), see server/teams.ts. Teams are also who gets overdue alerts.

-- Out of office: on/off, and optionally the last day away (it ends by itself after that day)
alter table public.users add column out_of_office boolean not null default false;
alter table public.users add column out_of_office_until date;

create table public.teams (
  id text primary key,
  name text not null default '',
  manager_id text,
  lead_id text,
  member_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams enable row level security;
create policy "members read teams" on public.teams for select to authenticated using (public.is_member());
create policy "admins add teams" on public.teams for insert to authenticated with check (public.is_admin());
create policy "admins change teams" on public.teams for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete teams" on public.teams for delete to authenticated using (public.is_admin());
grant select, insert, update, delete on public.teams to authenticated;
grant all on public.teams to service_role;

-- Admins may also switch someone's out of office (e.g. when they forgot before leaving)
create or replace function public.users_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  changed text[] := public.changed_columns(to_jsonb(old), to_jsonb(new));
begin
  if not public.from_browser() then return new; end if;
  if old.id = public.current_member_id() then
    if changed && array['role', 'removed', 'removed_at', 'email', 'is_master_admin', 'id', 'auth_id'] then
      raise exception 'You can only change your own name, photo, status, department and out of office.';
    end if;
  elsif public.is_admin() and not old.is_master_admin then
    if not changed <@ array['role', 'removed', 'removed_at', 'out_of_office', 'out_of_office_until'] then
      raise exception 'Admins can only change a member''s role, out of office, or remove them.';
    end if;
  elsif public.is_admin() then
    if not changed <@ array['out_of_office', 'out_of_office_until'] then
      raise exception 'Not allowed.';
    end if;
  else
    raise exception 'Not allowed.';
  end if;
  return new;
end $$;

alter publication supabase_realtime add table public.teams;

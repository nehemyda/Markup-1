-- Revision deadlines and reminders (server/deadlines.ts). A submitted revision is due a set number of (working) days
-- later; when it isn't done by then, its developers, their Team Leads and Managers are told, once a day. Client pins
-- left unsubmitted too long remind the project's developers. Admins set both in Settings → Teams.

alter table public.revisions add column due_at timestamptz;
alter table public.revisions add column overdue_alerted_at timestamptz;

-- Last reminder about the client's unsubmitted pins on this project (cleared when they submit)
alter table public.projects add column unsent_reminded_at timestamptz;

-- Set by the server only, like the review state
create or replace function public.projects_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.from_browser() then
    new.review_state := old.review_state;
    new.revision_count := old.revision_count;
    new.unsent_reminded_at := old.unsent_reminded_at;
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

-- The "revisions" settings row (due days, reminder hours): members read it, admins change it
drop policy "read settings" on public.settings;
create policy "read settings" on public.settings for select to anon, authenticated
  using (id in ('access', 'branding') or (id in ('permissions', 'revisions') and public.is_member()));
drop policy "admins add settings" on public.settings;
create policy "admins add settings" on public.settings for insert to authenticated
  with check (public.is_admin() and id in ('access', 'branding', 'permissions', 'revisions'));
drop policy "admins change settings" on public.settings;
create policy "admins change settings" on public.settings for update to authenticated
  using (public.is_admin() and id in ('access', 'branding', 'permissions', 'revisions'))
  with check (public.is_admin() and id in ('access', 'branding', 'permissions', 'revisions'));

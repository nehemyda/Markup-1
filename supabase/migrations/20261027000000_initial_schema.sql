-- Markup database (Supabase / Postgres).
--
-- Who can read and change what is decided here with Row Level Security, the same rules the app had in Firestore.
-- The server uses the service-role key, which is not limited by these rules; it creates member profiles, gives
-- guests their project pass and is the only one that can touch WordPress keys, the audit log and the extension keys.
--
-- Column names are snake_case; the app's camelCase fields map to them one-to-one (src/lib/rows.ts).
-- Nested parts of a record (a project's pages, a pin's comments, people shown on a pin) are jsonb.
-- Times the browser shows as written (e.g. a pin's createdAt) are text; times set by the server are timestamptz.

-- ---------- Tables ----------

-- Team members. id is the member's id everywhere in the app; auth_id is their Supabase sign-in account.
-- (Accounts moved from Firebase keep their old id, so older records still point at the right person.)
create table public.users (
  id text primary key,
  auth_id uuid unique references auth.users (id) on delete set null,
  name text not null default '',
  email text not null default '',
  avatar text,
  role text not null default 'Member',
  organization_id text,
  organization_name text,
  status text default 'offline',
  cursor_color text default '#6366f1',
  department text,
  is_master_admin boolean not null default false,
  removed boolean not null default false,
  removed_at text,
  created_at timestamptz not null default now()
);
create index users_email_idx on public.users (lower(email));

-- Pending invitations (id = the invited email in lower case) until that person creates an account
create table public.invites (
  id text primary key,
  name text,
  email text not null,
  role text not null default 'Member',
  invited_by text,
  invited_at text
);

-- Folders group projects, e.g. per partner
create table public.folders (
  id text primary key,
  name text not null default '',
  created_at text,
  created_by text
);

create table public.projects (
  id text primary key,
  name text not null default '',
  client text,
  description text,
  color text,
  avatar text,
  member_count integer,
  last_updated text,
  owner_id text,
  created_by text,
  -- Team members told about new client feedback; empty = the creator (owner_id)
  assignee_ids text[] not null default '{}',
  folder_id text,
  -- Pages and files under review (Asset[])
  assets jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table public.pins (
  id text primary key,
  project_id text,
  asset_id text,
  number integer,
  x double precision,
  y double precision,
  category text,
  status text,
  priority text,
  title text,
  created_at text,
  author jsonb,
  assigned_to jsonb,
  assigned_by jsonb,
  metadata jsonb,
  comments jsonb not null default '[]',
  is_unread boolean,
  qa_error jsonb,
  screenshot_url text,
  attachments jsonb,
  deleted_at text,
  deleted_by jsonb,
  updated_at timestamptz not null default now()
);
create index pins_project_idx on public.pins (project_id);
create index pins_asset_idx on public.pins (asset_id);

-- In-app notifications, one per person (created by the server, see server/notifications.ts)
create table public.notifications (
  id text primary key,
  recipient_uid text not null,
  type text,
  title text,
  message text,
  project_id text,
  project_name text,
  pin_id text,
  pin_number integer,
  asset_id text,
  actor jsonb,
  read boolean not null default false,
  read_at text,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_uid, created_at desc);

-- Workspace settings, one row each: access (allowed domains, guest links), branding, permissions,
-- chat (daily summary) and aiPricing
create table public.settings (
  id text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Every Gemini request with its estimated cost (monthly totals: the ai_usage_monthly view)
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  month text not null,
  feature text,
  project_id text,
  actor jsonb,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd double precision not null default 0,
  pricing jsonb
);
create index ai_usage_month_idx on public.ai_usage (month, at desc);

-- Sensitive actions: who did what, when
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_uid text,
  actor_email text,
  actor_role text,
  details jsonb not null default '{}',
  at timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);

-- WordPress site linked to a project (id = the project id). The password is in wp_site_secrets.
create table public.wp_sites (
  id text primary key,
  project_id text not null,
  site_url text,
  wp_site_url text,
  site_name text,
  username text,
  wp_user jsonb,
  builders jsonb,
  plugin_version text,
  wordpress_version text,
  status text,
  last_error text,
  connected_by text,
  connected_at timestamptz,
  last_checked_at timestamptz
);

-- Encrypted WordPress Application Passwords (server only)
create table public.wp_site_secrets (
  id text primary key,
  app_password text not null,
  updated_at timestamptz not null default now()
);

-- "Fix with AI" proposals (made, applied and undone by the server)
create table public.wp_fixes (
  id text primary key,
  project_id text not null,
  pin_id text not null,
  pin_number integer,
  page_url text,
  post_id bigint,
  page_title text,
  builder text,
  device text,
  kind text,
  status text,
  summary text,
  explanation text,
  reason text,
  model text,
  base_hash text,
  element_id text,
  element_type text,
  settings_json text,
  before_json text,
  find text,
  replace text,
  whole_word boolean,
  site_replace jsonb,
  after_element_id text,
  after_element_type text,
  css text,
  image jsonb,
  media jsonb,
  remaining jsonb,
  -- How the element at the pin looked before (and after) the fix
  page_check jsonb,
  visible_change boolean,
  snapshot_id bigint,
  last_error text,
  proposed_by jsonb,
  proposed_at timestamptz default now(),
  applied_by jsonb,
  applied_at timestamptz,
  reverted_by jsonb,
  reverted_at timestamptz,
  rejected_by jsonb,
  rejected_at timestamptz
);
create index wp_fixes_pin_idx on public.wp_fixes (pin_id);

-- Google Chat webhooks: id 'team' (the team space) or a project id (that project's own space, or off)
create table public.chat_webhooks (
  id text primary key,
  url text,
  off boolean,
  updated_by text,
  updated_at text
);

-- Chrome extension: pending approvals (id = hash of the connect state) and connected extensions (id = hash of the key)
create table public.extension_connect (
  id text primary key,
  key text not null,
  uid text not null,
  browser text,
  expires_at bigint not null
);
create table public.extension_keys (
  id text primary key,
  uid text not null,
  browser text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

-- Monthly AI totals, overall and per project and feature (same shape the AI Credits page used before)
create view public.ai_usage_monthly with (security_invoker = true) as
with base as (
  select month, coalesce(feature, 'other') as feature, coalesce(project_id, 'none') as project_key, project_id,
         input_tokens, output_tokens, cost_usd
  from public.ai_usage
),
totals as (
  select month, count(*)::int as requests, sum(input_tokens)::bigint as input_tokens,
         sum(output_tokens)::bigint as output_tokens, sum(cost_usd) as cost_usd
  from base group by month
),
per_project as (
  select month, jsonb_object_agg(project_key, jsonb_build_object(
           'projectId', project_id, 'requests', n, 'inputTokens', i, 'outputTokens', o, 'costUsd', c)) as projects
  from (select month, project_key, max(project_id) as project_id, count(*) as n, sum(input_tokens) as i,
               sum(output_tokens) as o, sum(cost_usd) as c
        from base group by month, project_key) p
  group by month
),
per_feature as (
  select month, jsonb_object_agg(feature, jsonb_build_object(
           'feature', feature, 'requests', n, 'inputTokens', i, 'outputTokens', o, 'costUsd', c)) as features
  from (select month, feature, count(*) as n, sum(input_tokens) as i, sum(output_tokens) as o, sum(cost_usd) as c
        from base group by month, feature) f
  group by month
)
select t.month, t.requests, t.input_tokens, t.output_tokens, t.cost_usd, p.projects, f.features
from totals t join per_project p using (month) join per_feature f using (month);

-- ---------- Who is calling ----------

-- Guests sign in anonymously; the server puts their one shared project in app_metadata.guest_project
create function public.guest_project() returns text
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'guest_project', '')
$$;

-- The signed-in team member's id (null for guests, removed members and people without a profile)
create function public.current_member_id() returns text
language sql stable security definer set search_path = public as $$
  select u.id from public.users u
  where u.auth_id = auth.uid() and not u.removed and public.guest_project() is null
  limit 1
$$;

create function public.is_member() returns boolean
language sql stable as $$ select public.current_member_id() is not null $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users u where u.id = public.current_member_id() and u.role in ('Owner', 'Admin'))
$$;

create function public.current_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- Team → Roles & Permissions → "Invite teammates" (on unless turned off)
create function public.members_may_invite() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (s.value ->> 'membersCanInvite')::boolean from public.settings s where s.id = 'permissions'), true)
$$;

-- Requests from browsers (signed in or not). The server (service role) and direct SQL are not limited.
create function public.from_browser() returns boolean
language sql stable as $$ select coalesce(auth.role(), '') in ('authenticated', 'anon') $$;

-- Columns that differ between two versions of a row
create function public.changed_columns(old_row jsonb, new_row jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(n.key), '{}') from jsonb_each(new_row) n
  where n.value is distinct from old_row -> n.key
$$;

-- ---------- Rules for changes that depend on which fields change ----------

-- You may edit your own name, photo, status and department; admins may change roles and remove people (never the
-- master admin). Nobody changes their own role or email.
create function public.users_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  changed text[] := public.changed_columns(to_jsonb(old), to_jsonb(new));
begin
  if not public.from_browser() then return new; end if;
  if old.id = public.current_member_id() then
    if changed && array['role', 'removed', 'removed_at', 'email', 'is_master_admin', 'id', 'auth_id'] then
      raise exception 'You can only change your own name, photo, status and department.';
    end if;
  elsif public.is_admin() and not old.is_master_admin then
    if not changed <@ array['role', 'removed', 'removed_at'] then
      raise exception 'Admins can only change a member''s role or remove them.';
    end if;
  else
    raise exception 'Not allowed.';
  end if;
  return new;
end $$;
create trigger users_guard before update on public.users for each row execute function public.users_guard();

-- Guests may only add a page (first pin on a newly browsed page) to their shared project
create function public.projects_guard() returns trigger
language plpgsql as $$
begin
  if public.from_browser() and not public.is_member() then
    if not public.changed_columns(to_jsonb(old), to_jsonb(new)) <@ array['assets', 'updated_at']
       or jsonb_array_length(new.assets) <= jsonb_array_length(old.assets) then
      raise exception 'Guests can only add pages to the shared project.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger projects_guard before update on public.projects for each row execute function public.projects_guard();

-- Guests may comment on pins in their shared project, nothing else
create function public.pins_guard() returns trigger
language plpgsql as $$
begin
  if public.from_browser() and not public.is_member() then
    if not public.changed_columns(to_jsonb(old), to_jsonb(new)) <@ array['comments', 'is_unread', 'updated_at'] then
      raise exception 'Guests can only comment on pins.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger pins_guard before update on public.pins for each row execute function public.pins_guard();

-- Each person may mark their notifications read, nothing else
create function public.notifications_guard() returns trigger
language plpgsql as $$
begin
  if public.from_browser() and not public.changed_columns(to_jsonb(old), to_jsonb(new)) <@ array['read', 'read_at'] then
    raise exception 'Notifications can only be marked as read.';
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications for each row execute function public.notifications_guard();

-- Merge fields into a settings row (the caller's own rights apply)
create function public.settings_merge(p_id text, p_patch jsonb) returns void
language sql security invoker set search_path = public as $$
  insert into public.settings (id, value, updated_at) values (p_id, p_patch, now())
  on conflict (id) do update set value = public.settings.value || excluded.value, updated_at = now()
$$;

-- Daily Google Chat summary: claim the day once, so two servers (or a restart) never send it twice (server only)
create function public.claim_summary_day(p_date text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  claimed boolean;
begin
  insert into public.settings (id, value) values ('chat', '{}') on conflict (id) do nothing;
  update public.settings set value = value || jsonb_build_object('lastSentDate', p_date), updated_at = now()
  where id = 'chat' and coalesce(value ->> 'lastSentDate', '') <> p_date
  returning true into claimed;
  return coalesce(claimed, false);
end $$;
revoke execute on function public.claim_summary_day(text) from public, anon, authenticated;

-- ---------- Row Level Security ----------

alter table public.users enable row level security;
alter table public.invites enable row level security;
alter table public.folders enable row level security;
alter table public.projects enable row level security;
alter table public.pins enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.ai_usage enable row level security;
alter table public.audit_log enable row level security;
alter table public.wp_sites enable row level security;
alter table public.wp_site_secrets enable row level security;
alter table public.wp_fixes enable row level security;
alter table public.chat_webhooks enable row level security;
alter table public.extension_connect enable row level security;
alter table public.extension_keys enable row level security;

-- Team profiles are created by the server; changes are checked by users_guard
create policy "members read the team" on public.users for select to authenticated using (public.is_member());
create policy "members update profiles" on public.users for update to authenticated
  using (public.is_member()) with check (public.is_member());

-- Admins invite with any role; members only as Member when "Invite teammates" is allowed. The inviter (or an admin)
-- can change or cancel it, and a non-admin can't raise it above Member.
create policy "members read invites" on public.invites for select to authenticated using (public.is_member());
create policy "invite" on public.invites for insert to authenticated with check (
  public.is_admin()
  or (public.is_member() and public.members_may_invite() and role = 'Member' and lower(invited_by) = public.current_email())
);
create policy "change own invite" on public.invites for update to authenticated
  using (public.is_admin() or (public.is_member() and lower(invited_by) = public.current_email()))
  with check (public.is_admin() or (public.is_member() and role = 'Member' and lower(invited_by) = public.current_email()));
create policy "cancel own invite" on public.invites for delete to authenticated
  using (public.is_admin() or (public.is_member() and lower(invited_by) = public.current_email()));

create policy "members use folders" on public.folders for all to authenticated
  using (public.is_member()) with check (public.is_member());

create policy "read projects" on public.projects for select to authenticated
  using (public.is_member() or id = public.guest_project());
create policy "members create projects" on public.projects for insert to authenticated with check (public.is_member());
create policy "update projects" on public.projects for update to authenticated
  using (public.is_member() or id = public.guest_project())
  with check (public.is_member() or id = public.guest_project());
create policy "members delete projects" on public.projects for delete to authenticated using (public.is_member());

create policy "read pins" on public.pins for select to authenticated
  using (public.is_member() or project_id = public.guest_project());
create policy "add pins" on public.pins for insert to authenticated
  with check (public.is_member() or project_id = public.guest_project());
create policy "update pins" on public.pins for update to authenticated
  using (public.is_member() or project_id = public.guest_project())
  with check (public.is_member() or project_id = public.guest_project());
create policy "members delete pins" on public.pins for delete to authenticated using (public.is_member());

create policy "read own notifications" on public.notifications for select to authenticated
  using (recipient_uid = public.current_member_id());
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (recipient_uid = public.current_member_id()) with check (recipient_uid = public.current_member_id());
create policy "clear own notifications" on public.notifications for delete to authenticated
  using (recipient_uid = public.current_member_id());

-- App name, logo and allowed domains are shown on the sign-in page and guest links, so anyone may read them;
-- members read the permission matrix; admins change all three
create policy "read settings" on public.settings for select to anon, authenticated
  using (id in ('access', 'branding') or (id = 'permissions' and public.is_member()));
create policy "admins add settings" on public.settings for insert to authenticated
  with check (public.is_admin() and id in ('access', 'branding', 'permissions'));
create policy "admins change settings" on public.settings for update to authenticated
  using (public.is_admin() and id in ('access', 'branding', 'permissions'))
  with check (public.is_admin() and id in ('access', 'branding', 'permissions'));

create policy "admins read AI usage" on public.ai_usage for select to authenticated using (public.is_admin());
create policy "admins read the audit log" on public.audit_log for select to authenticated using (public.is_admin());
create policy "members read WordPress sites" on public.wp_sites for select to authenticated using (public.is_member());
create policy "members read AI fixes" on public.wp_fixes for select to authenticated using (public.is_member());
-- wp_site_secrets, chat_webhooks, extension_connect, extension_keys: no policies, so only the server can use them

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.settings to anon;
grant select on public.ai_usage_monthly to authenticated;
grant all on all tables in schema public to service_role;

-- ---------- Live updates (Supabase Realtime) ----------

-- Full old rows, so deletes and filtered subscriptions (a guest's project, a person's notifications) work
alter table public.pins replica identity full;
alter table public.notifications replica identity full;
alter table public.wp_fixes replica identity full;

alter publication supabase_realtime add table
  public.users, public.invites, public.folders, public.projects, public.pins, public.notifications,
  public.settings, public.ai_usage, public.wp_sites, public.wp_fixes;

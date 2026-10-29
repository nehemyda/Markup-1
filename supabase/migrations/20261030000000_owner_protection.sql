-- Only an Owner can change an Owner (role, removal) or make someone an Owner, directly or through an invite.
-- Before this, any Admin could remove or demote an Owner (except the master admin) or promote anyone to Owner.

create function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users u where u.id = public.current_member_id() and u.role = 'Owner')
$$;

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
    if (old.role = 'Owner' or new.role = 'Owner') and changed && array['role', 'removed', 'removed_at'] and not public.is_owner() then
      raise exception 'Only an Owner can change an Owner or make someone an Owner.';
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

drop policy "invite" on public.invites;
create policy "invite" on public.invites for insert to authenticated with check (
  (public.is_admin() and (role <> 'Owner' or public.is_owner()))
  or (public.is_member() and public.members_may_invite() and role = 'Member' and lower(invited_by) = public.current_email())
);
drop policy "change own invite" on public.invites;
create policy "change own invite" on public.invites for update to authenticated
  using (public.is_admin() or (public.is_member() and lower(invited_by) = public.current_email()))
  with check (
    (public.is_admin() and (role <> 'Owner' or public.is_owner()))
    or (public.is_member() and role = 'Member' and lower(invited_by) = public.current_email())
  );

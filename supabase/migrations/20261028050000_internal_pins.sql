-- Internal pins: pins the team adds (QA, AI review) are for the team only. Guests on the review link only see and
-- receive the client's pins; the database enforces it, so internal pins never reach a guest's browser.

alter table public.pins add column internal boolean not null default false;

-- Existing pins: the team's are internal, the client's (guest authors) are not
update public.pins
  set internal = not (coalesce(author->>'role', '') = 'Guest' or coalesce(author->>'id', '') like 'guest\_%');

-- The next pin number in a project, counting the pins a guest can't see (so a client's pin never repeats a number)
create function public.next_pin_number(p_project text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(max(number), 0) + 1 from public.pins where project_id = p_project;
$$;
revoke all on function public.next_pin_number(text) from public, anon;
grant execute on function public.next_pin_number(text) to authenticated, service_role;

-- New rows from browsers: pins start unsubmitted; a member's pin is internal; a guest's pin gets the next number
create or replace function public.new_row_defaults() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.from_browser() then
    if tg_table_name = 'pins' then
      new.revision := null;
      new.internal := public.is_member();
      if not new.internal then
        new.number := public.next_pin_number(new.project_id);
      end if;
    elsif tg_table_name = 'projects' then
      new.review_state := 'open';
      new.revision_count := 0;
    end if;
  end if;
  return new;
end $$;

-- Whether a pin is internal is set when it is added, not changed afterwards from a browser
create or replace function public.pins_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.from_browser() then
    new.revision := old.revision;
    new.internal := old.internal;
    if not public.is_member() then
      if not public.changed_columns(to_jsonb(old), to_jsonb(new)) <@ array['comments', 'is_unread', 'updated_at'] then
        raise exception 'Guests can only comment on pins.';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop policy "read pins" on public.pins;
create policy "read pins" on public.pins for select to authenticated
  using (public.is_member() or (project_id = public.guest_project() and not internal));

drop policy "update pins" on public.pins;
create policy "update pins" on public.pins for update to authenticated
  using (public.is_member() or (project_id = public.guest_project() and not internal and public.project_is_open(project_id)))
  with check (public.is_member() or (project_id = public.guest_project() and not internal and public.project_is_open(project_id)));

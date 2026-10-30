-- Guest review links use a random share code (/review/<uuid>) instead of the project id, which is a timestamp and
-- can be guessed. The server gives a guest pass only for a project's current code; resetting the code (server only)
-- makes old links stop working. Browsers can neither choose nor change it.
alter table public.projects add column share_token uuid not null default gen_random_uuid();
create unique index projects_share_token_unique on public.projects (share_token);

create or replace function public.projects_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.from_browser() then
    new.review_state := old.review_state;
    new.revision_count := old.revision_count;
    new.unsent_reminded_at := old.unsent_reminded_at;
    new.preview_url := old.preview_url;
    new.preview_at := old.preview_at;
    new.preview_error := old.preview_error;
    new.share_token := old.share_token;
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
      new.share_token := gen_random_uuid();
    end if;
  end if;
  return new;
end $$;

-- A guest's pass names the project and the share code it was given for. It counts only while that is still the
-- project's code, so resetting the code locks out everyone holding the old link (passes from before share codes
-- have no code and stop working too). Security definer: it reads the project without the policies that call it.
create or replace function public.guest_project() returns text
language sql stable security definer set search_path = public as $$
  select p.id from public.projects p
  where p.id = nullif(auth.jwt() -> 'app_metadata' ->> 'guest_project', '')
    and p.share_token::text = auth.jwt() -> 'app_metadata' ->> 'guest_share'
$$;

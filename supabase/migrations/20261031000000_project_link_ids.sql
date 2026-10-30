-- Team links to a project (/projects/<id>) use a random link id instead of the project id, which is a timestamp.
-- Unlike the share code it opens nothing by itself: team members still need to sign in. Old /projects/proj_... links
-- keep working for members. A new project's browser picks its link id (so it can open the project straight away);
-- after that browsers cannot change it.
alter table public.projects add column link_id uuid not null default gen_random_uuid();
create unique index projects_link_id_unique on public.projects (link_id);

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
    new.link_id := old.link_id;
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

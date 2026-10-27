-- Project card previews: a screenshot of the project's main page taken by the server's Chrome (server/previews.ts),
-- refreshed about once a day. Set by the server only.
alter table public.projects add column preview_url text;
alter table public.projects add column preview_at timestamptz;
alter table public.projects add column preview_error text;

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

-- Supabase security advisor: functions should run with a fixed search_path, so a table or function of the same
-- name in another schema can't be used in their place.
alter function public.guest_project() set search_path = public;
alter function public.is_member() set search_path = public;
alter function public.current_email() set search_path = public;
alter function public.from_browser() set search_path = public;
alter function public.changed_columns(jsonb, jsonb) set search_path = public;
alter function public.projects_guard() set search_path = public;
alter function public.pins_guard() set search_path = public;
alter function public.notifications_guard() set search_path = public;

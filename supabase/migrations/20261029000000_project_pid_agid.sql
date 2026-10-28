-- New projects need a PID (the folder, e.g. PRBS) and an AGID (e.g. AG-V44J288MWV).
-- The AGID is the project's own; one PID holds many projects, so folder names must never repeat.

alter table public.projects add column agid text;

create unique index folders_name_unique on public.folders (lower(btrim(name)));

-- Run this once if mart360_workspaces was created from the earlier schema.sql.
-- A revision counter detects stale saves from another tab or device.
alter table public.mart360_workspaces
  add column if not exists revision bigint not null default 0;

alter table public.mart360_workspaces
  drop constraint if exists mart360_workspaces_revision_check;

alter table public.mart360_workspaces
  add constraint mart360_workspaces_revision_check check (revision >= 0);

-- Enable live workspace updates for signed-in owners.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mart360_workspaces'
  ) then
    alter publication supabase_realtime add table public.mart360_workspaces;
  end if;
end;
$$;

-- Mart360 single-owner multi-workspace storage.
-- Run in the Supabase project selected by the store owner.
create table if not exists public.mart360_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mart360_workspaces enable row level security;
revoke all on public.mart360_workspaces from anon;
grant select, insert, update, delete on public.mart360_workspaces to authenticated;

drop policy if exists "owners read own Mart360 workspaces" on public.mart360_workspaces;
create policy "owners read own Mart360 workspaces"
  on public.mart360_workspaces for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "owners create own Mart360 workspaces" on public.mart360_workspaces;
create policy "owners create own Mart360 workspaces"
  on public.mart360_workspaces for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owners update own Mart360 workspaces" on public.mart360_workspaces;
create policy "owners update own Mart360 workspaces"
  on public.mart360_workspaces for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owners delete own Mart360 workspaces" on public.mart360_workspaces;
create policy "owners delete own Mart360 workspaces"
  on public.mart360_workspaces for delete to authenticated
  using ((select auth.uid()) = owner_id);

create index if not exists mart360_workspaces_owner_idx
  on public.mart360_workspaces (owner_id, created_at);

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

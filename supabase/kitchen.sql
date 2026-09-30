create table if not exists public.kitchen_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create unique index if not exists kitchen_items_user_name_idx
  on public.kitchen_items (user_id, lower(trim(name)));

alter table public.kitchen_items enable row level security;

revoke all on table public.kitchen_items from anon;
grant select, insert, delete on table public.kitchen_items to authenticated;

drop policy if exists "Users can read own kitchen items" on public.kitchen_items;
create policy "Users can read own kitchen items" on public.kitchen_items
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own kitchen items" on public.kitchen_items;
create policy "Users can add own kitchen items" on public.kitchen_items
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own kitchen items" on public.kitchen_items;
create policy "Users can delete own kitchen items" on public.kitchen_items
for delete to authenticated using ((select auth.uid()) = user_id);

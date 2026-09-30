create table if not exists public.saved_recipes (
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id text not null,
  meal_name text not null,
  meal_thumb text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, meal_id)
);

alter table public.saved_recipes enable row level security;

revoke all on table public.saved_recipes from anon;
grant select, insert, update, delete on table public.saved_recipes to authenticated;

create policy "Users can read own saved recipes" on public.saved_recipes
for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users can save own recipes" on public.saved_recipes
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users can update own saved recipes" on public.saved_recipes
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users can delete own saved recipes" on public.saved_recipes
for delete to authenticated using ((select auth.uid()) = user_id);

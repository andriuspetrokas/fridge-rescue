create table if not exists public.saved_ai_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id text not null,
  original_meal_name text not null,
  user_request text not null,
  ai_result text not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_ai_recipes_user_created_idx
  on public.saved_ai_recipes (user_id, created_at desc);

alter table public.saved_ai_recipes enable row level security;

revoke all on table public.saved_ai_recipes from anon;
grant select, insert, delete on table public.saved_ai_recipes to authenticated;

drop policy if exists "Users can read own AI recipes" on public.saved_ai_recipes;
create policy "Users can read own AI recipes" on public.saved_ai_recipes
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can save own AI recipes" on public.saved_ai_recipes;
create policy "Users can save own AI recipes" on public.saved_ai_recipes
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own AI recipes" on public.saved_ai_recipes;
create policy "Users can delete own AI recipes" on public.saved_ai_recipes
for delete to authenticated using ((select auth.uid()) = user_id);

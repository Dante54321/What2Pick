create table if not exists public.user_bracket_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  choices jsonb not null default '[]'::jsonb,
  bracket_started boolean not null default false,
  winner_by_match_id jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{"darkMode": true}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_bracket_states enable row level security;

drop policy if exists "Users can read their own bracket state"
  on public.user_bracket_states;

create policy "Users can read their own bracket state"
  on public.user_bracket_states
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own bracket state"
  on public.user_bracket_states;

create policy "Users can insert their own bracket state"
  on public.user_bracket_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own bracket state"
  on public.user_bracket_states;

create policy "Users can update their own bracket state"
  on public.user_bracket_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.choice_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  choice_names jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists choice_templates_user_name_unique
  on public.choice_templates (user_id, lower(name));

alter table public.choice_templates enable row level security;

drop policy if exists "Users can read their own choice templates"
  on public.choice_templates;

create policy "Users can read their own choice templates"
  on public.choice_templates
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own choice templates"
  on public.choice_templates;

create policy "Users can insert their own choice templates"
  on public.choice_templates
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own choice templates"
  on public.choice_templates;

create policy "Users can update their own choice templates"
  on public.choice_templates
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own choice templates"
  on public.choice_templates;

create policy "Users can delete their own choice templates"
  on public.choice_templates
  for delete
  using (auth.uid() = user_id);

create table if not exists public.saved_brackets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  choices jsonb not null default '[]'::jsonb,
  bracket_started boolean not null default false,
  winner_by_match_id jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saved_brackets_user_name_unique
  on public.saved_brackets (user_id, lower(name));

alter table public.saved_brackets enable row level security;

drop policy if exists "Users can read their own saved brackets"
  on public.saved_brackets;

create policy "Users can read their own saved brackets"
  on public.saved_brackets
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own saved brackets"
  on public.saved_brackets;

create policy "Users can insert their own saved brackets"
  on public.saved_brackets
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own saved brackets"
  on public.saved_brackets;

create policy "Users can update their own saved brackets"
  on public.saved_brackets
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved brackets"
  on public.saved_brackets;

create policy "Users can delete their own saved brackets"
  on public.saved_brackets
  for delete
  using (auth.uid() = user_id);

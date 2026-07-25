create table if not exists public.user_bracket_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  choices jsonb not null default '[]'::jsonb,
  bracket_started boolean not null default false,
  winner_by_match_id jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{"darkMode": true}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_bracket_states enable row level security;

create policy "Users can read their own bracket state"
  on public.user_bracket_states
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own bracket state"
  on public.user_bracket_states
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own bracket state"
  on public.user_bracket_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

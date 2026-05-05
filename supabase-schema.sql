create table if not exists public.players (
  id text primary key,
  name text not null,
  note text default '',
  created_at timestamptz not null default now()
);

create unique index if not exists players_name_unique
on public.players (lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

create table if not exists public.app_users (
  device_id text primary key,
  full_name text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.custom_presets (
  id text primary key,
  name text not null,
  description text default 'Custom game',
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists custom_presets_name_unique
on public.custom_presets (lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

create unique index if not exists custom_presets_rules_unique
on public.custom_presets (md5((config - 'presetId' - 'playerName')::text));

create table if not exists public.results (
  id text primary key,
  date timestamptz not null,
  player text not null,
  mode text not null,
  preset_id text,
  preset_name text,
  leaderboard_eligible boolean not null default false,
  hits integer not null default 0,
  misses integer not null default 0,
  false_hits integer not null default 0,
  accuracy text,
  avg_reaction text,
  best_reaction text,
  total_time text,
  config jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;
alter table public.app_users enable row level security;
alter table public.custom_presets enable row level security;
alter table public.results enable row level security;

create policy "players can be read by everyone"
on public.players for select
using (true);

create policy "players can be inserted by everyone"
on public.players for insert
with check (true);

create policy "players can be updated by everyone"
on public.players for update
using (true)
with check (true);

create policy "app users can be inserted by everyone"
on public.app_users for insert
with check (true);

create policy "app users can be updated by everyone"
on public.app_users for update
using (true)
with check (true);

create policy "custom presets can be read by everyone"
on public.custom_presets for select
using (true);

create policy "custom presets can be inserted by everyone"
on public.custom_presets for insert
with check (true);

create policy "custom presets can be updated by everyone"
on public.custom_presets for update
using (true)
with check (true);

create policy "custom presets can be deleted by everyone"
on public.custom_presets for delete
using (true);

create policy "results can be read by everyone"
on public.results for select
using (true);

create policy "results can be inserted by everyone"
on public.results for insert
with check (true);

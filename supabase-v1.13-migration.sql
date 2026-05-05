create table if not exists public.app_users (
  device_id text primary key,
  full_name text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.app_users enable row level security;

drop policy if exists "app users can be inserted by everyone" on public.app_users;
create policy "app users can be inserted by everyone"
on public.app_users for insert
with check (true);

drop policy if exists "app users can be updated by everyone" on public.app_users;
create policy "app users can be updated by everyone"
on public.app_users for update
using (true)
with check (true);

create unique index if not exists custom_presets_name_unique
on public.custom_presets (lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

create unique index if not exists custom_presets_rules_unique
on public.custom_presets (md5((config - 'presetId' - 'playerName')::text));

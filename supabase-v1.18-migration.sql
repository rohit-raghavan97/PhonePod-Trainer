create or replace function public.get_reflex_admin_summary()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'registeredUsers', (select count(*) from public.app_users),
    'recentUsers', (select count(*) from public.app_users where last_seen_at >= now() - interval '7 days'),
    'lastSeen', (select max(last_seen_at) from public.app_users)
  );
$$;

grant execute on function public.get_reflex_admin_summary() to anon;
grant execute on function public.get_reflex_admin_summary() to authenticated;

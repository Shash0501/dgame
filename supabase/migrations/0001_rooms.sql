-- Room state is owned by the `room` Edge Function (service role).
-- RLS is enabled with no policies, so the anon/authenticated roles can't read
-- or write this table directly; this keeps private votes private.
create table public.rooms (
  code        text primary key check (code ~ '^[A-Z0-9]{5}$'),
  state       jsonb       not null,
  version     integer     not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '6 hours'
);

alter table public.rooms enable row level security;

create index rooms_expires_at_idx on public.rooms (expires_at);

-- Retention: call this on a schedule (e.g. pg_cron: select cron.schedule(
-- 'cleanup-rooms', '*/15 * * * *', 'select public.cleanup_expired_rooms()')).
create function public.cleanup_expired_rooms() returns integer
language sql security definer set search_path = public as $$
  with d as (delete from public.rooms where expires_at < now() returning 1)
  select count(*)::integer from d;
$$;
revoke all on function public.cleanup_expired_rooms() from public, anon, authenticated;

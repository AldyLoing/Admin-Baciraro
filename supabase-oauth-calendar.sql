-- =============================================
-- CALENDAR_TOKENS (Google OAuth2 tokens per admin)
-- Adaptasi dari ORDERS, user_id = team_members.id (integer),
-- karena Baciraro memakai custom JWT auth, bukan Supabase Auth.
-- =============================================
create table if not exists public.calendar_tokens (
  id bigint primary key generated always as identity,
  user_id integer not null references public.team_members (id) on delete cascade,
  access_token text,
  refresh_token text,
  expiry_at timestamptz,
  google_email text,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- Akses lewat service key (server), jadi RLS cukup dibuka untuk admin
alter table public.calendar_tokens enable row level security;

drop policy if exists "calendar_tokens admin all" on public.calendar_tokens;
create policy "calendar_tokens admin all"
  on public.calendar_tokens
  for all
  using (true)
  with check (true);
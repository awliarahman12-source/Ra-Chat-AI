-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste this → Run).
--
-- Stores each signed-in user's chats, providers, and settings as a single
-- JSON blob, mirroring exactly what used to live in localStorage. Row Level
-- Security ensures a user can only ever read/write their own row.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users can view their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id);

-- Maps a chosen username to the underlying Supabase Auth user, so people can
-- sign in with "username + passcode" instead of typing an email every time.
-- The real email stays private — it's only ever read server-side (via the
-- service_role key in /api/auth-*.ts) to resolve login and password-reset
-- requests. Client code can only ever see its OWN row here.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- No insert/update policy for anon/authenticated roles on purpose: rows are
-- only ever written by /api/auth-register.ts using the service_role key,
-- which bypasses RLS entirely. This keeps username registration centralized
-- and prevents anyone from renaming or claiming a username directly.

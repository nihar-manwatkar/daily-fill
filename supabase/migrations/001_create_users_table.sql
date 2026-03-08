-- DailyFill users table (email OTP auth, no password)
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query

create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  username text unique not null,
  registered_at timestamptz default now()
);

create index if not exists users_email_idx on public.users (email);
create index if not exists users_username_lower_idx on public.users (lower(username));

alter table public.users enable row level security;

create policy "Allow insert for signup"
  on public.users for insert
  to anon
  with check (true);

create policy "Allow select for auth"
  on public.users for select
  to anon
  using (true);

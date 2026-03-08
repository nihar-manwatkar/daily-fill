-- DailyFill — Profiles (linked to auth.users) + Scores for leaderboard
-- Run in Supabase SQL Editor after 001_create_users_table.sql (or standalone)

-- Profiles: id = auth.users.id, stores username and email for display
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text unique not null,
  created_at timestamptz default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Auto-create profile when auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: Anyone can read profiles (for leaderboard display names)
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Users can update their own profile (username)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Scores: one row per completed game
create table if not exists public.scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  puzzle_date text not null,
  score int not null,
  completed_correct boolean default false,
  created_at timestamptz default now(),
  unique(user_id, puzzle_date)
);

create index if not exists scores_puzzle_date_idx on public.scores (puzzle_date);
create index if not exists scores_user_date_idx on public.scores (user_id, puzzle_date);

alter table public.scores enable row level security;

-- Users can insert their own scores
create policy "Users can insert own scores"
  on public.scores for insert
  with check (auth.uid() = user_id);

-- Anyone can read scores (for leaderboard)
create policy "Scores are viewable by everyone"
  on public.scores for select
  using (true);

-- RPC: Check if email exists (for auth flow - anon can call)
create or replace function public.check_email_exists(check_email text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from auth.users where auth.users.email = lower(trim(check_email))
  );
end;
$$;

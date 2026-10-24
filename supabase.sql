-- CineHub: run this whole file once in Supabase > SQL Editor

create extension if not exists "pgcrypto";

-- 1) Profiles (one row per email account) ---------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 2) Plugins (installed from the admin panel, auto-delivered to every user) -
create table if not exists public.plugins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  version text not null default '1.0.0',
  kind text not null check (kind in ('stream','catalog')),
  -- stream  = gives stream links for a TMDB title (Movies / TV Shows)
  -- catalog = gives its own lists + links (Sports / News)
  categories text[] not null default '{movies}',
  priority int not null default 100,          -- lower number = asked first
  timeout_ms int not null default 8000,
  code text not null,                          -- the plugin JavaScript
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Per-user data ---------------------------------------------------------
create table if not exists public.watch_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie','tv')),
  season int not null default 0,
  episode int not null default 0,
  progress_seconds int not null default 0,
  duration_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type, season, episode)
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie','tv')),
  created_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

-- 4) Security (Row Level Security) -----------------------------------------
alter table public.profiles      enable row level security;
alter table public.plugins       enable row level security;
alter table public.watch_history enable row level security;
alter table public.favorites     enable row level security;

-- profiles: see/edit only your own row, and you can never change your own role
create policy "profile read own"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profile update own" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "profile admin all"  on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- plugins: logged-in users can read enabled ones, only admins can change anything
create policy "plugins read enabled" on public.plugins for select to authenticated using (enabled = true or public.is_admin());
create policy "plugins admin write"  on public.plugins for all using (public.is_admin()) with check (public.is_admin());

-- history + favorites: each user only touches their own rows
create policy "history own"   on public.watch_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "favorites own" on public.favorites     for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5) Make yourself admin: sign up in the app first, then run this with your email
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';

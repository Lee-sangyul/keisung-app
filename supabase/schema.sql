-- Run in Supabase SQL Editor. Never expose service role key to the browser.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9._-]{3,32}$'),
 display_name text not null check(char_length(display_name) between 1 and 60),
 role text not null default 'student' check(role in ('student','teacher','admin','superadmin')),
 grade integer check(grade between 1 and 6),
 class_number integer check(class_number between 1 and 30),
 student_number integer check(student_number between 1 and 50),
 must_change_password boolean not null default true,
 disabled boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
-- No direct insert/update/delete policies: server-only service role provisions and edits.
create index if not exists profiles_role_idx on public.profiles(role);
-- BOOTSTRAP ONLY: Create the initial user using Supabase Auth admin UI (email = admin@login.keisung-app.example),
-- then run the following SQL with the real user UUID substituted (do NOT commit real identifiers).
-- insert into public.profiles(id, username, display_name, role, must_change_password)
-- values ('REPLACE_WITH_AUTH_USER_UUID', 'admin', '시스템 관리자', 'superadmin', true);

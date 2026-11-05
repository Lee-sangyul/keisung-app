-- Keisung Smart MVP: safe to rerun. Run after supabase/schema.sql.
-- Existing accounts are preserved.
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 150),
 body text not null check (char_length(body) between 1 and 10000),
 audience text not null default 'all' check (audience in ('all','student','teacher')),
 pinned boolean not null default false,
 published boolean not null default true,
 author_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists announcements_created_at_idx on public.announcements(pinned desc, created_at desc);
alter table public.announcements enable row level security;
-- No direct client access: all access via server endpoints that check live profiles and role.
revoke all on public.announcements from anon, authenticated;
create table if not exists public.admin_audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id),
 target_id uuid not null references auth.users(id),
 action text not null check(action in ('create_account','disable','enable','reset_password')),
 created_at timestamptz not null default now()
);
alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from anon, authenticated;
create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);

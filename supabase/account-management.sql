-- Run once in Supabase SQL Editor before enabling v0.2 account management.
create table if not exists public.admin_audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id),
 target_id uuid not null references auth.users(id),
 action text not null check(action in ('create_account','disable','enable','reset_password')),
 created_at timestamptz not null default now()
);
alter table public.admin_audit_logs enable row level security;
-- Only server-side service role writes/reads audit logs. No client-facing policies.
revoke all on public.admin_audit_logs from anon, authenticated;
create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);

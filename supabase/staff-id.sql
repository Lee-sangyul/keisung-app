-- Keisung Smart: DEV-ONLY staff credential QR. Existing accounts stay untouched.
-- Apply in Supabase SQL Editor after supabase/schema.sql.
create table if not exists public.staff_id_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists staff_id_challenges_user_idx
  on public.staff_id_challenges(user_id,created_at desc);
create index if not exists staff_id_challenges_expiry_idx
  on public.staff_id_challenges(expires_at);
alter table public.staff_id_challenges enable row level security;
revoke all on public.staff_id_challenges from anon, authenticated;

-- A single atomic UPDATE consumes the token. Concurrent reuse returns no rows.
create or replace function public.consume_staff_id_challenge(p_hash text)
returns table(verified_user_id uuid)
language sql
security invoker
set search_path = ''
as $$
  update public.staff_id_challenges c
  set consumed_at = now()
  where c.token_hash = p_hash
    and c.consumed_at is null
    and c.expires_at > now()
  returning c.user_id as verified_user_id;
$$;
revoke all on function public.consume_staff_id_challenge(text) from public, anon, authenticated;
grant execute on function public.consume_staff_id_challenge(text) to service_role;

-- Audit only successful staff verifications; keep access server-side.
create table if not exists public.staff_id_verifications (
  id bigint generated always as identity primary key,
  verifier_id uuid not null references auth.users(id),
  staff_id uuid not null references auth.users(id),
  verified_at timestamptz not null default now()
);
create index if not exists staff_id_verifications_date_idx on public.staff_id_verifications(verified_at desc);
alter table public.staff_id_verifications enable row level security;
revoke all on public.staff_id_verifications from anon, authenticated;
-- Add scheduled retention cleanup and verifier MFA before any real school deployment.

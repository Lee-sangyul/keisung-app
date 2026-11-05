-- Development-only electronic student ID verification. Run after schema.sql.
-- Keep STUDENT_ID_ENABLED=false until school formally approves real issuance.
create table if not exists public.student_id_challenges (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists student_id_challenges_user_idx
 on public.student_id_challenges(user_id, created_at desc);
create index if not exists student_id_challenges_expiry_idx
 on public.student_id_challenges(expires_at);
alter table public.student_id_challenges enable row level security;
revoke all on public.student_id_challenges from anon,authenticated;
-- Must be atomic: first valid scan wins, all later scans are rejected.
-- Locking in UPDATE ensures two concurrent verifiers cannot both succeed.
create or replace function public.consume_student_id_challenge(p_hash text)
returns table(verified_user_id uuid)
language sql security invoker
set search_path = ''
as $$
 update public.student_id_challenges c
 set consumed_at=now()
 where c.token_hash=p_hash
   and c.consumed_at is null
   and c.expires_at>now()
 returning c.user_id as verified_user_id;
$$;
revoke all on function public.consume_student_id_challenge(text) from public,anon,authenticated;
grant execute on function public.consume_student_id_challenge(text) to service_role;
-- Maintenance: periodically delete expired challenges via a trusted server job,
-- or run DELETE FROM public.student_id_challenges WHERE expires_at < now()-interval '1 day';

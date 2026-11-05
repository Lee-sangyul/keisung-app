-- Development-only PWA Web Push subscription and delivery log.
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth_key text not null,
 created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create table if not exists public.push_campaigns (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 title text not null,
 message text not null,
 audience text not null,
 grade integer,
 class_number integer,
 recipient_count integer not null default 0,
 sent_count integer not null default 0,
 failed_count integer not null default 0,
 created_at timestamptz not null default now()
);
create index if not exists push_campaigns_created_idx on public.push_campaigns(created_at desc);
alter table public.push_subscriptions enable row level security;
alter table public.push_campaigns enable row level security;
revoke all on public.push_subscriptions,public.push_campaigns from anon,authenticated;
create or replace function public.list_push_recipients(p_audience text,p_grade integer,p_class integer)
returns table(id uuid,endpoint text,p256dh text,auth_key text)
language sql security invoker set search_path=''
as $$
 select s.id,s.endpoint,s.p256dh,s.auth_key
 from public.push_subscriptions s
 join public.profiles p on p.id=s.user_id
 where not p.disabled and not p.must_change_password
 and (
  p_audience='all'
  or (p_audience='student' and p.role='student')
  or (p_audience='teacher' and p.role in ('teacher','admin','superadmin'))
 )
 and (p_grade is null or (p.role='student' and p.grade=p_grade))
 and (p_class is null or (p.role='student' and p.class_number=p_class))
 order by s.created_at desc
 limit 1001;
$$;
revoke all on function public.list_push_recipients(text,integer,integer) from public,anon,authenticated;
grant execute on function public.list_push_recipients(text,integer,integer) to service_role;

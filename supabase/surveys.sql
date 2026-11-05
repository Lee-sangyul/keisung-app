-- DEV-ONLY survey center. Run after schema.sql. Do not store real student data without approval.
create table if not exists public.surveys (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 120),
 question text not null check (char_length(question) between 1 and 500),
 options jsonb not null check (jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6),
 audience text not null default 'student' check (audience in ('student','teacher','all')),
 closes_at timestamptz not null,
 closed boolean not null default false,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists surveys_created_idx on public.surveys(created_at desc);
create table if not exists public.survey_participation (
 survey_id uuid not null references public.surveys(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 participated_at timestamptz not null default now(),
 primary key (survey_id, user_id)
);
create table if not exists public.survey_votes (
 id bigint generated always as identity primary key,
 survey_id uuid not null references public.surveys(id) on delete cascade,
 option_index integer not null check (option_index between 0 and 5)
);
create index if not exists survey_votes_survey_idx on public.survey_votes(survey_id,option_index);
alter table public.surveys enable row level security;
alter table public.survey_participation enable row level security;
alter table public.survey_votes enable row level security;
revoke all on public.surveys,public.survey_participation,public.survey_votes from anon,authenticated;
-- Atomic insertion: a unique participation row controls one vote per user.
-- Votes contain only an option index; participation does not contain selected options.
create or replace function public.cast_survey_vote(p_survey uuid,p_user uuid,p_option integer)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare s public.surveys%rowtype;
begin
 select * into s from public.surveys where id=p_survey for update;
 if not found or s.closed or s.closes_at <= now() then return false; end if;
 if p_option < 0 or p_option >= jsonb_array_length(s.options) then return false; end if;
 if exists(select 1 from public.survey_participation where survey_id=p_survey and user_id=p_user) then return false; end if;
 insert into public.survey_participation(survey_id,user_id) values(p_survey,p_user);
 insert into public.survey_votes(survey_id,option_index) values(p_survey,p_option);
 return true;
end;
$$;
revoke all on function public.cast_survey_vote(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.cast_survey_vote(uuid,uuid,integer) to service_role;
create or replace function public.survey_count_results(p_ids uuid[])
returns table(survey_id uuid,option_index integer,vote_count bigint)
language sql security invoker set search_path = ''
as $$
 select v.survey_id,v.option_index,count(*) as vote_count
 from public.survey_votes v
 where v.survey_id=any(p_ids)
 group by v.survey_id,v.option_index;
$$;
revoke all on function public.survey_count_results(uuid[]) from public,anon,authenticated;
grant execute on function public.survey_count_results(uuid[]) to service_role;

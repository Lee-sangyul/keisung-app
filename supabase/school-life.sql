-- Keisung App v0.8: development-only Lost & Found + personal student timetable.
-- Run after supabase/schema.sql. Existing accounts and tables stay intact.
-- Actual student data requires school approval and an access/retention policy.

create table if not exists public.lost_found_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check(char_length(title) between 1 and 100),
  description text not null default '' check(char_length(description) <= 1000),
  found_location text not null check(char_length(found_location) between 1 and 120),
  found_date date not null default current_date,
  image_path text,
  status text not null default 'available' check(status in ('available','returned')),
  registered_by uuid not null references auth.users(id),
  returned_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lost_found_items_created_idx on public.lost_found_items(created_at desc);
alter table public.lost_found_items enable row level security;
revoke all on public.lost_found_items from anon,authenticated;

-- Images are private; signed read URLs are generated only after checking app login.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('keisung-lost-found','keisung-lost-found',false,3145728,
 array['image/jpeg','image/png','image/webp'])
on conflict(id) do update
 set public=false, file_size_limit=3145728,
     allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create table if not exists public.personal_timetable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday integer not null check(weekday between 1 and 5),
  start_period integer not null check(start_period between 1 and 8),
  end_period integer not null check(end_period between 1 and 8 and end_period>=start_period),
  subject text not null check(char_length(subject) between 1 and 50),
  room text not null default '' check(char_length(room) <= 60),
  teacher text not null default '' check(char_length(teacher) <= 60),
  color text not null default '#DBEAFE'
    check(color in ('#DBEAFE','#FCE7F3','#D1FAE5','#FEF3C7','#EDE9FE','#FFEDD5','#CFFAFE','#E5E7EB')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists personal_timetable_owner_idx on public.personal_timetable(user_id,weekday,start_period);
alter table public.personal_timetable enable row level security;
revoke all on public.personal_timetable from anon,authenticated;

-- Save/update timetable entries atomically and reject overlapping periods.
-- Only service_role may execute; the API authenticates the student first.
create or replace function public.save_personal_timetable(
  p_user uuid, p_id uuid, p_weekday integer,
  p_start integer, p_end integer, p_subject text,
  p_room text, p_teacher text, p_color text
) returns uuid
language plpgsql security invoker set search_path=''
as $$
declare saved_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user::text)::bigint);
  if not exists(select 1 from public.profiles
     where id=p_user and role='student' and disabled=false and must_change_password=false)
  then raise exception 'Not an active student'; end if;
  if p_weekday not between 1 and 5 or p_start not between 1 and 8
    or p_end not between p_start and 8
    or char_length(p_subject) not between 1 and 50
    or char_length(p_room)>60 or char_length(p_teacher)>60
    or p_color not in ('#DBEAFE','#FCE7F3','#D1FAE5','#FEF3C7','#EDE9FE','#FFEDD5','#CFFAFE','#E5E7EB')
  then raise exception 'Invalid timetable input'; end if;
  if p_id is not null and not exists(
      select 1 from public.personal_timetable where id=p_id and user_id=p_user
    ) then raise exception 'Entry not found'; end if;
  if exists(select 1 from public.personal_timetable t
    where t.user_id=p_user and t.weekday=p_weekday and (p_id is null or t.id<>p_id)
      and t.start_period<=p_end and t.end_period>=p_start)
  then raise exception 'Timetable period overlap'; end if;
  if p_id is null then
    insert into public.personal_timetable
      (user_id,weekday,start_period,end_period,subject,room,teacher,color)
    values(p_user,p_weekday,p_start,p_end,p_subject,p_room,p_teacher,p_color)
    returning id into saved_id;
  else
    update public.personal_timetable set weekday=p_weekday,
      start_period=p_start,end_period=p_end,subject=p_subject,
      room=p_room,teacher=p_teacher,color=p_color,updated_at=now()
    where id=p_id and user_id=p_user returning id into saved_id;
  end if;
  return saved_id;
end;
$$;
revoke all on function public.save_personal_timetable(uuid,uuid,integer,integer,integer,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.save_personal_timetable(uuid,uuid,integer,integer,integer,text,text,text,text)
  to service_role;

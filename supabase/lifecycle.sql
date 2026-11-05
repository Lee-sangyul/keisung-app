-- DEV-ONLY academic year transition. Review carefully; changes student profiles when invoked.
-- Run AFTER supabase/schema.sql. Never run real student data without school approval.
alter table public.profiles add column if not exists graduated_at timestamptz;
create table if not exists public.student_lifecycle_batches (
 id uuid primary key default gen_random_uuid(),
 target_year integer not null check(target_year between 2026 and 2100),
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 rolled_back_at timestamptz,
 rollback_actor_id uuid references auth.users(id)
);
create unique index if not exists student_lifecycle_active_year_idx
 on public.student_lifecycle_batches(target_year) where rolled_back_at is null;
create table if not exists public.student_lifecycle_changes (
 batch_id uuid not null references public.student_lifecycle_batches(id) on delete restrict,
 user_id uuid not null references auth.users(id),
 action text not null check(action in ('promote','graduate')),
 old_grade integer not null,
 old_class_number integer not null,
 old_student_number integer not null,
 old_disabled boolean not null,
 old_graduated_at timestamptz,
 new_grade integer not null,
 new_class_number integer not null,
 new_student_number integer not null,
 new_disabled boolean not null,
 new_graduated_at timestamptz,
 primary key(batch_id,user_id)
);
create index if not exists student_lifecycle_by_user_idx on public.student_lifecycle_changes(user_id);
alter table public.student_lifecycle_batches enable row level security;
alter table public.student_lifecycle_changes enable row level security;
revoke all on public.student_lifecycle_batches,public.student_lifecycle_changes from anon,authenticated;

-- All-or-nothing transition. Lock and recheck source rows, write full reversible snapshots.
create or replace function public.apply_student_lifecycle(p_actor uuid,p_year integer,p_students jsonb)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
 b uuid;
 item jsonb;
 student public.profiles%rowtype;
 action_name text;
 new_grad integer;
 new_disabled boolean;
 new_graduation timestamptz;
 ids uuid[];
 id_count integer;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role in ('admin','superadmin') and not disabled and not must_change_password)
 then raise exception 'Administrator not authorized'; end if;
 if p_year < extract(year from current_date)::integer or p_year > extract(year from current_date)::integer+2
 then raise exception 'Invalid target year'; end if;
 if jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) < 1 or jsonb_array_length(p_students) > 1000
 then raise exception 'Invalid student list'; end if;
 perform pg_catalog.pg_advisory_xact_lock(782130);
 select array_agg((v->>'id')::uuid) into ids from jsonb_array_elements(p_students) v;
 select count(distinct x) into id_count from unnest(ids) x;
 if id_count <> jsonb_array_length(p_students) then raise exception 'Duplicate students'; end if;
 insert into public.student_lifecycle_batches(target_year,actor_id) values(p_year,p_actor) returning id into b;
 for item in select v from jsonb_array_elements(p_students) v order by (v->>'id') loop
   select * into student from public.profiles where id=(item->>'id')::uuid for update;
   if not found or student.role<>'student' or student.disabled or student.graduated_at is not null
      or student.grade is null or student.class_number is null or student.student_number is null
      or student.grade <> (item->>'grade')::integer
      or student.class_number <> (item->>'classNumber')::integer
      or student.student_number <> (item->>'studentNumber')::integer
   then raise exception 'Student record has changed; preview again'; end if;
   if student.grade=6 then
     action_name:='graduate';new_grad:=6;new_disabled:=true;new_graduation:=now();
   else
     action_name:='promote';new_grad:=student.grade+1;new_disabled:=false;new_graduation:=null;
   end if;
   insert into public.student_lifecycle_changes(batch_id,user_id,action,old_grade,old_class_number,old_student_number,old_disabled,old_graduated_at,new_grade,new_class_number,new_student_number,new_disabled,new_graduated_at)
   values(b,student.id,action_name,student.grade,student.class_number,student.student_number,student.disabled,student.graduated_at,new_grad,student.class_number,student.student_number,new_disabled,new_graduation);
   update public.profiles set grade=new_grad,disabled=new_disabled,graduated_at=new_graduation where id=student.id;
 end loop;
 -- Check active student slot uniqueness after the full cohort has moved together.
 if exists(
   select 1 from public.profiles
   where role='student' and not disabled and grade is not null and class_number is not null and student_number is not null
   group by grade,class_number,student_number having count(*)>1
 ) then raise exception 'Duplicate student slots after transition'; end if;
 return b;
end;
$$;
revoke all on function public.apply_student_lifecycle(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.apply_student_lifecycle(uuid,integer,jsonb) to service_role;

create or replace function public.rollback_student_lifecycle(p_actor uuid,p_batch uuid)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare
 v_batch public.student_lifecycle_batches%rowtype;
 item public.student_lifecycle_changes%rowtype;
 current_profile public.profiles%rowtype;
 restored integer:=0;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role in ('admin','superadmin') and not disabled and not must_change_password)
 then raise exception 'Administrator not authorized'; end if;
 perform pg_catalog.pg_advisory_xact_lock(782130);
 select * into v_batch from public.student_lifecycle_batches where id=p_batch for update;
 if not found or v_batch.rolled_back_at is not null then raise exception 'Batch not found or already reversed'; end if;
 for item in select * from public.student_lifecycle_changes where batch_id=p_batch order by user_id loop
   select * into current_profile from public.profiles where id=item.user_id for update;
   if not found or current_profile.grade is distinct from item.new_grade
      or current_profile.class_number is distinct from item.new_class_number
      or current_profile.student_number is distinct from item.new_student_number
      or current_profile.disabled is distinct from item.new_disabled
      or current_profile.graduated_at is distinct from item.new_graduated_at
   then raise exception 'Student record changed after transition; rollback refused'; end if;
   update public.profiles set grade=item.old_grade,class_number=item.old_class_number,
     student_number=item.old_student_number,disabled=item.old_disabled,graduated_at=item.old_graduated_at
   where id=item.user_id;
   restored:=restored+1;
 end loop;
 update public.student_lifecycle_batches set rolled_back_at=now(),rollback_actor_id=p_actor where id=p_batch;
 return restored;
end;
$$;
revoke all on function public.rollback_student_lifecycle(uuid,uuid) from public,anon,authenticated;
grant execute on function public.rollback_student_lifecycle(uuid,uuid) to service_role;

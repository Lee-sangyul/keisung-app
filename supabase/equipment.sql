-- Apply after schema.sql.
begin;

create table if not exists public.equipment_assets (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
  category text not null check (category in ('크롬북', '전자칠판', '충전기', '기타')),
  location text not null check (char_length(trim(location)) between 1 and 80)
);

create table if not exists public.equipment_report_handlers (
  user_id uuid primary key references public.profiles(id) on delete cascade
);

create table if not exists public.equipment_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  asset_code text references public.equipment_assets(code) on delete set null,
  category text not null check (category in ('크롬북', '전자칠판', '충전기', '기타')),
  location text not null check (char_length(trim(location)) between 1 and 80),
  description text not null check (char_length(trim(description)) between 1 and 500),
  status text not null default 'received' check (status in ('received', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create index if not exists equipment_reports_reporter_idx
  on public.equipment_reports(reporter_id, created_at desc, id desc);
create index if not exists equipment_reports_status_idx
  on public.equipment_reports(status, created_at desc, id desc);
create index if not exists equipment_reports_created_idx
  on public.equipment_reports(created_at desc, id desc);

alter table public.equipment_assets enable row level security;
alter table public.equipment_report_handlers enable row level security;
alter table public.equipment_reports enable row level security;
revoke all on public.equipment_assets, public.equipment_report_handlers, public.equipment_reports
  from public, anon, authenticated;
grant select, insert on public.equipment_assets to service_role;
grant select on public.equipment_report_handlers to service_role;
grant select, insert, update on public.equipment_reports to service_role;

commit;

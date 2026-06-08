-- SportLoop Supabase schema
-- 公开前端只能使用 publishable/anon key，不能使用 service_role key。

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '李同学',
  real_name text not null,
  student_id text not null unique,
  college text not null,
  auth_status text not null default '已认证',
  campus_role text not null default '学生',
  campus_card text not null default '已绑定',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_profiles
drop constraint if exists student_profiles_one_person;

create table if not exists public.equipment (
  id text primary key,
  asset_id text not null unique,
  name text not null,
  category text not null,
  image text not null,
  total integer not null check (total >= 0),
  available integer not null check (available >= 0),
  status text not null,
  health integer not null check (health between 0 and 100),
  venue text not null,
  description text not null,
  nfc_tags jsonb not null default '[]'::jsonb,
  machine_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_available_within_total check (available <= total)
);

alter table public.equipment
add column if not exists nfc_tags jsonb not null default '[]'::jsonb;

alter table public.equipment
add column if not exists machine_synced_at timestamptz;

create table if not exists public.batch_borrow_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null default '',
  student_id text not null default '',
  items jsonb not null default '[]'::jsonb,
  duration_periods integer not null check (duration_periods between 1 and 3),
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default '待审核',
  admin_note text not null default '',
  borrowed_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id text not null references public.equipment(id),
  batch_request_id uuid references public.batch_borrow_requests(id) on delete set null,
  borrowed_at timestamptz not null,
  due_at timestamptz not null,
  duration_periods integer not null check (duration_periods between 1 and 3),
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null,
  detect_result text not null default '',
  before_photo_data_url text not null default '',
  return_photo_data_url text not null default '',
  return_machine_allowed boolean not null default false,
  returned_at timestamptz,
  returned_on_time boolean,
  renewed_times integer not null default 0,
  renewal_records jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loans
add column if not exists batch_request_id uuid references public.batch_borrow_requests(id) on delete set null;

alter table public.loans
add column if not exists before_photo_data_url text not null default '',
add column if not exists return_photo_data_url text not null default '',
add column if not exists return_machine_allowed boolean not null default false;

alter table public.loans
add column if not exists nfc_serial text not null default '',
add column if not exists nfc_verified_at timestamptz;

alter table public.loans
add column if not exists verification_code text not null default '',
add column if not exists verification_code_expires_at timestamptz;

alter table public.loans
add column if not exists student_name text not null default '',
add column if not exists student_id text not null default '';

create table if not exists public.student_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  student_id text not null,
  category text not null,
  body text not null,
  status text not null default '待回复',
  reply text not null default '',
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id text not null references public.equipment(id),
  loan_id uuid references public.loans(id) on delete set null,
  title text not null,
  source text not null,
  status text not null default '待处理',
  restored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machine_sync_logs (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references auth.users(id) on delete set null,
  mode text not null default '入库同步',
  item_count integer not null default 0 check (item_count >= 0),
  chip_count integer not null default 0 check (chip_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_operation_logs (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists loans_user_id_idx on public.loans (user_id);
create index if not exists loans_equipment_id_idx on public.loans (equipment_id);
create index if not exists loans_batch_request_id_idx on public.loans (batch_request_id);
create index if not exists loans_status_idx on public.loans (status);
create index if not exists batch_borrow_requests_user_id_idx on public.batch_borrow_requests (user_id);
create index if not exists batch_borrow_requests_status_idx on public.batch_borrow_requests (status);
create index if not exists student_messages_user_id_idx on public.student_messages (user_id);
create index if not exists admin_contacts_user_id_idx on public.admin_contacts (user_id);
create index if not exists admin_contacts_status_idx on public.admin_contacts (status);
create index if not exists work_orders_user_id_idx on public.work_orders (user_id);
create index if not exists work_orders_equipment_id_idx on public.work_orders (equipment_id);
create index if not exists work_orders_loan_id_idx on public.work_orders (loan_id);
create index if not exists work_orders_status_idx on public.work_orders (status);
create index if not exists machine_sync_logs_created_at_idx on public.machine_sync_logs (created_at desc);
create index if not exists admin_operation_logs_created_at_idx on public.admin_operation_logs (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_profiles_set_updated_at on public.student_profiles;
create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function public.set_updated_at();

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at
before update on public.equipment
for each row execute function public.set_updated_at();

drop trigger if exists batch_borrow_requests_set_updated_at on public.batch_borrow_requests;
create trigger batch_borrow_requests_set_updated_at
before update on public.batch_borrow_requests
for each row execute function public.set_updated_at();

drop trigger if exists loans_set_updated_at on public.loans;
create trigger loans_set_updated_at
before update on public.loans
for each row execute function public.set_updated_at();

drop trigger if exists admin_contacts_set_updated_at on public.admin_contacts;
create trigger admin_contacts_set_updated_at
before update on public.admin_contacts
for each row execute function public.set_updated_at();

drop trigger if exists work_orders_set_updated_at on public.work_orders;
create trigger work_orders_set_updated_at
before update on public.work_orders
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

grant usage on schema public to authenticated;
grant execute on function public.is_admin() to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update on public.student_profiles to authenticated;
grant select, insert, update on public.equipment to authenticated;
grant select, insert, update on public.batch_borrow_requests to authenticated;
grant select, insert, update on public.loans to authenticated;
grant select, insert on public.student_messages to authenticated;
grant select, insert, update on public.admin_contacts to authenticated;
grant select, insert, update on public.work_orders to authenticated;
grant select, insert on public.machine_sync_logs to authenticated;
grant select, insert on public.admin_operation_logs to authenticated;

alter table public.admin_users enable row level security;
alter table public.student_profiles enable row level security;
alter table public.equipment enable row level security;
alter table public.batch_borrow_requests enable row level security;
alter table public.loans enable row level security;
alter table public.student_messages enable row level security;
alter table public.admin_contacts enable row level security;
alter table public.work_orders enable row level security;
alter table public.machine_sync_logs enable row level security;
alter table public.admin_operation_logs enable row level security;

drop policy if exists admin_users_select_self on public.admin_users;
create policy admin_users_select_self on public.admin_users
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists student_profiles_own_select on public.student_profiles;
create policy student_profiles_own_select on public.student_profiles
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists student_profiles_own_insert on public.student_profiles;
create policy student_profiles_own_insert on public.student_profiles
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists student_profiles_own_update on public.student_profiles;
create policy student_profiles_own_update on public.student_profiles
for update to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists equipment_authenticated_select on public.equipment;
create policy equipment_authenticated_select on public.equipment
for select to authenticated
using (true);

drop policy if exists equipment_authenticated_insert on public.equipment;
create policy equipment_authenticated_insert on public.equipment
for insert to authenticated
with check ((select public.is_admin()));

drop policy if exists equipment_authenticated_update on public.equipment;
create policy equipment_authenticated_update on public.equipment
for update to authenticated
using (true)
with check (true);

drop policy if exists batch_borrow_requests_access on public.batch_borrow_requests;
create policy batch_borrow_requests_access on public.batch_borrow_requests
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists batch_borrow_requests_insert_own on public.batch_borrow_requests;
create policy batch_borrow_requests_insert_own on public.batch_borrow_requests
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists batch_borrow_requests_update_admin on public.batch_borrow_requests;
create policy batch_borrow_requests_update_admin on public.batch_borrow_requests
for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists batch_borrow_requests_update_student_sync on public.batch_borrow_requests;
create policy batch_borrow_requests_update_student_sync on public.batch_borrow_requests
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and status in ('待补照片', '已借出', '已归还'));

drop policy if exists loans_access on public.loans;
create policy loans_access on public.loans
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists loans_insert_own on public.loans;
create policy loans_insert_own on public.loans
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists loans_update_own_or_admin on public.loans;
create policy loans_update_own_or_admin on public.loans
for update to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists student_messages_access on public.student_messages;
create policy student_messages_access on public.student_messages
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists student_messages_insert_own_or_admin on public.student_messages;
create policy student_messages_insert_own_or_admin on public.student_messages
for insert to authenticated
with check (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists admin_contacts_access on public.admin_contacts;
create policy admin_contacts_access on public.admin_contacts
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists admin_contacts_insert_own on public.admin_contacts;
create policy admin_contacts_insert_own on public.admin_contacts
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists admin_contacts_update_admin on public.admin_contacts;
create policy admin_contacts_update_admin on public.admin_contacts
for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists work_orders_access on public.work_orders;
create policy work_orders_access on public.work_orders
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists work_orders_insert_own on public.work_orders;
create policy work_orders_insert_own on public.work_orders
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists work_orders_update_admin on public.work_orders;
create policy work_orders_update_admin on public.work_orders
for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists machine_sync_logs_admin_select on public.machine_sync_logs;
create policy machine_sync_logs_admin_select on public.machine_sync_logs
for select to authenticated
using ((select public.is_admin()));

drop policy if exists machine_sync_logs_admin_insert on public.machine_sync_logs;
create policy machine_sync_logs_admin_insert on public.machine_sync_logs
for insert to authenticated
with check ((select public.is_admin()));

drop policy if exists admin_operation_logs_admin_select on public.admin_operation_logs;
create policy admin_operation_logs_admin_select on public.admin_operation_logs
for select to authenticated
using ((select public.is_admin()));

drop policy if exists admin_operation_logs_admin_insert on public.admin_operation_logs;
create policy admin_operation_logs_admin_insert on public.admin_operation_logs
for insert to authenticated
with check ((select public.is_admin()));

-- 场馆管理
create table if not exists public.venues (
  id text primary key,
  user_id text not null,
  name text not null,
  location text not null default '',
  open_time text not null default '全天',
  status text not null default 'open' check (status in ('open','closed')),
  created_at text not null default '',
  updated_at text not null default ''
);

alter table public.venues enable row level security;

drop policy if exists "venues_full_access" on public.venues;
create policy "venues_full_access" on public.venues for all using (true) with check (true);

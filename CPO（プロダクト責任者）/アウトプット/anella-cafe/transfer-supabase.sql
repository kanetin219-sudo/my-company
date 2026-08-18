-- ============================================================
-- アネラカフェ 送迎管理システム Supabase テーブル作成SQL
-- ============================================================

-- テーブル①：利用者情報
create table if not exists transfer_users (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  name text not null,
  kana text,
  address text not null,
  phone text,
  family_phone text,
  car text not null default '車1',
  note text,
  is_active boolean default true
);

-- テーブル②：基本スケジュール（曜日別）
create table if not exists transfer_default_schedules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references transfer_users(id) on delete cascade,
  day_of_week int not null, -- 0=日 1=月 2=火 3=水 4=木 5=金 6=土
  is_attend boolean default true,
  pickup_time text,   -- 例：10:00
  dropoff_time text,  -- 例：15:00
  pickup_order int default 1,
  dropoff_order int default 1
);

-- テーブル③：日次スケジュール（変更分）
create table if not exists transfer_schedules (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  user_id uuid references transfer_users(id) on delete cascade,
  schedule_date date not null,
  status text not null default '出席', -- 出席・欠席・追加
  pickup_time text,
  dropoff_time text,
  car text,
  pickup_order int,
  dropoff_order int,
  note text,
  updated_by text,
  updated_at timestamp with time zone default now()
);

-- テーブル④：ドライバー情報
create table if not exists transfer_drivers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  is_active boolean default true
);

-- テーブル⑤：当日ドライバー割り当て
create table if not exists transfer_daily_drivers (
  id uuid default gen_random_uuid() primary key,
  drive_date date not null,
  car text not null,
  pickup_driver text,
  dropoff_driver_15 text,
  dropoff_driver_16 text
);

-- ============================================================
-- RLS（認証ユーザーのみアクセス）
-- ============================================================
alter table transfer_users enable row level security;
alter table transfer_default_schedules enable row level security;
alter table transfer_schedules enable row level security;
alter table transfer_drivers enable row level security;
alter table transfer_daily_drivers enable row level security;

create policy "Auth users only" on transfer_users
  for all using (auth.role() = 'authenticated');

create policy "Auth users only" on transfer_default_schedules
  for all using (auth.role() = 'authenticated');

create policy "Auth users only" on transfer_schedules
  for all using (auth.role() = 'authenticated');

create policy "Auth users only" on transfer_drivers
  for all using (auth.role() = 'authenticated');

create policy "Auth users only" on transfer_daily_drivers
  for all using (auth.role() = 'authenticated');

-- ============================================================
-- ドライバー画面用（ログイン不要で送迎表のみ閲覧）
-- ============================================================
create policy "Public read transfer_schedules" on transfer_schedules
  for select using (true);

create policy "Public read transfer_daily_drivers" on transfer_daily_drivers
  for select using (true);

create policy "Public read transfer_users name only" on transfer_users
  for select using (true);

-- ============================================================
-- インデックス（パフォーマンス向上）
-- ============================================================
create index if not exists idx_transfer_schedules_date on transfer_schedules(schedule_date);
create index if not exists idx_transfer_default_schedules_user on transfer_default_schedules(user_id);
create index if not exists idx_transfer_daily_drivers_date on transfer_daily_drivers(drive_date);

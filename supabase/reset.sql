-- =====================================================================
-- GUIYE 瑰野 · 彻底清空并重建（用于误跑了含示例数据的 setup.sql 后清理）
-- 用法：Supabase → SQL Editor → New query → 粘贴全部 → Run
-- 作用：删除本系统所有表（含被灌入的假管理员/假订单/假客户等）→ 按最新结构重建空表
-- 不动默认 profiles 表；不插入任何示例数据。
-- 跑完后创建你的真实超级管理员：
--   npm run admin:create -- --email you@guiye.com --password '强密码' --name 超级管理员
-- =====================================================================

drop table if exists admin_audit_logs cascade;
drop table if exists admins cascade;
drop table if exists refunds cascade;
drop table if exists payments cascade;
drop table if exists settlements cascade;
drop table if exists brand_assets cascade;
drop table if exists system_users cascade;
drop table if exists shipments cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop view  if exists inventory_view cascade;
drop table if exists inventory cascade;
drop table if exists products cascade;
drop table if exists dealers cascade;
drop table if exists customers cascade;
drop table if exists warehouses cascade;

-- ===== 0001_init.sql =====
-- GUIYE 瑰野 运营控制台 — initial schema
-- Column names match the TypeScript types in src/lib/types.ts exactly so that
-- `select('*')` rows can be used directly by the data layer.
--
-- Apply with the Supabase SQL editor, or the CLI:
--   supabase db push        (or)   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql

create table if not exists warehouses (
  id text primary key,
  name text not null,
  code text not null,
  region text not null
);

create table if not exists products (
  id text primary key,
  sku_code text not null unique,
  name text not null,
  category text not null,
  price numeric not null default 0,
  cost numeric not null default 0,
  safety_stock integer not null default 0,
  status text not null default 'active'
);

create table if not exists inventory (
  id text primary key,
  product_id text not null references products (id) on delete cascade,
  warehouse_id text not null references warehouses (id) on delete cascade,
  sellable integer not null default 0,
  locked integer not null default 0,
  transit integer not null default 0,
  safety_stock integer not null default 0
);
create index if not exists inventory_product_idx on inventory (product_id);
create index if not exists inventory_warehouse_idx on inventory (warehouse_id);

-- Denormalized read view consumed by getInventory() (table name: inventory_view).
create or replace view inventory_view as
select
  i.id,
  i.product_id,
  p.name as product_name,
  p.sku_code,
  i.warehouse_id,
  w.name as warehouse_name,
  i.sellable,
  i.locked,
  i.transit,
  i.safety_stock
from inventory i
join products p on p.id = i.product_id
join warehouses w on w.id = i.warehouse_id;

create table if not exists dealers (
  id text primary key,
  name text not null,
  region text not null,
  contact text not null,
  level text not null,
  status text not null,
  contract_end text not null,
  credit_limit numeric not null default 0,
  debt numeric not null default 0,
  mtd_sales numeric not null default 0,
  created_at text not null
);

create table if not exists customers (
  id text primary key,
  name text not null,
  country text not null,
  email text not null,
  phone text not null,
  type text not null,
  level text not null,
  orders_count integer not null default 0,
  total_spent numeric not null default 0,
  last_order_at text not null,
  created_at text not null
);

create table if not exists orders (
  id text primary key,
  order_no text not null unique,
  customer_name text not null,
  country text not null,
  source text not null,
  ship_from text not null,
  amount numeric not null default 0,
  amount_received numeric not null default 0,
  status text not null,
  created_at text not null
);
create index if not exists orders_created_idx on orders (created_at desc);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  product_name text not null,
  sku_code text not null,
  qty integer not null default 1,
  price numeric not null default 0
);
create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists shipments (
  id text primary key,
  order_no text not null,
  carrier text not null,
  tracking_no text not null,
  destination text not null,
  status text not null,
  exception text,
  shipped_at text not null
);

create table if not exists settlements (
  id text primary key,
  ref_no text not null,
  type text not null,
  party text not null,
  amount numeric not null default 0,
  status text not null,
  due_date text not null,
  created_at text not null
);

create table if not exists brand_assets (
  id text primary key,
  title text not null,
  category text not null,
  kind text not null,
  size text not null,
  updated_at text not null
);

create table if not exists system_users (
  id text primary key,
  name text not null,
  email text not null,
  role text not null,
  status text not null,
  last_active text not null
);

-- Row Level Security: enable on all base tables and allow public (anon) reads,
-- which is what the dashboard needs. Add authenticated write policies later when
-- wiring create/edit mutations.
do $$
declare t text;
begin
  foreach t in array array[
    'warehouses','products','inventory','dealers','customers',
    'orders','order_items','shipments','settlements','brand_assets','system_users'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "public read" on %I;', t);
    execute format('create policy "public read" on %I for select using (true);', t);
  end loop;
end $$;

-- ===== 0002_orders_payments_admin.sql =====
-- GUIYE 瑰野 — orders payment/fulfillment split, payment center & admin RBAC.
-- Apply AFTER 0001_init.sql. Column names match src/lib/types.ts exactly.

-- 1) Orders: the single `status`/`source` were split into separate dimensions.
alter table orders add column if not exists order_type text;
alter table orders add column if not exists order_channel text;
alter table orders add column if not exists customer_source text;
alter table orders add column if not exists payment_method text;
alter table orders add column if not exists pay_status text;
alter table orders add column if not exists fulfill_status text;
alter table orders add column if not exists settle_status text;

-- 2) 支付流水（平台交易为准）。
create table if not exists payments (
  id text primary key,
  order_no text not null,
  txn_no text not null,
  method text not null,
  merchant_no text not null,
  amount_due numeric not null default 0,
  amount_paid numeric not null default 0,
  fee numeric not null default 0,
  pay_status text not null,
  paid_at text,
  arrived boolean not null default false,
  settle_status text not null,
  refunded numeric not null default 0
);
create index if not exists payments_order_idx on payments (order_no);

-- 3) 退款单（一笔订单可对应多笔退款）。
create table if not exists refunds (
  id text primary key,
  order_no text not null,
  refund_no text not null,
  origin_txn_no text not null,
  method text not null,
  applied_amount numeric not null default 0,
  actual_amount numeric not null default 0,
  reason text not null,
  operator text not null,
  applied_at text not null,
  arrived_at text,
  partial boolean not null default false,
  status text not null
);
create index if not exists refunds_order_idx on refunds (order_no);

-- 4) 管理员账号（等级 + 岗位 + 数据范围）。
create table if not exists admins (
  id text primary key,
  name text not null,
  phone text not null,
  email text not null,
  level text not null,
  role text not null,
  dept text not null,
  scope text not null,
  scope_label text not null,
  status text not null,
  last_login text not null
);

-- RLS: public (anon) read to match the demo dashboard. NOTE: payments / refunds
-- / admins are sensitive — replace "public read" with authenticated, scope-aware
-- policies before handling real customer data.
do $$
declare t text;
begin
  foreach t in array array['payments','refunds','admins']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "public read" on %I;', t);
    execute format('create policy "public read" on %I for select using (true);', t);
  end loop;
end $$;

-- ===== 0003_admin_auth_rbac.sql =====
-- GUIYE 瑰野 — 管理员系统：登录鉴权 + RBAC 落地 + 操作/登录日志。
-- Apply AFTER 0002_orders_payments_admin.sql.
--
-- 设计要点：
--  * admins 行通过 user_id 关联 Supabase Auth 的 auth.users（密码由 Auth 托管，不明文存储）。
--  * grants(jsonb) + scope_values(text[]) 让「模块权限 + 数据范围」可持久化、可运行时修改。
--  * session_epoch 支持「强制退出」：自增后旧会话立即失效（应用层校验）。
--  * admin_audit_logs 记录登录日志与操作日志，普通管理员不可删除（无 delete 策略）。
--  * admins / audit 表移除 public read；改由 service_role（服务端授权后）访问，anon/authenticated 默认拒绝。

-- 1) 扩展 admins：关联 Auth、权限、数据范围、安全与生命周期字段。
alter table admins add column if not exists user_id uuid;
alter table admins add column if not exists grants jsonb not null default '{}'::jsonb;
alter table admins add column if not exists scope_values text[] not null default '{}';
alter table admins add column if not exists password_change_required boolean not null default true;
alter table admins add column if not exists two_factor boolean not null default false;
alter table admins add column if not exists failed_attempts integer not null default 0;
alter table admins add column if not exists locked_until timestamptz;
alter table admins add column if not exists session_epoch integer not null default 0;
alter table admins add column if not exists created_by text;
alter table admins add column if not exists deleted_at timestamptz;
alter table admins add column if not exists created_at timestamptz not null default now();
alter table admins add column if not exists updated_at timestamptz not null default now();

create unique index if not exists admins_user_id_key on admins (user_id) where user_id is not null;
create unique index if not exists admins_email_key on admins (lower(email)) where deleted_at is null;

-- 2) 数据范围落地所需的归属字段（自己 / 下属 / 部门等按此过滤）。
alter table orders add column if not exists owner_admin_id text;
alter table customers add column if not exists owner_admin_id text;
create index if not exists orders_owner_idx on orders (owner_admin_id);
create index if not exists customers_owner_idx on customers (owner_admin_id);

-- 3) 审计日志（登录日志 + 操作日志，单表按 category 区分）。
create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  category text not null,          -- auth | operation
  action text not null,            -- login_success | login_fail | logout | create_admin | ...
  actor_id text,
  actor_name text,
  actor_level text,
  target_id text,
  target_name text,
  module text,
  detail text,
  before jsonb,
  after jsonb,
  ip text,
  device text,
  user_agent text,
  result text not null default 'success', -- success | fail | denied
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on admin_audit_logs (created_at desc);
create index if not exists audit_category_idx on admin_audit_logs (category);
create index if not exists audit_actor_idx on admin_audit_logs (actor_id);

-- 4) RLS：敏感表不再对 anon/authenticated 开放；服务端用 service_role 访问并在应用层鉴权。
--    移除 0002 中 admins 的 "public read"。
do $$
begin
  execute 'alter table admins enable row level security';
  execute 'drop policy if exists "public read" on admins';
  -- 不再创建任何 select/insert/update/delete 策略：anon/authenticated 默认全部拒绝，
  -- 仅 service_role（绕过 RLS）可访问。删除同样被拒绝 → 满足「不物理删除 / 不可删日志」。
  execute 'alter table admin_audit_logs enable row level security';
  execute 'drop policy if exists "public read" on admin_audit_logs';
end $$;

-- ===== 0004_order_province_suzhou.sql =====
-- 订单国内省 / 市字段。
alter table orders add column if not exists province text;

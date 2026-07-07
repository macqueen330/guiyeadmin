-- =====================================================================
-- GUIYE 瑰野 · 一键安装（用于全新 / 模板 Supabase 项目）
-- 用法：Supabase 后台 → SQL Editor → New query → 粘贴本文件全部内容 → Run
-- 作用：删除会冲突的空模板表(orders/order_items/payments) → 建全部表 → 灌示例数据
-- 注意：不会动默认的 profiles(登录) 表；仅删除的三张表当前均为空，安全。
-- =====================================================================

drop table if exists payments cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;

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
-- 管理员系统：登录鉴权 + RBAC 落地 + 操作/登录日志（详见 migrations/0003）。

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

alter table orders add column if not exists owner_admin_id text;
alter table customers add column if not exists owner_admin_id text;
create index if not exists orders_owner_idx on orders (owner_admin_id);
create index if not exists customers_owner_idx on customers (owner_admin_id);

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  action text not null,
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
  result text not null default 'success',
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on admin_audit_logs (created_at desc);
create index if not exists audit_category_idx on admin_audit_logs (category);
create index if not exists audit_actor_idx on admin_audit_logs (actor_id);

do $$
begin
  execute 'alter table admins enable row level security';
  execute 'drop policy if exists "public read" on admins';
  execute 'alter table admin_audit_logs enable row level security';
  execute 'drop policy if exists "public read" on admin_audit_logs';
end $$;

-- ===== 0004_order_province_suzhou.sql =====
-- 订单国内省 / 市字段（中国仓库示例数据已统一为「苏州仓」）。
alter table orders add column if not exists province text;

-- ===== seed.sql =====
-- AUTO-GENERATED by scripts/gen-seed.mts — do not edit by hand.
-- Seed data for the GUIYE 瑰野 console. Run after 0001_init.sql.

begin;

insert into warehouses (id, name, code, region) values
  ('wh-cn', '苏州仓', 'CN · 苏州', '中国'),
  ('wh-eu', '法国 / 欧洲仓', 'FR · 里昂', '欧洲'),
  ('wh-us', '美国仓', 'US · 洛杉矶', '美洲'),
  ('wh-dealer', '经销商仓（合计）', '12 家', '经销商')
on conflict (id) do nothing;

insert into products (id, sku_code, name, category, price, cost, safety_stock, status) values
  ('p-001', 'GY-MJ-500', '瑰野·桂花酿米酒 500ml', '米酒', 168, 72, 800, 'active'),
  ('p-002', 'GY-YM-6PK', '瑰野·杨梅气泡果酒 6瓶', '果酒', 298, 132, 600, 'active'),
  ('p-003', 'GY-QM-GIFT', '瑰野·青梅清酒礼盒', '礼盒', 458, 196, 400, 'active'),
  ('p-004', 'GY-GF-1500', '瑰野·古法米酿 1.5L', '米酒', 388, 165, 300, 'active'),
  ('p-005', 'GY-LZ-RG', '瑰野·荔枝玫瑰利口酒', '利口酒', 256, 108, 350, 'active'),
  ('p-006', 'GY-YM-JIU', '瑰野·杨梅果酒 750ml', '果酒', 218, 94, 500, 'active'),
  ('p-007', 'GY-GH-GIFT', '瑰野·桂花酿礼盒装', '礼盒', 528, 224, 250, 'active'),
  ('p-008', 'GY-MG-SAKE', '瑰野·梅子清酒 720ml', '清酒', 288, 121, 300, 'active'),
  ('p-009', 'GY-OS-OSM', '瑰野·桂花乌龙气泡', '果酒', 138, 58, 450, 'draft'),
  ('p-010', 'GY-FT-SET', '瑰野·节庆品鉴套装', '礼盒', 688, 286, 180, 'active')
on conflict (id) do nothing;

insert into inventory (id, product_id, warehouse_id, sellable, locked, transit, safety_stock) values
  ('inv-001', 'p-001', 'wh-cn', 4200, 520, 360, 200),
  ('inv-002', 'p-002', 'wh-cn', 3100, 410, 280, 200),
  ('inv-003', 'p-003', 'wh-cn', 2600, 360, 220, 200),
  ('inv-004', 'p-004', 'wh-cn', 2200, 300, 200, 200),
  ('inv-005', 'p-005', 'wh-cn', 1800, 240, 180, 200),
  ('inv-006', 'p-006', 'wh-cn', 2320, 180, 120, 200),
  ('inv-007', 'p-007', 'wh-cn', 2200, 300, 200, 200),
  ('inv-101', 'p-001', 'wh-eu', 1600, 240, 820, 200),
  ('inv-102', 'p-002', 'wh-eu', 1240, 180, 640, 200),
  ('inv-103', 'p-006', 'wh-eu', 120, 80, 360, 500),
  ('inv-104', 'p-005', 'wh-eu', 180, 60, 320, 350),
  ('inv-105', 'p-003', 'wh-eu', 1900, 320, 700, 200),
  ('inv-106', 'p-004', 'wh-eu', 1200, 100, 280, 200),
  ('inv-201', 'p-001', 'wh-us', 980, 160, 520, 200),
  ('inv-202', 'p-002', 'wh-us', 760, 120, 440, 200),
  ('inv-203', 'p-003', 'wh-us', 240, 80, 380, 300),
  ('inv-204', 'p-005', 'wh-us', 600, 100, 280, 200),
  ('inv-205', 'p-008', 'wh-us', 600, 80, 240, 200),
  ('inv-301', 'p-001', 'wh-dealer', 1600, 360, 220, 200),
  ('inv-302', 'p-002', 'wh-dealer', 1200, 280, 160, 200),
  ('inv-303', 'p-007', 'wh-dealer', 180, 120, 80, 250),
  ('inv-304', 'p-004', 'wh-dealer', 1240, 240, 100, 200),
  ('inv-305', 'p-010', 'wh-dealer', 1200, 120, 80, 200)
on conflict (id) do nothing;

insert into dealers (id, name, region, contact, level, status, contract_end, credit_limit, debt, mtd_sales, created_at) values
  ('d-001', 'Maison Vert', '法国 · 巴黎', 'Camille Laurent', '金牌', 'active', '2026-12-31', 200000, 0, 184200, '2023-04-12'),
  ('d-002', 'US West Spirits', '美国 · 洛杉矶', 'Michael Cho', '金牌', 'active', '2026-07-15', 300000, 86400, 226800, '2022-11-03'),
  ('d-003', 'Tokyo Sake House', '日本 · 东京', '佐藤 健', '银牌', 'active', '2027-03-20', 150000, 0, 132400, '2023-09-21'),
  ('d-004', 'Berlin Fine Drinks', '德国 · 柏林', 'Hannah Weber', '银牌', 'pending', '2026-10-01', 120000, 0, 64800, '2024-02-18'),
  ('d-005', 'Singapore Lux Trade', '新加坡', 'Lim Wei', '标准', 'active', '2026-06-30', 100000, 24600, 58200, '2024-05-30'),
  ('d-006', 'Dubai Premium Cellar', '阿联酋 · 迪拜', 'Omar Haddad', '标准', 'suspended', '2026-08-12', 80000, 41200, 0, '2023-12-09'),
  ('d-007', 'Seoul Craft Imports', '韩国 · 首尔', '박지훈', '银牌', 'active', '2027-01-05', 130000, 0, 96400, '2024-01-22'),
  ('d-008', 'Milano Vini', '意大利 · 米兰', 'Giulia Rossi', '标准', 'active', '2026-09-18', 90000, 0, 47600, '2024-07-14')
on conflict (id) do nothing;

insert into customers (id, name, country, email, phone, type, level, orders_count, total_spent, last_order_at, created_at) values
  ('c-001', 'Camille Laurent', '法国 FR', 'camille@maisonvert.fr', '+33 6 12 34 56', 'dealer', 'VIP', 42, 486200, '2026-06-20', '2023-04-12'),
  ('c-002', '林晚晴', '中国 CN', 'wanqing.lin@example.com', '+86 138 0013 8000', 'individual', 'VIP', 18, 24680, '2026-06-20', '2024-03-08'),
  ('c-003', 'Michael Cho', '美国 US', 'm.cho@uswest.com', '+1 213 555 0148', 'wholesale', 'VIP', 31, 312400, '2026-06-19', '2022-11-03'),
  ('c-004', 'Hannah Weber', '德国 DE', 'hannah.w@berlinfine.de', '+49 30 9087 6543', 'dealer', '普通', 9, 68400, '2026-06-19', '2024-02-18'),
  ('c-005', '周慕白', '中国 CN', 'mubai.zhou@example.com', '+86 159 8888 6666', 'individual', '新客', 2, 574, '2026-06-18', '2026-05-30'),
  ('c-006', 'Sophie Martin', '法国 FR', 'sophie.martin@example.fr', '+33 7 88 99 00', 'individual', '普通', 12, 18420, '2026-06-18', '2024-09-12'),
  ('c-007', '佐藤 健', '日本 JP', 'ken.sato@tokyosake.jp', '+81 3 1234 5678', 'dealer', 'VIP', 27, 198600, '2026-06-17', '2023-09-21'),
  ('c-008', 'Lim Wei', '新加坡 SG', 'wei.lim@sglux.sg', '+65 8123 4567', 'wholesale', '普通', 14, 86200, '2026-06-16', '2024-05-30'),
  ('c-009', '陈思远', '中国 CN', 'siyuan.chen@example.com', '+86 137 1234 5678', 'individual', 'VIP', 23, 42800, '2026-06-15', '2023-07-19'),
  ('c-010', 'Giulia Rossi', '意大利 IT', 'giulia@milanovini.it', '+39 02 8765 4321', 'dealer', '普通', 7, 47600, '2026-06-14', '2024-07-14')
on conflict (id) do nothing;

insert into orders (id, order_no, customer_name, country, order_type, order_channel, customer_source, payment_method, source, ship_from, amount, amount_received, pay_status, fulfill_status, settle_status, status, created_at) values
  ('o-28471', '#GY-28471', 'Camille Laurent', '法国 FR', 'channel', 'backend', 'fair', 'bank_transfer', 'dealer', '法国/欧洲仓', 1186, 1186, 'paid', 'shipped', 'reconciling', 'shipped', '2026-06-20T16:42:00Z'),
  ('o-28470', '#GY-28470', '林晚晴', '中国 CN', 'retail', 'web_store', 'xhs', 'unpaid', 'web', '苏州仓', 386, 0, 'unpaid', 'assign', 'unsettled', 'pending', '2026-06-20T15:18:00Z'),
  ('o-28469', '#GY-28469', 'Michael Cho', '美国 US', 'enterprise', 'api', 'referral', 'credit_term', 'wholesale', '美国仓', 2680, 0, 'unpaid', 'prep', 'unsettled', 'pending', '2026-06-20T14:05:00Z'),
  ('o-28468', '#GY-28468', 'Hannah Weber', '德国 DE', 'retail', 'web_store', 'instagram', 'alipay', 'web', '法国/欧洲仓', 857, 0, 'paying', 'prep', 'unsettled', 'pending', '2026-06-20T12:36:00Z'),
  ('o-28467', '#GY-28467', '周慕白', '中国 CN', 'event', 'offline_pos', 'fair', 'wechat_pay', 'fair', '苏州仓', 188, 188, 'refunded', 'signed', 'reconciling', 'refund', '2026-06-20T11:20:00Z'),
  ('o-28466', '#GY-28466', 'Sophie Martin', '法国 FR', 'retail', 'web_store', 'whatsapp', 'alipay', 'web', '经销商·Maison Vert', 1536, 1536, 'partial_refund', 'signed', 'reconciling', 'signed', '2026-06-20T09:48:00Z'),
  ('o-28465', '#GY-28465', '佐藤 健', '日本 JP', 'channel', 'backend', 'referral', 'bank_transfer', 'dealer', '经销商·Tokyo Sake House', 3240, 3240, 'paid', 'signed', 'settled', 'settled', '2026-06-19T18:10:00Z'),
  ('o-28464', '#GY-28464', 'Lim Wei', '新加坡 SG', 'enterprise', 'api', 'organic', 'unionpay', 'wholesale', '苏州仓', 1980, 1980, 'paid', 'fulfill_exception', 'reconciling', 'review', '2026-06-19T16:22:00Z'),
  ('o-28463', '#GY-28463', '陈思远', '中国 CN', 'retail', 'wechat_store', 'wechat', 'wechat_pay', 'wechat', '苏州仓', 524, 524, 'paid', 'signed', 'settled', 'settled', '2026-06-19T14:51:00Z'),
  ('o-28462', '#GY-28462', 'Giulia Rossi', '意大利 IT', 'channel', 'backend', 'fair', 'bank_transfer', 'dealer', '法国/欧洲仓', 1476, 0, 'pay_exception', 'assign', 'settle_exception', 'review', '2026-06-19T11:33:00Z'),
  ('o-28461', '#GY-28461', 'Sophie Martin', '法国 FR', 'retail', 'web_store', 'instagram', 'alipay', 'web', '法国/欧洲仓', 298, 298, 'paid', 'shipped', 'reconciling', 'shipped', '2026-06-19T10:07:00Z'),
  ('o-28460', '#GY-28460', 'Michael Cho', '美国 US', 'enterprise', 'api', 'referral', 'unionpay', 'wholesale', '美国仓', 4280, 4280, 'paid', 'signed', 'settled', 'settled', '2026-06-18T19:40:00Z'),
  ('o-28459', '#GY-28459', '林晚晴', '中国 CN', 'retail', 'wechat_store', 'wechat', 'wechat_pay', 'wechat', '苏州仓', 168, 168, 'paid', 'signed', 'settled', 'settled', '2026-06-18T15:12:00Z'),
  ('o-28458', '#GY-28458', 'Hannah Weber', '德国 DE', 'sample', 'backend', 'instagram', 'offline', 'dealer', '法国/欧洲仓', 0, 0, 'unpaid', 'prep', 'unsettled', 'pending', '2026-06-18T13:28:00Z'),
  ('o-28457', '#GY-28457', 'Camille Laurent', '法国 FR', 'reissue', 'backend', 'fair', 'offline', 'dealer', '法国/欧洲仓', 0, 0, 'paid', 'wait_ship', 'unsettled', 'prep', '2026-06-18T09:55:00Z')
on conflict (id) do nothing;

insert into order_items (id, order_id, product_name, sku_code, qty, price) values
  ('oi-1', 'o-28471', '瑰野·桂花酿礼盒装', 'GY-GH-GIFT', 2, 528),
  ('oi-2', 'o-28471', '瑰野·青梅清酒礼盒', 'GY-QM-GIFT', 1, 458),
  ('oi-3', 'o-28470', '瑰野·桂花酿米酒 500ml', 'GY-MJ-500', 2, 168),
  ('oi-4', 'o-28469', '瑰野·节庆品鉴套装', 'GY-FT-SET', 3, 688),
  ('oi-5', 'o-28469', '瑰野·古法米酿 1.5L', 'GY-GF-1500', 1, 388)
on conflict (id) do nothing;

insert into shipments (id, order_no, carrier, tracking_no, destination, status, exception, shipped_at) values
  ('s-001', '#GY-28471', 'DHL Express', 'DHL4582193756', '法国 巴黎', 'in_transit', null, '2026-06-20'),
  ('s-002', '#GY-28466', '顺丰国际', 'SF1209348761', '法国 里昂', 'delivered', null, '2026-06-19'),
  ('s-003', '#GY-28460', 'FedEx', 'FX7781256340', '美国 洛杉矶', 'customs', '清关待补税单', '2026-06-18'),
  ('s-004', '#GY-28457', 'DHL Express', 'DHL4582100912', '法国 巴黎', 'exception', '包裹破损 · 待理赔', '2026-06-18'),
  ('s-005', '#GY-28464', '新加坡邮政', 'SG556120399', '新加坡', 'in_transit', null, '2026-06-19'),
  ('s-006', '#GY-28465', '日本郵便 EMS', 'EE229381764JP', '日本 东京', 'customs', '清关查验中', '2026-06-19'),
  ('s-007', '#GY-28461', 'DPD', 'DPD9087612334', '法国 马赛', 'preparing', null, '2026-06-20')
on conflict (id) do nothing;

insert into settlements (id, ref_no, type, party, amount, status, due_date, created_at) values
  ('f-001', 'SETT-2026-0612', 'dealer_payout', 'Maison Vert', 32400, 'pending', '2026-06-30', '2026-06-12'),
  ('f-002', 'RCV-2026-0588', 'receivable', 'US West Spirits', 86400, 'overdue', '2026-06-10', '2026-05-26'),
  ('f-003', 'RFD-2026-0341', 'refund', '周慕白', 188, 'pending', '2026-06-22', '2026-06-20'),
  ('f-004', 'INV-2026-1042', 'invoice', 'Tokyo Sake House', 132400, 'paid', '2026-06-15', '2026-06-08'),
  ('f-005', 'RCV-2026-0590', 'receivable', 'Dubai Premium Cellar', 41200, 'overdue', '2026-06-05', '2026-05-20'),
  ('f-006', 'SETT-2026-0613', 'dealer_payout', 'Tokyo Sake House', 18600, 'pending', '2026-06-28', '2026-06-14'),
  ('f-007', 'INV-2026-1043', 'invoice', 'Singapore Lux Trade', 58200, 'paid', '2026-06-16', '2026-06-09'),
  ('f-008', 'RFD-2026-0342', 'refund', '林晚晴', 386, 'paid', '2026-06-18', '2026-06-16')
on conflict (id) do nothing;

insert into brand_assets (id, title, category, kind, size, updated_at) values
  ('b-001', '桂花酿米酒 · 主图组', '产品图', 'image', '24 张 · 86 MB', '2026-06-15'),
  ('b-002', '瑰野品牌故事短片', '视频', 'video', '1 个 · 412 MB', '2026-06-10'),
  ('b-003', '经销商培训手册 2026', '培训物料', 'doc', 'PDF · 18 MB', '2026-06-08'),
  ('b-004', '品牌 VI 规范手册', '品牌手册', 'deck', 'PDF · 32 MB', '2026-05-28'),
  ('b-005', '杨梅气泡果酒 · 详情页素材', '产品图', 'image', '16 张 · 54 MB', '2026-06-12'),
  ('b-006', '展会物料 KV 设计源文件', '品牌手册', 'deck', 'AI · 240 MB', '2026-06-02'),
  ('b-007', '产品调饮教程合集', '视频', 'video', '6 个 · 1.2 GB', '2026-05-30'),
  ('b-008', '礼盒系列拍摄大片', '产品图', 'image', '32 张 · 128 MB', '2026-06-14')
on conflict (id) do nothing;

insert into system_users (id, name, email, role, status, last_active) values
  ('u-001', '陈思远', 'siyuan.chen@guiye.com', '超级管理员', 'active', '2026-06-20 18:02'),
  ('u-002', '李娜', 'na.li@guiye.com', '运营', 'active', '2026-06-20 17:41'),
  ('u-003', '王浩然', 'haoran.wang@guiye.com', '财务', 'active', '2026-06-20 16:55'),
  ('u-004', '赵敏', 'min.zhao@guiye.com', '仓储', 'active', '2026-06-20 15:30'),
  ('u-005', '刘洋', 'yang.liu@guiye.com', '客服', 'invited', '—'),
  ('u-006', 'Sophie Tran', 'sophie.tran@guiye.com', '运营', 'disabled', '2026-05-12 09:14')
on conflict (id) do nothing;

insert into payments (id, order_no, txn_no, method, merchant_no, amount_due, amount_paid, fee, pay_status, paid_at, arrived, settle_status, refunded) values
  ('pt-1', '#GY-28471', 'BANK-20260620-4471', 'bank_transfer', '—', 1186, 1186, 0, 'paid', '2026-06-20 16:58:12', true, 'reconciling', 0),
  ('pt-2', '#GY-28470', 'WX-4200001962-28470', 'wechat_pay', '16018****01', 386, 0, 0, 'unpaid', null, false, 'unsettled', 0),
  ('pt-3', '#GY-28468', 'ALI-2088****8031', 'alipay', '2088****3021', 857, 0, 0, 'paying', null, false, 'unsettled', 0),
  ('pt-4', '#GY-28467', 'WX-4200001947-28467', 'wechat_pay', '16018****01', 188, 188, 1.13, 'refunded', '2026-06-20 11:24:06', true, 'reconciling', 188),
  ('pt-5', '#GY-28466', 'ALI-2088****7788', 'alipay', '2088****3021', 1536, 1536, 9.22, 'partial_refund', '2026-06-20 09:52:41', true, 'reconciling', 336),
  ('pt-6', '#GY-28465', 'BANK-20260619-4465', 'bank_transfer', '—', 3240, 3240, 0, 'paid', '2026-06-19 18:20:33', true, 'settled', 0),
  ('pt-7', '#GY-28464', 'UP-8985****0071', 'unionpay', '8985****0071', 1980, 1980, 9.9, 'paid', '2026-06-19 16:31:09', true, 'reconciling', 0),
  ('pt-8', '#GY-28463', 'WX-4200001938-28463', 'wechat_pay', '16018****01', 524, 524, 3.14, 'paid', '2026-06-19 14:55:02', true, 'settled', 0),
  ('pt-9', '#GY-28462', 'BANK-20260619-4462', 'bank_transfer', '—', 1476, 0, 0, 'pay_exception', null, false, 'settle_exception', 0),
  ('pt-10', '#GY-28461', 'ALI-2088****6120', 'alipay', '2088****3021', 298, 298, 1.79, 'paid', '2026-06-19 10:12:55', true, 'reconciling', 0),
  ('pt-11', '#GY-28460', 'UP-8985****0060', 'unionpay', '8985****0071', 4280, 4280, 21.4, 'paid', '2026-06-18 19:46:18', true, 'settled', 0),
  ('pt-12', '#GY-28459', 'WX-4200001915-28459', 'wechat_pay', '16018****01', 168, 168, 1.01, 'paid', '2026-06-18 15:16:44', true, 'settled', 0)
on conflict (id) do nothing;

insert into refunds (id, order_no, refund_no, origin_txn_no, method, applied_amount, actual_amount, reason, operator, applied_at, arrived_at, partial, status) values
  ('rf-1', '#GY-28467', 'WXR-4620001947-01', 'WX-4200001947-28467', 'wechat_pay', 188, 188, '活动取消 · 全额退款', '刘洋', '2026-06-20 11:40:12', '2026-06-20 11:52:03', false, 'reconciled'),
  ('rf-2', '#GY-28466', 'ALR-4620007788-01', 'ALI-2088****7788', 'alipay', 236, 236, '一件破损补偿', '王浩然', '2026-06-20 10:30:20', '2026-06-20 10:41:55', true, 'success'),
  ('rf-3', '#GY-28466', 'ALR-4620007788-02', 'ALI-2088****7788', 'alipay', 100, 100, '运费补偿', '王浩然', '2026-06-20 14:02:10', null, true, 'processing'),
  ('rf-4', '#GY-28462', 'BKR-4620004462-01', 'BANK-20260619-4462', 'bank_transfer', 1476, 0, '支付异常 · 待人工核实', '王浩然', '2026-06-19 12:10:44', null, false, 'reviewing')
on conflict (id) do nothing;

insert into admins (id, name, phone, email, level, role, dept, scope, scope_label, status, last_login) values
  ('a-001', '陈思远', '138 0013 8000', 'siyuan.chen@guiye.com', 'L1', '超级管理员', '管理层', 'all', '全部', 'active', '今天 09:32'),
  ('a-002', '李明', '139 0013 6621', 'ming.li@guiye.com', 'L2', '订单管理员', '运营部', 'all', '全国订单', 'active', '昨天 18:20'),
  ('a-003', '张薇', '137 8890 4412', 'wei.zhang@guiye.com', 'L2', '财务管理员', '财务部', 'all', '全部财务', 'active', '今天 08:12'),
  ('a-004', '孙磊', '150 2231 7788', 'lei.sun@guiye.com', 'L2', '销售管理员', '销售部', 'region', '华东（江苏 / 上海 / 浙江）', 'active', '昨天 20:15'),
  ('a-005', '王浩', '158 6612 3390', 'hao.wang@guiye.com', 'L3', '客服操作员', '客服部', 'self', '自己负责客户', 'active', '今天 08:56'),
  ('a-006', '赵敏', '136 5540 9921', 'min.zhao@guiye.com', 'L3', '仓库操作员', '仓储部', 'warehouse', '华东仓', 'active', '今天 07:40'),
  ('a-007', '周琳', '135 7781 2043', 'lin.zhou@guiye.com', 'L3', '内容操作员', '品牌部', 'self', '仅本人数据', 'pending', '—'),
  ('a-008', '刘洋', '132 9902 5567', 'yang.liu@guiye.com', 'L3', '销售操作员', '销售部', 'self', '仅本人客户', 'suspended', '3 天前'),
  ('a-009', 'Sophie Tran', '133 4410 8890', 'sophie.tran@guiye.com', 'L2', '内容管理员', '品牌部', 'all', '全部内容', 'resigned', '2026-05-12 09:14')
on conflict (id) do nothing;

commit;

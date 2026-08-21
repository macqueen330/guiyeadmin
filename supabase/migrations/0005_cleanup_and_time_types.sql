-- GUIYE 瑰野 — 数据地基（一）：清除写死的示例数据 + 时间列 text → timestamptz + 现有表补字段
-- Apply AFTER 0004_order_province_suzhou.sql.
--
-- 背景：0001–0004 的所有时间列都是 `text`，导致
--   * `.order('created_at')` 是字符串排序；
--   * 无法做日期范围查询 / 日周月聚合 —— 这是「仪表盘接不上真数据」的根因。
-- 同时 src/lib/mock/* 里的 15 笔订单、10 个客户、9 个管理员等示例数据曾被写进库，
-- 本迁移一并清除（按种子固定 ID 精准删除，真实数据不受影响）。

begin;

-- ---------------------------------------------------------------------------
-- 1) 清除历史写死的示例数据（用户 / 订单 / 支付 / 库存 …）
--    与 supabase/clean_seed.sql 同一套 ID 规则；此处并入迁移，保证任何环境一致。
-- ---------------------------------------------------------------------------
delete from admins where id in
  ('a-001','a-002','a-003','a-004','a-005','a-006','a-007','a-008','a-009');
delete from payments     where id like 'pt-%';
delete from refunds      where id like 'rf-%';
delete from shipments    where id like 's-0%';
delete from settlements  where id like 'f-0%';
delete from order_items  where order_id like 'o-%' or id like 'oi-%';
delete from orders       where id like 'o-%';
delete from inventory    where id like 'inv-%';
delete from products     where id like 'p-0%';
delete from customers    where id like 'c-0%';
delete from dealers      where id like 'd-0%';
delete from warehouses   where id like 'wh-%';
delete from brand_assets where id like 'b-0%';
delete from system_users where id like 'u-0%';

-- system_users 与 admins 语义完全重叠（且 getSystemUsers() 零调用）。
-- 管理员唯一事实来源是 admins；这里彻底移除重复表。
drop table if exists system_users;

-- ---------------------------------------------------------------------------
-- 2) 安全的 text → 时间转换：无法解析的旧值（如 '今天 09:32'、'3 天前'、'—'）
--    转为 null 而不是让整条迁移失败。
-- ---------------------------------------------------------------------------
create or replace function public.gy_safe_ts(v text) returns timestamptz
language plpgsql immutable as $$
begin
  if v is null or btrim(v) = '' or btrim(v) = '—' then
    return null;
  end if;
  return btrim(v)::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.gy_safe_date(v text) returns date
language plpgsql immutable as $$
begin
  if v is null or btrim(v) = '' or btrim(v) = '—' then
    return null;
  end if;
  return btrim(v)::date;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) 时间列换类型
-- ---------------------------------------------------------------------------

-- orders
alter table orders
  alter column created_at drop not null,
  alter column created_at type timestamptz using public.gy_safe_ts(created_at);
alter table orders alter column created_at set default now();
update orders set created_at = now() where created_at is null;
alter table orders alter column created_at set not null;

-- customers
alter table customers
  alter column created_at drop not null,
  alter column created_at type timestamptz using public.gy_safe_ts(created_at),
  alter column last_order_at drop not null,
  alter column last_order_at type timestamptz using public.gy_safe_ts(last_order_at);
alter table customers alter column created_at set default now();
update customers set created_at = now() where created_at is null;
alter table customers alter column created_at set not null;

-- dealers
alter table dealers
  alter column created_at drop not null,
  alter column created_at type timestamptz using public.gy_safe_ts(created_at),
  alter column contract_end drop not null,
  alter column contract_end type date using public.gy_safe_date(contract_end);
alter table dealers alter column created_at set default now();
update dealers set created_at = now() where created_at is null;
alter table dealers alter column created_at set not null;

-- shipments
alter table shipments
  alter column shipped_at drop not null,
  alter column shipped_at type timestamptz using public.gy_safe_ts(shipped_at);

-- settlements
alter table settlements
  alter column created_at drop not null,
  alter column created_at type timestamptz using public.gy_safe_ts(created_at),
  alter column due_date drop not null,
  alter column due_date type date using public.gy_safe_date(due_date);
alter table settlements alter column created_at set default now();
update settlements set created_at = now() where created_at is null;
alter table settlements alter column created_at set not null;

-- payments / refunds
alter table payments
  alter column paid_at type timestamptz using public.gy_safe_ts(paid_at);

alter table refunds
  alter column applied_at drop not null,
  alter column applied_at type timestamptz using public.gy_safe_ts(applied_at),
  alter column arrived_at type timestamptz using public.gy_safe_ts(arrived_at);
alter table refunds alter column applied_at set default now();
update refunds set applied_at = now() where applied_at is null;
alter table refunds alter column applied_at set not null;

-- brand_assets（品牌素材不在本次改造范围，仅统一时间类型）
alter table brand_assets
  alter column updated_at drop not null,
  alter column updated_at type timestamptz using public.gy_safe_ts(updated_at);
alter table brand_assets alter column updated_at set default now();

-- admins.last_login：种子里是 '今天 09:32' 这类相对时间字符串，全部转 null。
alter table admins add column if not exists last_login_at timestamptz;
update admins set last_login_at = public.gy_safe_ts(last_login) where last_login_at is null;
alter table admins alter column last_login drop not null;
alter table admins alter column last_login set default '';

-- ---------------------------------------------------------------------------
-- 4) 现有表补齐业务字段
-- ---------------------------------------------------------------------------

-- orders：金额拆解、币种、地址、归属仓、关键时间点
alter table orders add column if not exists customer_id      text;
alter table orders add column if not exists warehouse_id     text;
alter table orders add column if not exists city             text;
alter table orders add column if not exists address          text;
alter table orders add column if not exists contact_phone    text;
alter table orders add column if not exists currency         text not null default 'CNY';
alter table orders add column if not exists exchange_rate    numeric not null default 1;
alter table orders add column if not exists goods_amount     numeric not null default 0;
alter table orders add column if not exists freight_fee      numeric not null default 0;
alter table orders add column if not exists discount         numeric not null default 0;
alter table orders add column if not exists tax              numeric not null default 0;
alter table orders add column if not exists remark           text;
alter table orders add column if not exists paid_at          timestamptz;
alter table orders add column if not exists shipped_at       timestamptz;
alter table orders add column if not exists signed_at        timestamptz;
alter table orders add column if not exists cancelled_at     timestamptz;
alter table orders add column if not exists updated_at       timestamptz not null default now();
alter table orders add column if not exists created_by       text;

create index if not exists orders_customer_idx  on orders (customer_id);
create index if not exists orders_warehouse_idx on orders (warehouse_id);
create index if not exists orders_pay_idx       on orders (pay_status);
create index if not exists orders_fulfill_idx   on orders (fulfill_status);

-- order_items：关联真实 SKU、金额小计
alter table order_items add column if not exists product_id text;
alter table order_items add column if not exists cost       numeric not null default 0;
alter table order_items add column if not exists discount   numeric not null default 0;
create index if not exists order_items_product_idx on order_items (product_id);

-- products：单位、规格、条码、税率、图片、分类外键
alter table products add column if not exists category_id  text;
alter table products add column if not exists unit         text not null default '瓶';
alter table products add column if not exists spec         text;
alter table products add column if not exists barcode      text;
alter table products add column if not exists tax_rate     numeric not null default 0;
alter table products add column if not exists image_url    text;
alter table products add column if not exists description  text;
alter table products add column if not exists weight_g     integer;
alter table products add column if not exists sort         integer not null default 0;
alter table products add column if not exists created_at   timestamptz not null default now();
alter table products add column if not exists updated_at   timestamptz not null default now();

-- customers：会员资产（积分 / 成长值 / 等级）必须落库，不能渲染时现算
alter table customers add column if not exists points            integer not null default 0;
alter table customers add column if not exists growth            integer not null default 0;
alter table customers add column if not exists tier_id           text;
alter table customers add column if not exists birthday          date;
alter table customers add column if not exists address           text;
alter table customers add column if not exists province          text;
alter table customers add column if not exists city              text;
alter table customers add column if not exists source            text;
alter table customers add column if not exists remark            text;
alter table customers add column if not exists next_follow_up_at timestamptz;
alter table customers add column if not exists status            text not null default 'active';
alter table customers add column if not exists updated_at        timestamptz not null default now();
alter table customers add column if not exists deleted_at        timestamptz;
create index if not exists customers_tier_idx   on customers (tier_id);
create index if not exists customers_status_idx on customers (status);

-- dealers
alter table dealers add column if not exists discount_rate      numeric not null default 1;
alter table dealers add column if not exists payment_terms_days integer not null default 0;
alter table dealers add column if not exists bank_account       text;
alter table dealers add column if not exists owner_admin_id     text;
alter table dealers add column if not exists updated_at         timestamptz not null default now();

-- warehouses：仓库改名 / 停用是运营动作，不该改 SQL 迁移
alter table warehouses add column if not exists address    text;
alter table warehouses add column if not exists contact    text;
alter table warehouses add column if not exists phone      text;
alter table warehouses add column if not exists type       text not null default 'own';
alter table warehouses add column if not exists is_active  boolean not null default true;
alter table warehouses add column if not exists sort       integer not null default 0;
alter table warehouses add column if not exists created_at timestamptz not null default now();
alter table warehouses add column if not exists updated_at timestamptz not null default now();

-- inventory
alter table inventory add column if not exists updated_at timestamptz not null default now();

-- shipments：承运商外键、运费、真实时间点、与订单的外键
alter table shipments add column if not exists order_id       text;
alter table shipments add column if not exists carrier_id     text;
alter table shipments add column if not exists warehouse_id   text;
alter table shipments add column if not exists freight_cost   numeric not null default 0;
alter table shipments add column if not exists weight_g       integer;
alter table shipments add column if not exists estimated_at   timestamptz;
alter table shipments add column if not exists delivered_at   timestamptz;
alter table shipments add column if not exists external_no    text;
alter table shipments add column if not exists last_synced_at timestamptz;
alter table shipments add column if not exists created_at     timestamptz not null default now();
alter table shipments add column if not exists updated_at     timestamptz not null default now();
create index if not exists shipments_order_idx   on shipments (order_id);
create index if not exists shipments_carrier_idx on shipments (carrier_id);

-- payments：渠道外键、费率、币种、原始报文
alter table payments add column if not exists gateway_id text;
alter table payments add column if not exists fee_rate   numeric not null default 0;
alter table payments add column if not exists currency   text not null default 'CNY';
alter table payments add column if not exists raw        jsonb;
alter table payments add column if not exists created_at timestamptz not null default now();
alter table payments add column if not exists updated_at timestamptz not null default now();
create unique index if not exists payments_txn_no_key on payments (txn_no);

-- refunds：审批留痕
alter table refunds add column if not exists gateway_id   text;
alter table refunds add column if not exists currency     text not null default 'CNY';
alter table refunds add column if not exists operator_id  text;
alter table refunds add column if not exists approved_by  text;
alter table refunds add column if not exists approved_at  timestamptz;
alter table refunds add column if not exists reject_note  text;
alter table refunds add column if not exists raw          jsonb;
alter table refunds add column if not exists created_at   timestamptz not null default now();
alter table refunds add column if not exists updated_at   timestamptz not null default now();
create unique index if not exists refunds_refund_no_key on refunds (refund_no);

-- settlements
alter table settlements add column if not exists currency text not null default 'CNY';
alter table settlements add column if not exists paid_at  timestamptz;
alter table settlements add column if not exists remark   text;

commit;

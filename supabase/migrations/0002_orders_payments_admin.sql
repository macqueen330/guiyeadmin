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

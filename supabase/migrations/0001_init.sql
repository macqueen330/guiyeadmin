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

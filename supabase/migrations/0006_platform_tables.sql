-- GUIYE 瑰野 — 数据地基（二）：把「界面上看得见、后台改不了」的东西全部建表。
-- Apply AFTER 0005_cleanup_and_time_types.sql.
--
-- 覆盖范围（品牌内容 / 官网 CMS 不在本次范围内）：
--   配置与字典 · 商品分类与多档价格 · 承运商与物流轨迹 · 支付渠道与回调
--   通知规则 · 审批规则与审批单 · 会员等级与积分流水 · 出入库单据
--   订单时间轴 · 官网埋点与日汇总 · 部门 / 角色 / 登录会话

begin;

-- ===========================================================================
-- 一、全局配置与字典
-- ===========================================================================

-- 安全阈值、库存阈值、分析口径…… 原本散落在 4 个文件里的常量收敛到这里。
create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  value_type  text not null default 'string', -- string | number | boolean | json
  category    text not null default 'general',
  label       text not null default '',
  description text,
  min_value   numeric,
  max_value   numeric,
  updated_by  text,
  updated_at  timestamptz not null default now()
);
create index if not exists app_settings_category_idx on app_settings (category);

-- 业务字典（订单状态 / 支付方式 / 客户来源 …）。代码里的 TS 联合类型仍是合法集合，
-- 这里存的是「中文名 + 配色 + 排序 + 是否启用」，让运营可以改名、停用、排序。
create table if not exists dictionaries (
  id         text primary key default gen_random_uuid()::text,
  group_key  text not null,
  code       text not null,
  label      text not null,
  color      text not null default '#5b6470',
  bg         text not null default '#eef0f2',
  sort       integer not null default 0,
  is_active  boolean not null default true,
  is_system  boolean not null default false, -- 系统内置：可改名，不可删除
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (group_key, code)
);
create index if not exists dictionaries_group_idx on dictionaries (group_key, sort);

-- ===========================================================================
-- 二、商品分类与多档价格（取代 InventoryView 里的 ×0.92 / ×0.78 …… 乘法）
-- ===========================================================================

create table if not exists product_categories (
  id         text primary key default gen_random_uuid()::text,
  parent_id  text references product_categories (id) on delete set null,
  name       text not null,
  code       text not null unique,
  sort       integer not null default 0,
  tax_rate   numeric not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_category_id_fkey'
  ) then
    alter table products
      add constraint products_category_id_fkey
      foreign key (category_id) references product_categories (id) on delete set null;
  end if;
end $$;

create table if not exists price_tiers (
  id                text primary key default gen_random_uuid()::text,
  code              text not null unique,
  name              text not null,
  sort              integer not null default 0,
  currency          text not null default 'CNY',
  -- 未单独定价的 SKU 用「零售价 × default_factor」兜底 —— 倍率现在是可配置的数据，
  -- 不再是 InventoryView.tsx 里的字面量。
  default_factor    numeric not null default 1,
  requires_approval boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- SKU × 档位价：支持阶梯量价（min_qty）、时段价（valid_from/to）、多币种。
create table if not exists product_prices (
  id         text primary key default gen_random_uuid()::text,
  product_id text not null references products (id) on delete cascade,
  tier_id    text not null references price_tiers (id) on delete cascade,
  price      numeric not null,
  currency   text not null default 'CNY',
  min_qty    integer not null default 1,
  valid_from timestamptz not null default now(),
  valid_to   timestamptz,
  is_active  boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, tier_id, min_qty, valid_from)
);
create index if not exists product_prices_lookup_idx
  on product_prices (product_id, tier_id, is_active);

-- ===========================================================================
-- 三、承运商与物流（为未来对接物流公司 API 预留）
-- ===========================================================================

create table if not exists carriers (
  id                    text primary key default gen_random_uuid()::text,
  code                  text not null unique,
  name                  text not null,
  region                text,
  contact               text,
  phone                 text,
  tracking_url_template text,                         -- 例：https://.../query?nu={tracking_no}
  service_levels        text[] not null default '{}',
  -- ↓↓↓ 物流公司 API 接入位。api_provider 为空 = 尚未接入，仅人工录单。
  --    密钥永不入库：只存环境变量名，值配置在 Vercel / .env。
  api_provider          text,                         -- sf | dhl | fedex | cainiao | custom
  api_base_url          text,
  api_credential_env    text,
  webhook_secret_env    text,
  api_config            jsonb not null default '{}'::jsonb,
  is_active             boolean not null default true,
  sort                  integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shipments_carrier_id_fkey'
  ) then
    alter table shipments
      add constraint shipments_carrier_id_fkey
      foreign key (carrier_id) references carriers (id) on delete set null;
  end if;
end $$;

-- 物流轨迹（人工录入或承运商 API / Webhook 回写）。
create table if not exists shipment_events (
  id          text primary key default gen_random_uuid()::text,
  shipment_id text not null references shipments (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  status      text not null,
  location    text,
  description text,
  source      text not null default 'manual',  -- manual | carrier_api | webhook
  raw         jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists shipment_events_shipment_idx
  on shipment_events (shipment_id, occurred_at desc);

-- 承运商 Webhook 原始回调：先落库（幂等 + 可回放），再异步处理。
create table if not exists logistics_webhook_events (
  id           text primary key default gen_random_uuid()::text,
  carrier_code text not null,
  external_id  text,
  tracking_no  text,
  signature_ok boolean not null default false,
  payload      jsonb not null,
  processed    boolean not null default false,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz not null default now(),
  unique (carrier_code, external_id)
);
create index if not exists logistics_webhook_pending_idx
  on logistics_webhook_events (processed, received_at desc);

-- ===========================================================================
-- 四、支付渠道配置与回调（微信支付 / 支付宝 / 银联 API 预留）
-- ===========================================================================

create table if not exists payment_gateways (
  id                text primary key default gen_random_uuid()::text,
  provider          text not null unique,  -- wechat_pay | alipay | unionpay | bank_transfer | offline | credit_term
  name              text not null,
  merchant_no       text,
  app_id            text,
  -- 密钥 / 私钥 / 证书永不入库：只存环境变量名与证书引用。
  credential_env    text,
  cert_ref          text,
  cert_expires_at   timestamptz,
  notify_url        text,
  return_url        text,
  scenarios         text[] not null default '{}',
  fee_rate          numeric not null default 0,  -- 0.006 = 0.6%
  fee_fixed         numeric not null default 0,
  settle_cycle      text,
  bank_account_name text,
  bank_account_no   text,
  bank_name         text,
  term_days         integer,                     -- 账期天数（credit_term）
  status            text not null default 'disabled',   -- enabled | disabled | pending
  test_status       text not null default 'untested',   -- passed | failed | untested
  last_test_at      timestamptz,
  last_test_message text,
  is_sandbox        boolean not null default true,
  config            jsonb not null default '{}'::jsonb,
  sort              integer not null default 0,
  updated_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_gateway_id_fkey'
  ) then
    alter table payments
      add constraint payments_gateway_id_fkey
      foreign key (gateway_id) references payment_gateways (id) on delete set null;
  end if;
end $$;

-- 支付平台异步通知原始报文：幂等键 = (provider, external_id)。
create table if not exists payment_webhook_events (
  id           text primary key default gen_random_uuid()::text,
  provider     text not null,
  event_type   text,
  external_id  text,
  txn_no       text,
  order_no     text,
  amount       numeric,
  signature_ok boolean not null default false,
  payload      jsonb not null,
  headers      jsonb,
  processed    boolean not null default false,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz not null default now(),
  unique (provider, external_id)
);
create index if not exists payment_webhook_pending_idx
  on payment_webhook_events (processed, received_at desc);

-- 渠道对账文件导入批次（「导入对账文件」按钮的落地表）。
create table if not exists reconciliation_batches (
  id            text primary key default gen_random_uuid()::text,
  provider      text not null,
  stat_date     date not null,
  file_name     text,
  total_rows    integer not null default 0,
  matched_rows  integer not null default 0,
  diff_rows     integer not null default 0,
  total_amount  numeric not null default 0,
  total_fee     numeric not null default 0,
  status        text not null default 'imported', -- imported | reconciled | failed
  note          text,
  raw           jsonb,
  operator_id   text,
  operator_name text,
  created_at    timestamptz not null default now()
);

-- ===========================================================================
-- 五、通知规则 · 审批规则 · 审批单
-- ===========================================================================

create table if not exists notification_rules (
  id          text primary key default gen_random_uuid()::text,
  event_key   text not null unique,
  name        text not null,
  description text,
  channels    text[] not null default '{inapp}',   -- inapp | email | sms | wecom
  threshold   jsonb not null default '{}'::jsonb,  -- 如 {"days":7} / {"below":"safety_stock"}
  recipients  text[] not null default '{}',
  enabled     boolean not null default true,
  sort        integer not null default 0,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

-- 审批阈值：金额是 numeric，可与订单 / 退款金额直接比较（旧的 REFUND_TIERS 存的是中文字符串）。
create table if not exists approval_rules (
  id             text primary key default gen_random_uuid()::text,
  action_key     text not null,     -- refund | price_change | stock_adjust | export_customers | ...
  name           text not null,
  min_amount     numeric not null default 0,
  max_amount     numeric,           -- null = 无上限
  currency       text not null default 'CNY',
  required_level text not null,     -- L1 | L2
  require_2fa    boolean not null default false,
  note           text,
  enabled        boolean not null default true,
  sort           integer not null default 0,
  updated_by     text,
  updated_at     timestamptz not null default now(),
  unique (action_key, min_amount)
);

create table if not exists approval_requests (
  id             text primary key default gen_random_uuid()::text,
  request_no     text not null unique,
  action_key     text not null,
  title          text not null,
  amount         numeric,
  currency       text not null default 'CNY',
  payload        jsonb not null default '{}'::jsonb,
  requester_id   text,
  requester_name text,
  required_level text not null default 'L2',
  approver_id    text,
  approver_name  text,
  status         text not null default 'pending', -- pending | approved | rejected | cancelled
  decision_note  text,
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists approval_requests_status_idx
  on approval_requests (status, created_at desc);

-- ===========================================================================
-- 六、会员等级与积分（积分不再是渲染时 total_spent / 10 算出来的）
-- ===========================================================================

create table if not exists membership_tiers (
  id                  text primary key default gen_random_uuid()::text,
  code                text not null unique,
  name                text not null,
  min_spent           numeric not null default 0,
  min_orders          integer not null default 0,
  discount_rate       numeric not null default 1,
  points_per_currency numeric not null default 0.1,  -- 消费 1 元得多少积分
  growth_per_order    integer not null default 100,
  color               text not null default '#5b6470',
  bg                  text not null default '#eef0f2',
  sort                integer not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customers_tier_id_fkey'
  ) then
    alter table customers
      add constraint customers_tier_id_fkey
      foreign key (tier_id) references membership_tiers (id) on delete set null;
  end if;
end $$;

create table if not exists points_ledger (
  id            text primary key default gen_random_uuid()::text,
  customer_id   text not null references customers (id) on delete cascade,
  change        integer not null,
  balance_after integer not null,
  type          text not null,  -- earn | redeem | adjust | expire | reverse
  reason        text,
  ref_no        text,
  operator_id   text,
  operator_name text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists points_ledger_customer_idx
  on points_ledger (customer_id, created_at desc);

create table if not exists customer_tags (
  id         text primary key default gen_random_uuid()::text,
  name       text not null unique,
  color      text not null default '#5b6470',
  bg         text not null default '#eef0f2',
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists customer_tag_links (
  customer_id text not null references customers (id) on delete cascade,
  tag_id      text not null references customer_tags (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (customer_id, tag_id)
);

-- 客户跟进：首页「超 7 天未跟进」需要一个真实的时间戳。
alter table customers add column if not exists last_contacted_at timestamptz;
create index if not exists customers_follow_idx on customers (last_contacted_at);

create table if not exists customer_follow_ups (
  id            text primary key default gen_random_uuid()::text,
  customer_id   text not null references customers (id) on delete cascade,
  channel       text not null default 'note',  -- note | call | wechat | email | visit
  content       text not null,
  next_at       timestamptz,
  operator_id   text,
  operator_name text,
  created_at    timestamptz not null default now()
);
create index if not exists customer_follow_ups_customer_idx
  on customer_follow_ups (customer_id, created_at desc);

-- ===========================================================================
-- 七、出入库单据（库存唯一合法变动来源）与订单时间轴
-- ===========================================================================

create table if not exists inventory_moves (
  id               text primary key default gen_random_uuid()::text,
  move_no          text not null unique,
  type             text not null,  -- in | out | transfer | adjust
  product_id       text not null references products (id) on delete restrict,
  warehouse_id     text not null references warehouses (id) on delete restrict,
  to_warehouse_id  text references warehouses (id) on delete restrict,
  qty              integer not null,
  before_sellable  integer,
  after_sellable   integer,
  reason           text,
  ref_no           text,
  operator_id      text,
  operator_name    text,
  status           text not null default 'done', -- draft | done | cancelled
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists inventory_moves_product_idx
  on inventory_moves (product_id, occurred_at desc);
create index if not exists inventory_moves_warehouse_idx
  on inventory_moves (warehouse_id, occurred_at desc);

create table if not exists order_events (
  id            text primary key default gen_random_uuid()::text,
  order_id      text not null references orders (id) on delete cascade,
  order_no      text not null,
  event_type    text not null,  -- created | pay_status | fulfill_status | settle_status | note | cancelled
  field         text,
  from_value    text,
  to_value      text,
  note          text,
  operator_id   text,
  operator_name text,
  created_at    timestamptz not null default now()
);
create index if not exists order_events_order_idx on order_events (order_id, created_at);

-- ===========================================================================
-- 八、官网数据（埋点明细 + 日汇总）—— 取代 src/lib/mock/web.ts
--     页面浏览同时上报给 Vercel Web Analytics；这里存的是后台可查询的一方数据。
-- ===========================================================================

create table if not exists web_events (
  id          text primary key default gen_random_uuid()::text,
  event_key   text not null,   -- page_view | product_click | product_view | add_cart | checkout | purchase | inquiry | ...
  occurred_at timestamptz not null default now(),
  visitor_id  text,
  session_id  text,
  page_path   text,
  page_title  text,
  product_id  text,
  referrer    text,
  source      text,            -- wechat | xhs | direct | search | instagram | ...
  device      text,            -- mobile | desktop | tablet
  country     text,
  province    text,
  city        text,
  value       numeric,
  props       jsonb not null default '{}'::jsonb
);
create index if not exists web_events_time_idx    on web_events (occurred_at desc);
create index if not exists web_events_key_idx     on web_events (event_key, occurred_at desc);
create index if not exists web_events_product_idx on web_events (product_id);
create index if not exists web_events_session_idx on web_events (session_id);

-- 事件字典：新增一个官网按钮不必改 TS 发版。
create table if not exists web_event_types (
  id         text primary key default gen_random_uuid()::text,
  event_key  text not null unique,
  name       text not null,
  category   text not null default 'interaction',
  sort       integer not null default 0,
  is_active  boolean not null default true
);

create table if not exists web_analytics_daily (
  stat_date          date primary key,
  pv                 integer not null default 0,
  uv                 integer not null default 0,
  sessions           integer not null default 0,
  new_visitors       integer not null default 0,
  product_clicks     integer not null default 0,
  product_views      integer not null default 0,
  add_cart           integer not null default 0,
  checkouts          integer not null default 0,
  orders             integer not null default 0,
  paid               integer not null default 0,
  inquiries          integer not null default 0,
  stay_seconds_total bigint  not null default 0,
  bounce_sessions    integer not null default 0,
  updated_at         timestamptz not null default now()
);

create table if not exists web_page_stats (
  id                 text primary key default gen_random_uuid()::text,
  stat_date          date not null,
  page_path          text not null,
  page_title         text,
  pv                 integer not null default 0,
  uv                 integer not null default 0,
  sessions           integer not null default 0,
  stay_seconds_total bigint  not null default 0,
  bounce_sessions    integer not null default 0,
  unique (stat_date, page_path)
);

create table if not exists web_traffic_sources (
  id         text primary key default gen_random_uuid()::text,
  stat_date  date not null,
  source_key text not null,
  visitors   integer not null default 0,
  sessions   integer not null default 0,
  orders     integer not null default 0,
  unique (stat_date, source_key)
);

create table if not exists web_device_stats (
  id         text primary key default gen_random_uuid()::text,
  stat_date  date not null,
  device     text not null,
  visitors   integer not null default 0,
  sessions   integer not null default 0,
  unique (stat_date, device)
);

create table if not exists web_region_stats (
  id         text primary key default gen_random_uuid()::text,
  stat_date  date not null,
  region_key text not null,   -- 省 / 市 / 国家
  region_type text not null default 'city',
  visitors   integer not null default 0,
  clicks     integer not null default 0,
  orders     integer not null default 0,
  unique (stat_date, region_key, region_type)
);

create table if not exists web_product_stats (
  id          text primary key default gen_random_uuid()::text,
  stat_date   date not null,
  product_id  text not null,
  impressions integer not null default 0,
  clicks      integer not null default 0,
  views       integer not null default 0,
  add_cart    integer not null default 0,
  orders      integer not null default 0,
  paid        integer not null default 0,
  unique (stat_date, product_id)
);

-- ===========================================================================
-- 九、组织 / 角色 / 登录会话（让 RBAC 从常量变成数据）
-- ===========================================================================

create table if not exists departments (
  id         text primary key default gen_random_uuid()::text,
  name       text not null unique,
  code       text,
  parent_id  text references departments (id) on delete set null,
  sort       integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists roles (
  id          text primary key default gen_random_uuid()::text,
  key         text not null unique,
  name        text not null,
  level       text not null,                       -- L1 | L2 | L3
  scope       text not null default 'self',
  description text,
  grants      jsonb not null default '{}'::jsonb,  -- { module: "all" | "view" | string[] }
  is_system   boolean not null default false,
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table admins add column if not exists role_id text;
alter table admins add column if not exists dept_id text;
alter table admins add column if not exists avatar_url text;

-- 登录会话：支持「踢下线单个设备」与 个人中心 → 登录设备。
create table if not exists admin_sessions (
  id            text primary key default gen_random_uuid()::text,
  admin_id      text not null,
  session_epoch integer not null default 0,
  ip            text,
  device        text,
  user_agent    text,
  signed_in_at  timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz,
  revoked_by    text
);
create index if not exists admin_sessions_admin_idx
  on admin_sessions (admin_id, signed_in_at desc);

commit;

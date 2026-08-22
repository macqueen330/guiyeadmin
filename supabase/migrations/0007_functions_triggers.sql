-- GUIYE 瑰野 — 数据地基（三）：把「写在渲染代码里的业务规则」下沉到数据库。
-- Apply AFTER 0006_platform_tables.sql.
--
--   * 订单号自动生成（不再手写 #GY-28471）
--   * 粗粒度 status / source 由支付+履约+结算派生（原来在 mock/data.ts coarseStatus()）
--   * 客户 订单数 / 累计消费 / 最近下单 由订单实时汇总（原来是写死的列）
--   * 积分与库存变动走原子函数 + 流水表
--   * 官网埋点日汇总

begin;

-- ---------------------------------------------------------------------------
-- 0) updated_at 自动维护
-- ---------------------------------------------------------------------------
create or replace function public.gy_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'orders','products','customers','dealers','warehouses','inventory','shipments',
    'payments','refunds','price_tiers','product_prices','product_categories',
    'carriers','payment_gateways','membership_tiers','roles','dictionaries',
    'notification_rules','approval_rules','app_settings'
  ] loop
    execute format('drop trigger if exists %I on %I;', 'trg_touch_' || t, t);
    execute format(
      'create trigger %I before update on %I for each row execute function public.gy_touch_updated_at();',
      'trg_touch_' || t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 1) 单据号生成：订单 / 出入库 / 退款 / 审批
-- ---------------------------------------------------------------------------
create sequence if not exists gy_order_no_seq  start 10001;
create sequence if not exists gy_move_no_seq   start 1;
create sequence if not exists gy_refund_no_seq start 1;
create sequence if not exists gy_appr_no_seq   start 1;

create or replace function public.gy_next_order_no() returns text
language sql volatile as $$
  select 'GY-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-'
         || lpad(nextval('gy_order_no_seq')::text, 5, '0');
$$;

create or replace function public.gy_next_move_no() returns text
language sql volatile as $$
  select 'MV-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-'
         || lpad(nextval('gy_move_no_seq')::text, 4, '0');
$$;

create or replace function public.gy_next_refund_no() returns text
language sql volatile as $$
  select 'RF-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-'
         || lpad(nextval('gy_refund_no_seq')::text, 4, '0');
$$;

create or replace function public.gy_next_approval_no() returns text
language sql volatile as $$
  select 'AP-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-'
         || lpad(nextval('gy_appr_no_seq')::text, 4, '0');
$$;

alter table orders            alter column order_no  set default public.gy_next_order_no();
alter table inventory_moves   alter column move_no   set default public.gy_next_move_no();
alter table approval_requests alter column request_no set default public.gy_next_approval_no();

-- ---------------------------------------------------------------------------
-- 2) 订单：粗粒度 status / source 派生（规则从 src/lib/mock/data.ts 下沉到这里）
-- ---------------------------------------------------------------------------
create or replace function public.gy_coarse_order_status(
  p_pay text, p_fulfill text, p_settle text
) returns text
language sql immutable as $$
  select case
    when p_pay = 'refunded'                                     then 'refund'
    when p_pay in ('unpaid', 'paying')                          then 'pending'
    when p_pay in ('failed', 'pay_exception')                   then 'review'
    when p_fulfill = 'fulfill_exception'                        then 'review'
    when p_fulfill = 'signed' and p_settle = 'settled'          then 'settled'
    when p_fulfill = 'signed'                                   then 'signed'
    when p_fulfill = 'shipped'                                  then 'shipped'
    when p_fulfill in ('prep', 'wait_ship')                     then 'prep'
    else 'assign'
  end;
$$;

create or replace function public.gy_source_from_channel(p_channel text) returns text
language sql immutable as $$
  select case p_channel
    when 'web_store'    then 'web'
    when 'wechat_store' then 'wechat'
    when 'backend'      then 'dealer'
    when 'offline_pos'  then 'fair'
    when 'api'          then 'wholesale'
    else 'web'
  end;
$$;

create or replace function public.gy_orders_derive() returns trigger
language plpgsql as $$
begin
  new.pay_status     := coalesce(new.pay_status, 'unpaid');
  new.fulfill_status := coalesce(new.fulfill_status, 'assign');
  new.settle_status  := coalesce(new.settle_status, 'unsettled');
  new.order_type     := coalesce(new.order_type, 'retail');
  new.order_channel  := coalesce(new.order_channel, 'web_store');
  new.customer_source := coalesce(new.customer_source, 'organic');
  new.payment_method := coalesce(new.payment_method, 'unpaid');

  new.source := public.gy_source_from_channel(new.order_channel);
  new.status := public.gy_coarse_order_status(new.pay_status, new.fulfill_status, new.settle_status);

  -- 关键时间点：状态首次进入时打点，便于「今日销售额 / 近 7 日已送达」等时间窗统计。
  if new.pay_status in ('paid', 'partial_refund') and new.paid_at is null then
    new.paid_at := now();
  end if;
  if new.fulfill_status in ('shipped', 'signed') and new.shipped_at is null then
    new.shipped_at := now();
  end if;
  if new.fulfill_status = 'signed' and new.signed_at is null then
    new.signed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_derive on orders;
create trigger trg_orders_derive
  before insert or update on orders
  for each row execute function public.gy_orders_derive();

alter table orders alter column status set default 'pending';
alter table orders alter column source set default 'web';

-- ---------------------------------------------------------------------------
-- 3) 客户汇总字段实时重算（订单数 / 累计消费 / 最近下单）
-- ---------------------------------------------------------------------------
create or replace function public.gy_refresh_customer_stats(p_customer_id text) returns void
language plpgsql as $$
declare
  v_cnt   integer;
  v_spent numeric;
  v_last  timestamptz;
  v_tier  membership_tiers%rowtype;
begin
  if p_customer_id is null then return; end if;

  -- 口径：只算真正付过钱的订单，金额取实收（amount_received）而不是应收。
  select count(*), coalesce(sum(amount_received), 0), max(created_at)
    into v_cnt, v_spent, v_last
    from orders
   where customer_id = p_customer_id
     and pay_status in ('paid', 'partial_refund', 'refunded');

  -- 命中的最高等级；一条都不命中时保持原等级（只升不降）
  select * into v_tier
    from membership_tiers t
   where t.is_active
     and v_spent >= t.min_spent
     and v_cnt   >= t.min_orders
   order by t.min_spent desc, t.min_orders desc
   limit 1;

  update customers c set
    orders_count  = v_cnt,
    total_spent   = v_spent,
    last_order_at = v_last,
    tier_id       = coalesce(v_tier.id, c.tier_id),
    -- level 是展示用文本，必须与 tier_id 同源。
    -- 原来只更新 tier_id，导致客户中心「按等级筛选」（读 level）和
    -- 「会员」视图（读 tier_id）对同一个客户给出互相矛盾的答案。
    level         = coalesce(v_tier.name, c.level),
    -- 成长值 = 已付款订单数 × 该等级每单成长值。
    -- 原来没有任何地方写 growth，界面上这一列恒为 0。
    growth        = v_cnt * coalesce(v_tier.growth_per_order, 0)
  where c.id = p_customer_id;
end;
$$;

create or replace function public.gy_orders_after_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.gy_refresh_customer_stats(old.customer_id);
    return old;
  end if;
  perform public.gy_refresh_customer_stats(new.customer_id);
  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
    perform public.gy_refresh_customer_stats(old.customer_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_customer_stats on orders;
create trigger trg_orders_customer_stats
  after insert or update or delete on orders
  for each row execute function public.gy_orders_after_change();

-- 订单状态变更自动写时间轴（人工备注由应用层单独插入）。
create or replace function public.gy_orders_timeline() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into order_events (order_id, order_no, event_type, to_value, note, operator_id)
    values (new.id, new.order_no, 'created', new.status, '订单创建', new.created_by);
    return new;
  end if;
  if old.pay_status is distinct from new.pay_status then
    insert into order_events (order_id, order_no, event_type, field, from_value, to_value)
    values (new.id, new.order_no, 'pay_status', 'pay_status', old.pay_status, new.pay_status);
  end if;
  if old.fulfill_status is distinct from new.fulfill_status then
    insert into order_events (order_id, order_no, event_type, field, from_value, to_value)
    values (new.id, new.order_no, 'fulfill_status', 'fulfill_status', old.fulfill_status, new.fulfill_status);
  end if;
  if old.settle_status is distinct from new.settle_status then
    insert into order_events (order_id, order_no, event_type, field, from_value, to_value)
    values (new.id, new.order_no, 'settle_status', 'settle_status', old.settle_status, new.settle_status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_timeline on orders;
create trigger trg_orders_timeline
  after insert or update on orders
  for each row execute function public.gy_orders_timeline();

-- ---------------------------------------------------------------------------
-- 4) 积分：原子增减 + 流水（应用层调用，禁止直接 update customers.points）
-- ---------------------------------------------------------------------------
create or replace function public.gy_apply_points(
  p_customer_id   text,
  p_change        integer,
  p_type          text,
  p_reason        text default null,
  p_ref_no        text default null,
  p_operator_id   text default null,
  p_operator_name text default null
) returns integer
language plpgsql as $$
declare v_balance integer;
begin
  update customers
     set points = greatest(0, points + p_change)
   where id = p_customer_id
  returning points into v_balance;

  if v_balance is null then
    raise exception 'customer % not found', p_customer_id;
  end if;

  insert into points_ledger
    (customer_id, change, balance_after, type, reason, ref_no, operator_id, operator_name)
  values
    (p_customer_id, p_change, v_balance, p_type, p_reason, p_ref_no, p_operator_id, p_operator_name);

  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) 库存：出入库单据是库存唯一合法变动来源
-- ---------------------------------------------------------------------------
create or replace function public.gy_apply_inventory_move(
  p_type            text,
  p_product_id      text,
  p_warehouse_id    text,
  p_qty             integer,
  p_to_warehouse_id text default null,
  p_reason          text default null,
  p_ref_no          text default null,
  p_operator_id     text default null,
  p_operator_name   text default null
) returns text
language plpgsql as $$
declare
  v_before integer;
  v_after  integer;
  v_id     text;
  v_row_id text;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception '数量必须大于 0';
  end if;

  select id, sellable into v_row_id, v_before
    from inventory
   where product_id = p_product_id and warehouse_id = p_warehouse_id
   limit 1;

  if v_row_id is null then
    v_row_id := gen_random_uuid()::text;
    v_before := 0;
    insert into inventory (id, product_id, warehouse_id, sellable, locked, transit, safety_stock)
    values (v_row_id, p_product_id, p_warehouse_id, 0, 0, 0,
            coalesce((select safety_stock from products where id = p_product_id), 0));
  end if;

  if p_type = 'in' then
    v_after := v_before + p_qty;
  elsif p_type in ('out', 'transfer') then
    if v_before < p_qty then
      raise exception '可售库存不足：当前 %，需要 %', v_before, p_qty;
    end if;
    v_after := v_before - p_qty;
  elsif p_type = 'adjust' then
    v_after := p_qty;   -- 盘点：qty 是盘后数量
  else
    raise exception '未知的出入库类型：%', p_type;
  end if;

  update inventory set sellable = v_after, updated_at = now() where id = v_row_id;

  if p_type = 'transfer' then
    if p_to_warehouse_id is null then
      raise exception '调拨必须指定目标仓库';
    end if;
    insert into inventory (id, product_id, warehouse_id, sellable, locked, transit, safety_stock)
    values (gen_random_uuid()::text, p_product_id, p_to_warehouse_id, p_qty, 0, 0,
            coalesce((select safety_stock from products where id = p_product_id), 0))
    on conflict do nothing;

    update inventory
       set sellable = sellable + p_qty, updated_at = now()
     where product_id = p_product_id and warehouse_id = p_to_warehouse_id;
  end if;

  insert into inventory_moves
    (type, product_id, warehouse_id, to_warehouse_id, qty,
     before_sellable, after_sellable, reason, ref_no, operator_id, operator_name)
  values
    (p_type, p_product_id, p_warehouse_id, p_to_warehouse_id, p_qty,
     v_before, v_after, p_reason, p_ref_no, p_operator_id, p_operator_name)
  returning id into v_id;

  return v_id;
end;
$$;

-- 同一 (product, warehouse) 只允许一行库存，否则汇总会重复计数。
create unique index if not exists inventory_product_warehouse_key
  on inventory (product_id, warehouse_id);

-- ---------------------------------------------------------------------------
-- 6) 官网埋点日汇总（Vercel Web Analytics 负责看板，这里负责后台可查询的一方数据）
-- ---------------------------------------------------------------------------
create or replace function public.gy_rollup_web_day(p_date date) returns void
language plpgsql as $$
declare v_from timestamptz := p_date::timestamptz;
        v_to   timestamptz := (p_date + 1)::timestamptz;
begin
  insert into web_analytics_daily as d (
    stat_date, pv, uv, sessions, new_visitors, product_clicks, product_views,
    add_cart, checkouts, orders, paid, inquiries, stay_seconds_total,
    bounce_sessions, updated_at)
  select
    p_date,
    count(*) filter (where event_key = 'page_view'),
    count(distinct visitor_id),
    count(distinct session_id),
    (select count(*) from (
        select visitor_id, min(occurred_at) as first_seen
          from web_events where visitor_id is not null group by visitor_id
      ) f where f.first_seen >= v_from and f.first_seen < v_to),
    count(*) filter (where event_key = 'product_click'),
    count(*) filter (where event_key = 'product_view'),
    count(*) filter (where event_key = 'add_cart'),
    count(*) filter (where event_key = 'checkout'),
    count(*) filter (where event_key = 'order_submit'),
    count(*) filter (where event_key = 'purchase'),
    count(*) filter (where event_key = 'inquiry'),
    coalesce(sum(value) filter (where event_key = 'page_leave'), 0)::bigint,
    -- 跳出会话 = 整个会话只产生了 1 次 page_view。
    -- 这一列原来从未被写入，跳出率恒为 0%，analytics.bounce_alert 阈值形同虚设。
    (select count(*) from (
        select session_id
          from web_events
         where occurred_at >= v_from and occurred_at < v_to
           and event_key = 'page_view' and session_id is not null
         group by session_id having count(*) = 1
      ) b),
    now()
  from web_events
  where occurred_at >= v_from and occurred_at < v_to
  on conflict (stat_date) do update set
    pv = excluded.pv, uv = excluded.uv, sessions = excluded.sessions,
    new_visitors = excluded.new_visitors, product_clicks = excluded.product_clicks,
    product_views = excluded.product_views, add_cart = excluded.add_cart,
    checkouts = excluded.checkouts, orders = excluded.orders, paid = excluded.paid,
    inquiries = excluded.inquiries, stay_seconds_total = excluded.stay_seconds_total,
    bounce_sessions = excluded.bounce_sessions,
    updated_at = now();

  delete from web_page_stats where stat_date = p_date;
  insert into web_page_stats
    (stat_date, page_path, page_title, pv, uv, sessions, stay_seconds_total, bounce_sessions)
  select e.d, e.page_path, e.title, e.pv, e.uv, e.sessions, e.stay, coalesce(b.cnt, 0)
    from (
      select p_date as d, page_path, max(page_title) as title,
             count(*) filter (where event_key = 'page_view') as pv,
             count(distinct visitor_id) as uv,
             count(distinct session_id) as sessions,
             coalesce(sum(value) filter (where event_key = 'page_leave'), 0)::bigint as stay
        from web_events
       where occurred_at >= v_from and occurred_at < v_to and page_path is not null
       group by page_path
    ) e
    left join (
      -- 单页跳出：该会话全程只有 1 次 page_view，且落在这个页面上
      select page_path, count(*) as cnt from (
        select session_id, min(page_path) as page_path
          from web_events
         where occurred_at >= v_from and occurred_at < v_to
           and event_key = 'page_view' and session_id is not null
         group by session_id having count(*) = 1
      ) s group by page_path
    ) b on b.page_path = e.page_path;

  delete from web_traffic_sources where stat_date = p_date;
  insert into web_traffic_sources (stat_date, source_key, visitors, sessions, orders)
  select p_date, coalesce(source, 'direct'),
         count(distinct visitor_id), count(distinct session_id),
         count(*) filter (where event_key = 'purchase')
  from web_events
  where occurred_at >= v_from and occurred_at < v_to
  group by coalesce(source, 'direct');

  delete from web_device_stats where stat_date = p_date;
  insert into web_device_stats (stat_date, device, visitors, sessions)
  select p_date, coalesce(device, 'unknown'),
         count(distinct visitor_id), count(distinct session_id)
  from web_events
  where occurred_at >= v_from and occurred_at < v_to
  group by coalesce(device, 'unknown');

  delete from web_region_stats where stat_date = p_date and region_type = 'city';
  insert into web_region_stats (stat_date, region_key, region_type, visitors, clicks, orders)
  select p_date, city, 'city',
         count(distinct visitor_id),
         count(*) filter (where event_key = 'product_click'),
         count(*) filter (where event_key = 'purchase')
  from web_events
  where occurred_at >= v_from and occurred_at < v_to and city is not null
  group by city;

  delete from web_product_stats where stat_date = p_date;
  insert into web_product_stats (stat_date, product_id, impressions, clicks, views, add_cart, orders, paid)
  select p_date, product_id,
         count(*) filter (where event_key = 'product_impression'),
         count(*) filter (where event_key = 'product_click'),
         count(*) filter (where event_key = 'product_view'),
         count(*) filter (where event_key = 'add_cart'),
         count(*) filter (where event_key = 'order_submit'),
         count(*) filter (where event_key = 'purchase')
  from web_events
  where occurred_at >= v_from and occurred_at < v_to and product_id is not null
  group by product_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) 有效价格解析：SKU × 档位 × 数量 × 时间 → 单价
--    未维护单品价时回落到「零售价 × price_tiers.default_factor」（倍率可后台调整）。
-- ---------------------------------------------------------------------------
create or replace function public.gy_effective_price(
  p_product_id text,
  p_tier_code  text,
  p_qty        integer default 1,
  p_at         timestamptz default now()
) returns numeric
language sql stable as $$
  with tier as (
    select id, default_factor from price_tiers where code = p_tier_code and is_active
  )
  select coalesce(
    (select pp.price
       from product_prices pp
       join tier t on t.id = pp.tier_id
      where pp.product_id = p_product_id
        and pp.is_active
        and pp.min_qty <= greatest(p_qty, 1)
        and pp.valid_from <= p_at
        and (pp.valid_to is null or pp.valid_to > p_at)
      order by pp.min_qty desc, pp.valid_from desc
      limit 1),
    (select round(p.price * coalesce((select default_factor from tier), 1), 2)
       from products p where p.id = p_product_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- 8) 净实收视图：amount_received − 累计退款（原来在 3 个组件里各算一遍）
-- ---------------------------------------------------------------------------
create or replace view order_finance_view as
select
  o.id,
  o.order_no,
  o.amount,
  o.amount_received,
  coalesce(r.refunded, 0)                        as refunded,
  o.amount_received - coalesce(r.refunded, 0)    as net_received,
  coalesce(p.fee, 0)                             as fee
from orders o
left join (
  select order_no, sum(actual_amount) as refunded
    from refunds where status in ('success', 'reconciled') group by order_no
) r on r.order_no = o.order_no
left join (
  select order_no, sum(fee) as fee from payments group by order_no
) p on p.order_no = o.order_no;

commit;

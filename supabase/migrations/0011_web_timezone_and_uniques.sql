-- =====================================================================
-- 0011：官网数据的日切时区、窗口去重、补算入口与采集健康度
--
-- 这一版修的是数据审计查出来的四类问题：
--
-- 1) 日切错位。gy_rollup_web_day 用 p_date::timestamptz，在 Supabase 默认
--    会话时区（UTC）下按 UTC 零点切天；而前台每一处日期都用
--    businessDateKey(analytics.tz_offset_hours)，默认 UTC+8。同一批事件
--    在两种算法下有三成落在不同的天里 —— 标着「9月10日」的那一行，
--    装的其实是北京时间 9/10 08:00 → 9/11 08:00。
--    现在日切统一读 app_settings.analytics.tz_offset_hours。
--
-- 2) 分布面板按天相加。来源 / 设备 / 地域 / 页面的 visitors 是逐日
--    count(distinct visitor_id) 再由应用层相加，回访客按天重复计数，
--    结果同一页上「独立访客 150」旁边挂着「来源合计 386」。
--    新增 gy_web_dimension_uniques()，按窗口整体去重。
--
-- 3) new_visitors 全表扫描。原来的子查询对整张 web_events 做
--    group by visitor_id 求 min(occurred_at)，不带任何时间条件，
--    而这个汇总函数在**每一次**埋点上报时都会跑一遍。
--
-- 4) 历史日永远不会被重算，且汇总失败被静默吞掉 —— 采集端点是唯一调用点，
--    参数写死「今天」。新增 gy_rollup_web_range() 和 web_rollup_runs 日志表。
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- A. 业务时区与日切
-- ---------------------------------------------------------------------

-- 经营时区偏移。真值在 app_settings 里，SQL 和 TS 读的是同一份配置，
-- 不再各自假设 UTC / UTC+8。
create or replace function public.gy_tz_offset_hours() returns int
language sql stable as $$
  select coalesce(
    (select (value #>> '{}')::numeric from app_settings where key = 'analytics.tz_offset_hours'),
    8
  )::int;
$$;

-- 业务日 p_date 的 [起, 止) 时刻。UTC+8 下 2026-09-10 → 2026-09-09 16:00Z ~ 2026-09-10 16:00Z。
create or replace function public.gy_day_bounds(p_date date)
returns table (v_from timestamptz, v_to timestamptz)
language sql stable as $$
  select ((p_date)::timestamp     - make_interval(hours => public.gy_tz_offset_hours())) at time zone 'UTC',
         ((p_date + 1)::timestamp - make_interval(hours => public.gy_tz_offset_hours())) at time zone 'UTC';
$$;

-- ---------------------------------------------------------------------
-- B. 索引：让 new_visitors 的「首次出现」不再全表扫
-- ---------------------------------------------------------------------
create index if not exists web_events_visitor_time_idx
  on web_events (visitor_id, occurred_at);

-- ---------------------------------------------------------------------
-- C. 窗口去重（覆盖 0010 的 UTC 版本）
-- ---------------------------------------------------------------------
create or replace function public.gy_web_uniques(p_from date, p_to date)
returns table (visitors bigint, sessions bigint)
language sql stable as $$
  select count(distinct e.visitor_id)::bigint,
         count(distinct e.session_id)::bigint
    from web_events e,
         lateral (select * from public.gy_day_bounds(p_from)) a,
         lateral (select * from public.gy_day_bounds(p_to))   b
   where e.occurred_at >= a.v_from
     and e.occurred_at <  b.v_to;
$$;

/**
 * 按维度的窗口去重，**单归因**：窗口内每个访客只算进一个桶。
 *
 * 两层问题都在这里修掉：
 *   a) 原来是应用层把每日 visitors 相加，回访客按天重复计数 ——
 *      同一页上「独立访客 150」旁边挂着「来源合计 386」。
 *   b) 光按窗口去重还不够：一个访客 30 天里可能既从小红书来、又从搜索来，
 *      各维度分别去重之后合计仍然大于独立访客数，占比环形图仍然对不上。
 *      所以这里按**首次触点**把每个访客归到唯一一个桶，
 *      各桶相加正好等于窗口内的独立访客数。
 *
 * clicks / orders 是事件计数（不是访客数），按访客归属的桶累计。
 * p_dim ∈ source | device | city
 */
create or replace function public.gy_web_dimension_uniques(
  p_from date, p_to date, p_dim text
)
returns table (key text, visitors bigint, sessions bigint, clicks bigint, orders bigint)
language sql stable as $$
  with bounds as (
    select (select v_from from public.gy_day_bounds(p_from)) as v_from,
           (select v_to   from public.gy_day_bounds(p_to))   as v_to
  ),
  win as (
    select e.*,
           case p_dim
             when 'source' then coalesce(e.source, 'direct')
             when 'device' then coalesce(e.device, 'unknown')
             when 'city'   then e.city
           end as bucket
      from web_events e, bounds b
     where e.occurred_at >= b.v_from and e.occurred_at < b.v_to
  ),
  -- 每个访客的首次触点决定它归哪个桶
  attributed as (
    select distinct on (visitor_id) visitor_id, bucket
      from win
     where visitor_id is not null and bucket is not null
     order by visitor_id, occurred_at, id
  )
  select a.bucket,
         count(distinct a.visitor_id)::bigint,
         count(distinct w.session_id)::bigint,
         count(*) filter (where w.event_key = 'product_click')::bigint,
         count(*) filter (where w.event_key = 'purchase')::bigint
    from attributed a
    left join win w on w.visitor_id = a.visitor_id
   group by a.bucket;
$$;

-- 页面维度还要停留时长和跳出，单独一个函数（列不一样，不硬塞进上面那个）。
create or replace function public.gy_web_page_uniques(p_from date, p_to date)
returns table (
  page_path text, page_title text, pv bigint, uv bigint,
  sessions bigint, stay_seconds_total bigint, bounce_sessions bigint
)
language sql stable as $$
  with bounds as (
    select (select v_from from public.gy_day_bounds(p_from)) as v_from,
           (select v_to   from public.gy_day_bounds(p_to))   as v_to
  ),
  win as (
    select e.* from web_events e, bounds b
     where e.occurred_at >= b.v_from and e.occurred_at < b.v_to and e.page_path is not null
  ),
  -- 单页跳出：整个会话只产生 1 次 page_view，且落在这个页面上
  bounced as (
    select page_path, count(*)::bigint as cnt from (
      select session_id, min(page_path) as page_path
        from win where event_key = 'page_view' and session_id is not null
       group by session_id having count(*) = 1
    ) s group by page_path
  )
  select w.page_path,
         max(w.page_title),
         count(*) filter (where w.event_key = 'page_view')::bigint,
         count(distinct w.visitor_id)::bigint,
         count(distinct w.session_id)::bigint,
         coalesce(sum(w.value) filter (where w.event_key = 'page_leave'), 0)::bigint,
         coalesce(max(bo.cnt), 0)::bigint
    from win w
    left join bounced bo on bo.page_path = w.page_path
   group by w.page_path;
$$;

-- ---------------------------------------------------------------------
-- D. 汇总运行日志：失败必须留痕，否则数据静默停更没人知道
-- ---------------------------------------------------------------------
create table if not exists web_rollup_runs (
  id          bigserial primary key,
  stat_date   date not null,
  ok          boolean not null,
  error       text,
  duration_ms integer,
  ran_at      timestamptz not null default now()
);
create index if not exists web_rollup_runs_date_idx on web_rollup_runs (stat_date, ran_at desc);
alter table web_rollup_runs enable row level security;
alter table web_rollup_runs force row level security;

-- ---------------------------------------------------------------------
-- E. 日汇总（时区正确版）
-- ---------------------------------------------------------------------
create or replace function public.gy_rollup_web_day(p_date date) returns void
language plpgsql as $$
declare v_from timestamptz;
        v_to   timestamptz;
        v_started timestamptz := clock_timestamp();
begin
  select b.v_from, b.v_to into v_from, v_to from public.gy_day_bounds(p_date) b;

  insert into web_analytics_daily as d (
    stat_date, pv, uv, sessions, new_visitors, product_clicks, product_views,
    add_cart, checkouts, orders, paid, inquiries, stay_seconds_total,
    bounce_sessions, updated_at)
  select
    p_date,
    count(*) filter (where event_key = 'page_view'),
    count(distinct visitor_id),
    count(distinct session_id),
    -- 新访客：窗口内出现过、且全局首次出现就落在窗口里的访客。
    -- 先按窗口收敛到少量 visitor_id，再用 (visitor_id, occurred_at) 索引取各自的
    -- 全局最早时间 —— 原来的写法是对整张表 group by，而这个函数每次上报都会跑。
    (select count(*) from (
        select w.visitor_id
          from web_events w
         where w.occurred_at >= v_from and w.occurred_at < v_to
           and w.visitor_id is not null
         group by w.visitor_id
        having min(w.occurred_at)
             = (select min(w2.occurred_at) from web_events w2 where w2.visitor_id = w.visitor_id)
      ) f),
    count(*) filter (where event_key = 'product_click'),
    count(*) filter (where event_key = 'product_view'),
    count(*) filter (where event_key = 'add_cart'),
    count(*) filter (where event_key = 'checkout'),
    count(*) filter (where event_key = 'order_submit'),
    count(*) filter (where event_key = 'purchase'),
    count(*) filter (where event_key = 'inquiry'),
    coalesce(sum(value) filter (where event_key = 'page_leave'), 0)::bigint,
    -- 跳出会话 = 整个会话只产生了 1 次 page_view
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
  select p_date, page_path, page_title, pv, uv, sessions, stay_seconds_total, bounce_sessions
    from public.gy_web_page_uniques(p_date, p_date);

  delete from web_traffic_sources where stat_date = p_date;
  insert into web_traffic_sources (stat_date, source_key, visitors, sessions, orders)
  select p_date, key, visitors, sessions, orders
    from public.gy_web_dimension_uniques(p_date, p_date, 'source');

  delete from web_device_stats where stat_date = p_date;
  insert into web_device_stats (stat_date, device, visitors, sessions)
  select p_date, key, visitors, sessions
    from public.gy_web_dimension_uniques(p_date, p_date, 'device');

  delete from web_region_stats where stat_date = p_date and region_type = 'city';
  insert into web_region_stats (stat_date, region_key, region_type, visitors, clicks, orders)
  select p_date, key, 'city', visitors, clicks, orders
    from public.gy_web_dimension_uniques(p_date, p_date, 'city');

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

  insert into web_rollup_runs (stat_date, ok, duration_ms)
  values (p_date, true, (extract(epoch from clock_timestamp() - v_started) * 1000)::int);
exception when others then
  insert into web_rollup_runs (stat_date, ok, error, duration_ms)
  values (p_date, false, sqlerrm, (extract(epoch from clock_timestamp() - v_started) * 1000)::int);
  raise;
end;
$$;

-- ---------------------------------------------------------------------
-- F. 补算入口
-- ---------------------------------------------------------------------

/**
 * 重算一段日期。改了时区、修了口径、或者某天的汇总挂掉之后用它补 ——
 * 以前只有采集端点一个调用点、参数写死「今天」，历史日一旦算错就永远错着。
 */
create or replace function public.gy_rollup_web_range(p_from date, p_to date)
returns integer language plpgsql as $$
declare d date; n integer := 0;
begin
  if p_to < p_from then raise exception '结束日期不能早于开始日期'; end if;
  if p_to - p_from > 400 then raise exception '一次最多重算 400 天'; end if;
  d := p_from;
  while d <= p_to loop
    perform public.gy_rollup_web_day(d);
    n := n + 1;
    d := d + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- G. 权限：写数据的函数仍然只给 service_role
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.gy_rollup_web_day(date)',
    'public.gy_rollup_web_range(date,date)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated;', f);
    execute format('grant execute on function %s to service_role;', f);
  end loop;
end $$;

commit;

-- 时区口径变了，历史汇总全部作废，必须重算一次。
select public.gy_rollup_web_range(
  coalesce((select min(occurred_at at time zone 'UTC')::date from web_events), current_date),
  current_date
);

-- =====================================================================
-- 0010 · 两处口径修正
--
-- A. 订单来源不再由下单渠道硬猜
--    原 gy_source_from_channel 把 backend（后台代下单）一律映射成
--    dealer（经销商代下单），把 api（外部系统导入）映射成 wholesale（批发）。
--    运营在后台替一位零售顾客下单，会被记成「经销商代下单」——首页最近订单
--    的来源标签因此长期是错的。
--
--    现在：渠道 1:1 映射到同名来源（backend / offline / api 是新增的诚实取值），
--    只有当这一单确实属于经销商 / 批发客户时，才落到 dealer / wholesale。
--
-- B. 官网独立访客支持窗口去重
--    看板此前把 30 天的每日 UV 直接相加，回访客被重复计数，
--    导致「独立访客」大于「新访客总数」。新增 gy_web_uniques(from, to)
--    直接对 web_events.visitor_id 去重。
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. 来源派生
-- ---------------------------------------------------------------------

-- 渠道 → 来源的直接映射（不再夹带业务判断）
create or replace function public.gy_source_from_channel(p_channel text) returns text
language sql immutable as $$
  select case p_channel
    when 'web_store'    then 'web'
    when 'wechat_store' then 'wechat'
    when 'backend'      then 'backend'
    when 'offline_pos'  then 'offline'
    when 'api'          then 'api'
    else 'web'
  end;
$$;

/**
 * 订单来源：优先反映「这一单是怎么来的」。
 * 只有当客户本身是经销商 / 批发客户时，才覆盖成 dealer / wholesale ——
 * 这是一条基于客户档案的事实，而不是从下单渠道反推的猜测。
 */
create or replace function public.gy_order_source(
  p_channel     text,
  p_order_type  text,
  p_customer_id text
) returns text
language plpgsql stable as $$
declare v_ctype text;
begin
  if p_customer_id is not null then
    select type into v_ctype from customers where id = p_customer_id;
  end if;

  if p_order_type = 'wholesale' or v_ctype = 'wholesale' then
    return 'wholesale';
  end if;
  if p_order_type = 'channel' or v_ctype = 'dealer' then
    return 'dealer';
  end if;
  return public.gy_source_from_channel(p_channel);
end;
$$;

-- 让 BEFORE 触发器改用新的判定
create or replace function public.gy_orders_derive() returns trigger
language plpgsql as $$
begin
  new.pay_status     := coalesce(new.pay_status, 'unpaid');
  new.fulfill_status := coalesce(new.fulfill_status, 'assign');
  new.settle_status  := coalesce(new.settle_status, 'unsettled');

  new.status := public.gy_coarse_order_status(
    new.pay_status, new.fulfill_status, new.settle_status);

  new.source := public.gy_order_source(
    coalesce(new.order_channel, 'web_store'),
    new.order_type,
    new.customer_id);

  if new.pay_status in ('paid', 'partial_refund', 'refunded') and new.paid_at is null then
    new.paid_at := now();
  end if;
  if new.fulfill_status in ('shipped', 'signed') and new.shipped_at is null then
    new.shipped_at := now();
  end if;
  if new.fulfill_status = 'signed' and new.signed_at is null then
    new.signed_at := now();
  end if;
  if new.pay_status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_orders_derive on orders;
create trigger trg_orders_derive
  before insert or update on orders
  for each row execute function public.gy_orders_derive();

-- 新的来源取值补进业务字典
insert into dictionaries (group_key, code, label, color, bg, sort) values
  ('order_source', 'backend', '后台代下单', '#5b6470', '#eef0f2', 8),
  ('order_source', 'offline', '线下门店',   '#b07d18', '#fbf4e3', 9),
  ('order_source', 'api',     'API 导入',   '#4a6fa5', '#eaf0f8', 10)
on conflict (group_key, code) do nothing;

-- 已有行按新口径回填一次
update orders set updated_at = updated_at;

-- ---------------------------------------------------------------------
-- B. 官网独立访客（窗口内去重，而不是每日 UV 相加）
-- ---------------------------------------------------------------------
create or replace function public.gy_web_uniques(p_from date, p_to date)
returns table (visitors bigint, sessions bigint)
language sql stable as $$
  select count(distinct visitor_id)::bigint,
         count(distinct session_id)::bigint
    from web_events
   where occurred_at >= p_from::timestamptz
     and occurred_at <  (p_to + 1)::timestamptz;
$$;

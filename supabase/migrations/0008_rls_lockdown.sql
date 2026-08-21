-- GUIYE 瑰野 — 数据地基（四）：收回 anon 公开读，改为「服务端授权后用 service_role 访问」。
-- Apply AFTER 0007_functions_triggers.sql.
--
-- 0001/0002 给 warehouses…payments/refunds/customers 全部创建了
--   create policy "public read" ... for select using (true)
-- 而 anon key 是随前端一起下发的（NEXT_PUBLIC_）。也就是说：任何人都能直接
-- 读走全部客户 email / phone 与全部支付流水。本迁移把这条路彻底关掉。
--
-- 新的访问模型：
--   * anon / authenticated ：所有业务表 0 条策略 → 全部拒绝（读和写都是）。
--   * service_role         ：绕过 RLS，但只在服务端、且只在 requireAdmin() 之后使用
--                            （见 src/lib/data/db.ts）。应用层是唯一的授权边界。
--   * 视图                 ：显式 security_invoker，避免绕过基表 RLS。

begin;

-- ---------------------------------------------------------------------------
-- 1) 删除所有 "public read" 策略，并对每张业务表启用 RLS（不创建任何策略）
-- ---------------------------------------------------------------------------
do $$
declare t text;
declare tables text[] := array[
  -- 0001 / 0002 已有
  'warehouses','products','inventory','dealers','customers',
  'orders','order_items','shipments','settlements','brand_assets',
  'payments','refunds','admins','admin_audit_logs',
  -- 0006 新增
  'app_settings','dictionaries','product_categories','price_tiers','product_prices',
  'carriers','shipment_events','logistics_webhook_events',
  'payment_gateways','payment_webhook_events','reconciliation_batches',
  'notification_rules','approval_rules','approval_requests',
  'membership_tiers','points_ledger','customer_tags','customer_tag_links',
  'customer_follow_ups','inventory_moves','order_events',
  'web_events','web_event_types','web_analytics_daily','web_page_stats',
  'web_traffic_sources','web_device_stats','web_region_stats','web_product_stats',
  'departments','roles','admin_sessions'
];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table %I enable row level security;', t);
      execute format('alter table %I force row level security;', t);
      execute format('drop policy if exists "public read" on %I;', t);
      execute format('drop policy if exists "public write" on %I;', t);
      execute format('drop policy if exists "authenticated read" on %I;', t);
      -- 明确收回 anon / authenticated 的表级权限（RLS 之外的第二道闸）。
      execute format('revoke all on table %I from anon, authenticated;', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) 视图必须 security_invoker，否则会以视图属主身份绕过基表 RLS
-- ---------------------------------------------------------------------------
alter view inventory_view set (security_invoker = true);
alter view order_finance_view set (security_invoker = true);
revoke all on table inventory_view from anon, authenticated;
revoke all on table order_finance_view from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) 函数：只允许 service_role 执行会写数据的那几个
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.gy_apply_points(text,integer,text,text,text,text,text)',
    'public.gy_apply_inventory_move(text,text,text,integer,text,text,text,text,text)',
    'public.gy_rollup_web_day(date)',
    'public.gy_refresh_customer_stats(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated;', f);
    execute format('grant execute on function %s to service_role;', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) 新建对象的默认权限：不再自动授予 anon / authenticated
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

commit;

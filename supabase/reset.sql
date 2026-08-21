-- =====================================================================
-- GUIYE 瑰野 · 彻底重置（删除全部业务对象）
--
-- ⚠ 这会删掉所有数据，包括真实数据。只在开发 / 重装时使用。
--    只想删示例数据用 supabase/clean_samples.sql。
--
-- 执行后按顺序重新安装：
--   migrations/0001_init.sql
--   migrations/0002_orders_payments_admin.sql
--   migrations/0003_admin_auth_rbac.sql
--   migrations/0004_order_province_suzhou.sql
--   migrations/0005_cleanup_and_time_types.sql
--   migrations/0006_platform_tables.sql
--   migrations/0007_functions_triggers.sql
--   migrations/0008_rls_lockdown.sql
--   seed_reference.sql        ← 字典 / 配置 / 价格档位 / 支付渠道，必装
--   seed_samples.sql          ← 可选：几条示例业务数据
--
-- 注意：auth.users 不在此处删除。若要连管理员登录账号一起清掉，
-- 请在 Supabase 控制台 Authentication → Users 手动删除。
-- =====================================================================

begin;

-- 视图
drop view if exists order_finance_view cascade;
drop view if exists inventory_view cascade;

-- 触发器函数与业务函数
drop function if exists public.gy_touch_updated_at() cascade;
drop function if exists public.gy_orders_derive() cascade;
drop function if exists public.gy_orders_after_change() cascade;
drop function if exists public.gy_orders_timeline() cascade;
drop function if exists public.gy_coarse_order_status(text, text, text) cascade;
drop function if exists public.gy_source_from_channel(text) cascade;
drop function if exists public.gy_refresh_customer_stats(text) cascade;
drop function if exists public.gy_apply_points(text, integer, text, text, text, text, text) cascade;
drop function if exists public.gy_apply_inventory_move(text, text, text, integer, text, text, text, text, text) cascade;
drop function if exists public.gy_rollup_web_day(date) cascade;
drop function if exists public.gy_effective_price(text, text, integer, timestamptz) cascade;
drop function if exists public.gy_next_order_no() cascade;
drop function if exists public.gy_next_move_no() cascade;
drop function if exists public.gy_next_refund_no() cascade;
drop function if exists public.gy_next_approval_no() cascade;
drop function if exists public.gy_safe_ts(text) cascade;
drop function if exists public.gy_safe_date(text) cascade;

-- 序列
drop sequence if exists gy_order_no_seq;
drop sequence if exists gy_move_no_seq;
drop sequence if exists gy_refund_no_seq;
drop sequence if exists gy_appr_no_seq;

-- 表（按依赖倒序；cascade 兜底）
drop table if exists web_product_stats cascade;
drop table if exists web_region_stats cascade;
drop table if exists web_device_stats cascade;
drop table if exists web_traffic_sources cascade;
drop table if exists web_page_stats cascade;
drop table if exists web_analytics_daily cascade;
drop table if exists web_event_types cascade;
drop table if exists web_events cascade;

drop table if exists order_events cascade;
drop table if exists inventory_moves cascade;
drop table if exists customer_follow_ups cascade;
drop table if exists customer_tag_links cascade;
drop table if exists customer_tags cascade;
drop table if exists points_ledger cascade;
drop table if exists membership_tiers cascade;

drop table if exists approval_requests cascade;
drop table if exists approval_rules cascade;
drop table if exists notification_rules cascade;

drop table if exists reconciliation_batches cascade;
drop table if exists payment_webhook_events cascade;
drop table if exists payment_gateways cascade;

drop table if exists logistics_webhook_events cascade;
drop table if exists shipment_events cascade;
drop table if exists carriers cascade;

drop table if exists product_prices cascade;
drop table if exists price_tiers cascade;
drop table if exists product_categories cascade;

drop table if exists dictionaries cascade;
drop table if exists app_settings cascade;

drop table if exists admin_sessions cascade;
drop table if exists admin_audit_logs cascade;
drop table if exists roles cascade;
drop table if exists departments cascade;
drop table if exists admins cascade;

drop table if exists refunds cascade;
drop table if exists payments cascade;
drop table if exists settlements cascade;
drop table if exists shipments cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists customers cascade;
drop table if exists dealers cascade;
drop table if exists inventory cascade;
drop table if exists products cascade;
drop table if exists warehouses cascade;
drop table if exists brand_assets cascade;

-- 0005 之前存在、已被合并进 admins 的重复表
drop table if exists system_users cascade;

commit;

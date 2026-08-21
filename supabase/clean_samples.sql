-- =====================================================================
-- GUIYE 瑰野 · 一键清除示例业务数据（保留参考数据 / 配置 / 字典）
-- 用法：Supabase → SQL Editor → New query → 粘贴 → Run
--
-- 只删除 seed_samples.sql 插入的行（主键以 'sample-' 开头）。
-- 真实数据（不同 ID）与 seed_reference.sql 的配置行都不受影响。
-- =====================================================================
begin;

delete from web_events            where id like 'sample-%';
delete from web_page_stats        where stat_date >= current_date - 30;
delete from web_traffic_sources   where stat_date >= current_date - 30;
delete from web_device_stats      where stat_date >= current_date - 30;
delete from web_region_stats      where stat_date >= current_date - 30;
delete from web_product_stats     where stat_date >= current_date - 30;
delete from web_analytics_daily   where stat_date >= current_date - 30;

delete from shipment_events   where id like 'sample-%';
delete from shipments         where id like 'sample-%';
delete from settlements       where id like 'sample-%';
delete from refunds           where id like 'sample-%';
delete from payments          where id like 'sample-%';
delete from points_ledger     where customer_id like 'sample-%';
delete from customer_tag_links where customer_id like 'sample-%';
delete from customer_follow_ups where customer_id like 'sample-%';
delete from order_events      where order_id like 'sample-%';
delete from order_items       where id like 'sample-%';
delete from orders            where id like 'sample-%';
delete from customers         where id like 'sample-%';
delete from inventory_moves   where id like 'sample-%';
delete from inventory         where id like 'sample-%';
delete from product_prices    where id like 'sample-%';
delete from products          where id like 'sample-%';
delete from warehouses        where id like 'sample-%';

commit;

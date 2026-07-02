-- =====================================================================
-- GUIYE 瑰野 · 只清除示例(假)数据，保留表结构与任何真实数据
-- 用法：Supabase → SQL Editor → New query → 粘贴 → Run
-- 按种子固定 ID 精准删除；真实数据(不同 ID)不受影响。
-- =====================================================================
delete from admins where id in
  ('a-001','a-002','a-003','a-004','a-005','a-006','a-007','a-008','a-009');
delete from payments   where id like 'pt-%';
delete from refunds    where id like 'rf-%';
delete from shipments  where id like 's-0%';
delete from settlements where id like 'f-0%';
delete from order_items where order_id like 'o-%';
delete from orders     where id like 'o-%';
delete from inventory  where id like 'inv-%';
delete from products   where id like 'p-0%';
delete from customers  where id like 'c-0%';
delete from dealers    where id like 'd-0%';
delete from warehouses where id like 'wh-%';
delete from brand_assets where id like 'b-0%';
delete from system_users where id like 'u-0%';

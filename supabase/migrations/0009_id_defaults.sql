-- =====================================================================
-- 0009 · 给早期表的主键补默认值
--
-- 0001 / 0002 建的 13 张业务表，主键都是 `id text primary key` 且**没有
-- 默认值** —— 当时所有行都由种子 SQL 显式给 id（'c-001'、'o-001'…），
-- 所以从没暴露过问题。
--
-- 现在这些表由后台的 Server Action 写入，而 action 不会自己造 id，于是
-- 「新建客户 / 新建订单 / 新建商品 / 新增仓库 / 登记发货 / 登记收款 /
-- 发起退款」全部会以
--     null value in column "id" ... violates not-null constraint
-- 失败。端到端测试在浏览器里点「创建客户」时抓到了这个错误。
--
-- 0006 之后新建的表本来就带 gen_random_uuid()::text 默认值，这里把早期
-- 表拉齐。已有数据的 id 不受影响。
-- =====================================================================

create extension if not exists pgcrypto;

do $$
declare t text;
begin
  foreach t in array array[
    'admins', 'brand_assets', 'customers', 'dealers', 'inventory',
    'order_items', 'orders', 'payments', 'products', 'refunds',
    'settlements', 'shipments', 'warehouses'
  ] loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t
         and column_name = 'id' and column_default is null
    ) then
      execute format('alter table public.%I alter column id set default gen_random_uuid()::text;', t);
    end if;
  end loop;
end $$;

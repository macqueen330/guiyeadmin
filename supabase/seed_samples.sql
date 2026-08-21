-- GUIYE 瑰野 — 示例业务数据（可选，随时可删）
-- 所有行的主键都以 'sample-' 开头，用 supabase/clean_samples.sql 一键清除。
--
-- 这些数据存在 Supabase 里，不是代码里的常量：删掉之后界面会显示真实的空态，
-- 而不是回退到假数据。用法：
--   0005 → 0006 → 0007 → 0008 → seed_reference.sql → 本文件
--
-- 依赖：seed_reference.sql（price_tiers / product_categories / membership_tiers /
--       carriers / payment_gateways 必须已存在）。

begin;

-- ---------------------------------------------------------------------------
-- 仓库
-- ---------------------------------------------------------------------------
insert into warehouses (id, name, code, region, address, contact, phone, type, is_active, sort) values
  ('sample-wh-sz', '苏州仓',     'CN-SZ', '中国', '江苏省苏州市工业园区示例路 1 号', '仓储部', '+86 512 0000 0000', 'own', true, 1),
  ('sample-wh-sh', '上海保税仓', 'CN-SH', '中国', '上海市外高桥保税区示例路 8 号',   '仓储部', '+86 21 0000 0000',  'bonded', true, 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 商品 + 多档价格 + 库存
-- ---------------------------------------------------------------------------
insert into products (id, sku_code, name, category, category_id, price, cost, safety_stock, status, unit, spec, tax_rate, sort)
select v.id, v.sku, v.name, v.cat, c.id, v.price, v.cost, v.safety, 'active', '瓶', v.spec, 0.13, v.sort
from (values
  ('sample-p-1','GY-MJ-500',  '瑰野·桂花酿米酒 500ml',   '米酒',   'rice_wine',  168, 72,  800, '500ml · 12%vol', 1),
  ('sample-p-2','GY-YM-750',  '瑰野·杨梅果酒 750ml',     '果酒',   'fruit_wine', 218, 94,  500, '750ml · 11%vol', 2),
  ('sample-p-3','GY-QM-GIFT', '瑰野·青梅清酒礼盒',       '礼盒',   'gift_set',   458, 196, 400, '2 瓶装礼盒',      3),
  ('sample-p-4','GY-LZ-RG',   '瑰野·荔枝玫瑰利口酒',     '利口酒', 'liqueur',    256, 108, 350, '500ml · 18%vol', 4)
) as v(id, sku, name, cat, cat_code, price, cost, safety, spec, sort)
join product_categories c on c.code = v.cat_code
on conflict (id) do nothing;

-- 每个 SKU 在每个档位上落一条真实价格行（不再靠「零售价 × 倍率」渲染时现算）。
insert into product_prices (id, product_id, tier_id, price, currency, min_qty, valid_from)
select
  'sample-pp-' || p.id || '-' || t.code,
  p.id, t.id,
  round(p.price * t.default_factor, 2),
  'CNY', 1, now() - interval '60 days'
from products p
cross join price_tiers t
where p.id like 'sample-p-%'
on conflict (id) do nothing;

-- 企业采购档加一条阶梯量价：满 50 瓶再降 5%。
insert into product_prices (id, product_id, tier_id, price, currency, min_qty, valid_from)
select 'sample-pp-bulk-' || p.id, p.id, t.id, round(p.price * t.default_factor * 0.95, 2), 'CNY', 50, now() - interval '60 days'
from products p cross join price_tiers t
where p.id like 'sample-p-%' and t.code = 'enterprise'
on conflict (id) do nothing;

insert into inventory (id, product_id, warehouse_id, sellable, locked, transit, safety_stock) values
  ('sample-inv-1','sample-p-1','sample-wh-sz', 1840, 120, 300, 800),
  ('sample-inv-2','sample-p-2','sample-wh-sz',  420,  60, 200, 500),
  ('sample-inv-3','sample-p-3','sample-wh-sz',  960,  80, 120, 400),
  ('sample-inv-4','sample-p-4','sample-wh-sz',  260,  40,  90, 350),
  ('sample-inv-5','sample-p-1','sample-wh-sh',  620,  30, 150, 300),
  ('sample-inv-6','sample-p-3','sample-wh-sh',  180,  20,  60, 200)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 客户（orders_count / total_spent / last_order_at / tier_id 由触发器汇总，此处留空）
-- ---------------------------------------------------------------------------
insert into customers
  (id, name, country, email, phone, type, level, orders_count, total_spent,
   province, city, source, status, last_contacted_at, created_at)
values
  ('sample-c-1','示例客户 · 林晚晴','中国 CN','sample.lin@example.com','+86 138 0000 0001','individual','普通',0,0,'上海','上海','xhs','active',      now() - interval '3 days',  now() - interval '120 days'),
  ('sample-c-2','示例客户 · 周慕白','中国 CN','sample.zhou@example.com','+86 159 0000 0002','individual','新客',0,0,'江苏','苏州','wechat','active',   now() - interval '15 days', now() - interval '25 days'),
  ('sample-c-3','示例客户 · 陈思远','中国 CN','sample.chen@example.com','+86 137 0000 0003','individual','普通',0,0,'浙江','杭州','referral','active', now() - interval '1 days',  now() - interval '300 days'),
  ('sample-c-4','Sample Co. Ltd','新加坡 SG','sample.biz@example.com','+65 8000 0004','wholesale','普通',0,0,null,null,'fair','active',              now() - interval '9 days',  now() - interval '210 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 订单（status / source / paid_at 由 0007 的触发器派生，不手写）
-- ---------------------------------------------------------------------------
insert into orders
  (id, order_no, customer_id, customer_name, country, province, city,
   order_type, order_channel, customer_source, payment_method,
   warehouse_id, ship_from, currency,
   goods_amount, freight_fee, discount, amount, amount_received,
   pay_status, fulfill_status, settle_status, created_at)
values
  ('sample-o-1','GY-SAMPLE-0001','sample-c-1','示例客户 · 林晚晴','中国 CN','上海','上海',
   'retail','web_store','xhs','wechat_pay','sample-wh-sz','苏州仓','CNY',
   336, 12, 0, 348, 348, 'paid','signed','settled',      now() - interval '18 days'),

  ('sample-o-2','GY-SAMPLE-0002','sample-c-2','示例客户 · 周慕白','中国 CN','江苏','苏州',
   'retail','wechat_store','wechat','alipay','sample-wh-sz','苏州仓','CNY',
   458, 0, 20, 438, 438, 'partial_refund','signed','reconciling', now() - interval '11 days'),

  ('sample-o-3','GY-SAMPLE-0003','sample-c-3','示例客户 · 陈思远','中国 CN','浙江','杭州',
   'retail','web_store','referral','unionpay','sample-wh-sz','苏州仓','CNY',
   474, 15, 0, 489, 489, 'paid','shipped','reconciling',  now() - interval '4 days'),

  ('sample-o-4','GY-SAMPLE-0004','sample-c-4','Sample Co. Ltd','新加坡 SG',null,null,
   'enterprise','api','fair','credit_term','sample-wh-sh','上海保税仓','CNY',
   9160, 260, 400, 9020, 0, 'unpaid','prep','unsettled',  now() - interval '2 days'),

  ('sample-o-5','GY-SAMPLE-0005','sample-c-1','示例客户 · 林晚晴','中国 CN','上海','上海',
   'retail','web_store','xhs','wechat_pay','sample-wh-sz','苏州仓','CNY',
   168, 12, 0, 180, 0, 'unpaid','assign','unsettled',     now() - interval '6 hours')
on conflict (id) do nothing;

insert into order_items (id, order_id, product_id, product_name, sku_code, qty, price, cost) values
  ('sample-oi-1','sample-o-1','sample-p-1','瑰野·桂花酿米酒 500ml','GY-MJ-500', 2, 168, 72),
  ('sample-oi-2','sample-o-2','sample-p-3','瑰野·青梅清酒礼盒',   'GY-QM-GIFT',1, 458, 196),
  ('sample-oi-3','sample-o-3','sample-p-2','瑰野·杨梅果酒 750ml', 'GY-YM-750', 1, 218, 94),
  ('sample-oi-4','sample-o-3','sample-p-4','瑰野·荔枝玫瑰利口酒', 'GY-LZ-RG',  1, 256, 108),
  ('sample-oi-5','sample-o-4','sample-p-1','瑰野·桂花酿米酒 500ml','GY-MJ-500',50, 126, 72),
  ('sample-oi-6','sample-o-4','sample-p-3','瑰野·青梅清酒礼盒',   'GY-QM-GIFT',8, 342.5, 196),
  ('sample-oi-7','sample-o-5','sample-p-1','瑰野·桂花酿米酒 500ml','GY-MJ-500', 1, 168, 72)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 支付流水 + 退款
-- ---------------------------------------------------------------------------
insert into payments
  (id, order_no, txn_no, method, merchant_no, gateway_id,
   amount_due, amount_paid, fee, fee_rate, pay_status, paid_at, arrived, settle_status, refunded)
select v.id, v.order_no, v.txn_no, v.method, coalesce(g.merchant_no, '—'), g.id,
       v.due, v.paid, round(v.paid * coalesce(g.fee_rate, 0), 2), coalesce(g.fee_rate, 0),
       v.pay_status, v.paid_at, v.arrived, v.settle, v.refunded
from (values
  ('sample-pt-1','GY-SAMPLE-0001','WX-SAMPLE-0001','wechat_pay', 348::numeric, 348::numeric,'paid',          now() - interval '18 days', true,  'settled',     0::numeric),
  ('sample-pt-2','GY-SAMPLE-0002','ALI-SAMPLE-0002','alipay',    438::numeric, 438::numeric,'partial_refund',now() - interval '11 days', true,  'reconciling', 100::numeric),
  ('sample-pt-3','GY-SAMPLE-0003','UP-SAMPLE-0003','unionpay',   489::numeric, 489::numeric,'paid',          now() - interval '4 days',  true,  'reconciling', 0::numeric),
  ('sample-pt-4','GY-SAMPLE-0004','TERM-SAMPLE-0004','credit_term',9020::numeric, 0::numeric,'unpaid',       null,                       false, 'unsettled',   0::numeric),
  ('sample-pt-5','GY-SAMPLE-0005','WX-SAMPLE-0005','wechat_pay', 180::numeric, 0::numeric,'unpaid',          null,                       false, 'unsettled',   0::numeric)
) as v(id, order_no, txn_no, method, due, paid, pay_status, paid_at, arrived, settle, refunded)
left join payment_gateways g on g.provider = v.method
on conflict (id) do nothing;

insert into refunds
  (id, order_no, refund_no, origin_txn_no, method, applied_amount, actual_amount,
   reason, operator, applied_at, arrived_at, partial, status)
values
  ('sample-rf-1','GY-SAMPLE-0002','RF-SAMPLE-0001','ALI-SAMPLE-0002','alipay',
   100, 100, '外包装轻微磕碰 · 部分补偿', '系统示例',
   now() - interval '9 days', now() - interval '9 days' + interval '20 minutes', true, 'success')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 物流单 + 轨迹（承运商 API 尚未接入，来源标 manual）
-- ---------------------------------------------------------------------------
insert into shipments
  (id, order_id, order_no, carrier_id, carrier, tracking_no, destination, status,
   exception, warehouse_id, freight_cost, shipped_at, delivered_at)
select v.id, v.order_id, v.order_no, c.id, c.name, v.tracking, v.dest, v.status,
       v.exc, v.wh, v.cost, v.shipped, v.delivered
from (values
  ('sample-s-1','sample-o-1','GY-SAMPLE-0001','sf','SF-SAMPLE-1000001','上海市','delivered', null,               'sample-wh-sz', 12::numeric, now() - interval '17 days', now() - interval '16 days'),
  ('sample-s-2','sample-o-2','GY-SAMPLE-0002','zto','ZT-SAMPLE-2000002','江苏省苏州市','delivered', null,        'sample-wh-sz', 0::numeric,  now() - interval '10 days', now() - interval '9 days'),
  ('sample-s-3','sample-o-3','GY-SAMPLE-0003','sf','SF-SAMPLE-1000003','浙江省杭州市','in_transit', null,        'sample-wh-sz', 15::numeric, now() - interval '3 days',  null)
) as v(id, order_id, order_no, carrier_code, tracking, dest, status, exc, wh, cost, shipped, delivered)
join carriers c on c.code = v.carrier_code
on conflict (id) do nothing;

insert into shipment_events (id, shipment_id, occurred_at, status, location, description, source) values
  ('sample-se-1','sample-s-3', now() - interval '3 days',  'preparing',  '苏州仓',     '已出库',       'manual'),
  ('sample-se-2','sample-s-3', now() - interval '2 days',  'in_transit', '苏州转运中心','已发往杭州',   'manual'),
  ('sample-se-3','sample-s-3', now() - interval '20 hours','in_transit', '杭州转运中心','到达目的城市', 'manual')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 财务结算单
-- ---------------------------------------------------------------------------
insert into settlements (id, ref_no, type, party, amount, status, due_date, created_at, currency) values
  ('sample-f-1','RCV-SAMPLE-0001','receivable','Sample Co. Ltd', 9020, 'pending', (current_date + 28), now() - interval '2 days','CNY'),
  ('sample-f-2','RFD-SAMPLE-0001','refund','示例客户 · 周慕白',    100, 'paid',    (current_date - 9),  now() - interval '9 days','CNY')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 积分流水（消费 1 元 = 0.1 分，比例来自 membership_tiers，不是代码里的 /10）
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select o.customer_id, o.order_no, o.amount_received
      from orders o
     where o.id like 'sample-o-%' and o.pay_status in ('paid','partial_refund')
  loop
    if not exists (select 1 from points_ledger where ref_no = r.order_no) then
      perform public.gy_apply_points(
        r.customer_id,
        floor(r.amount_received * coalesce(
          (select points_per_currency from membership_tiers where code = 'new'), 0.1))::int,
        'earn', '订单消费获得积分', r.order_no, null, '系统');
    end if;
  end loop;
end $$;

-- 客户标签样例
insert into customer_tag_links (customer_id, tag_id)
select 'sample-c-1', id from customer_tags where name = '复购客'
on conflict do nothing;
insert into customer_tag_links (customer_id, tag_id)
select 'sample-c-4', id from customer_tags where name = '高价值'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 官网埋点：近 30 天的一方数据。页面浏览同时上报给 Vercel Web Analytics，
-- 这里存的是后台可查询、可聚合的明细，日汇总由 gy_rollup_web_day() 生成。
-- ---------------------------------------------------------------------------
insert into web_events
  (id, event_key, occurred_at, visitor_id, session_id, page_path, page_title,
   product_id, source, device, country, province, city, value)
select
  'sample-we-' || d || '-' || g,
  case
    when g <= 20 then 'page_view'
    when g <= 26 then 'product_impression'
    when g <= 31 then 'product_click'
    when g <= 34 then 'product_view'
    when g <= 36 then 'add_cart'
    when g = 37  then 'checkout'
    when g = 38  then 'order_submit'
    when g = 39  then 'purchase'
    else 'inquiry'
  end,
  (current_date - d)::timestamptz + make_interval(hours => 8 + (g % 12)),
  'sample-v-' || ((d * 7 + g) % 260),
  'sample-s-' || d || '-' || (g % 9),
  (array['/','/products','/products/osmanthus','/story','/contact'])[1 + ((d + g) % 5)],
  (array['首页','产品','桂花酿米酒','品牌故事','联系我们'])[1 + ((d + g) % 5)],
  case when g between 21 and 39
       then (array['sample-p-1','sample-p-2','sample-p-3','sample-p-4'])[1 + (g % 4)] end,
  (array['wechat','xhs','direct','search','instagram','fair'])[1 + ((d * 3 + g) % 6)],
  (array['mobile','mobile','mobile','desktop','tablet'])[1 + (g % 5)],
  '中国 CN',
  (array['江苏','上海','北京','浙江','广东','四川'])[1 + ((d + g) % 6)],
  (array['苏州','上海','北京','杭州','广州','成都'])[1 + ((d + g) % 6)],
  case when g <= 20 then 30 + ((d * g) % 210) end
from generate_series(0, 29) as d,
     generate_series(1, 40) as g
on conflict (id) do nothing;

-- 生成日汇总（PV / UV / 来源 / 设备 / 地域 / 单品漏斗）
do $$
declare d int;
begin
  for d in 0..29 loop
    perform public.gy_rollup_web_day((current_date - d)::date);
  end loop;
end $$;

commit;

-- GUIYE 瑰野 — 订单国内省市字段 + 中国仓库改为苏州仓。
-- Apply AFTER 0003_admin_auth_rbac.sql.

-- 1) 订单可记录国内省 / 市（海外订单留空）。
alter table orders add column if not exists province text;

-- 2) 中国仓库统一为「苏州仓」（原「中国总部仓 · 杭州」）。对已有数据做一次性订正。
update warehouses set name = '苏州仓', code = 'CN · 苏州' where id = 'wh-cn';
update orders set ship_from = '苏州仓' where ship_from = '中国总部仓';

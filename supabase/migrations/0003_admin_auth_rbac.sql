-- GUIYE 瑰野 — 管理员系统：登录鉴权 + RBAC 落地 + 操作/登录日志。
-- Apply AFTER 0002_orders_payments_admin.sql.
--
-- 设计要点：
--  * admins 行通过 user_id 关联 Supabase Auth 的 auth.users（密码由 Auth 托管，不明文存储）。
--  * grants(jsonb) + scope_values(text[]) 让「模块权限 + 数据范围」可持久化、可运行时修改。
--  * session_epoch 支持「强制退出」：自增后旧会话立即失效（应用层校验）。
--  * admin_audit_logs 记录登录日志与操作日志，普通管理员不可删除（无 delete 策略）。
--  * admins / audit 表移除 public read；改由 service_role（服务端授权后）访问，anon/authenticated 默认拒绝。

-- 1) 扩展 admins：关联 Auth、权限、数据范围、安全与生命周期字段。
alter table admins add column if not exists user_id uuid;
alter table admins add column if not exists grants jsonb not null default '{}'::jsonb;
alter table admins add column if not exists scope_values text[] not null default '{}';
alter table admins add column if not exists password_change_required boolean not null default true;
alter table admins add column if not exists two_factor boolean not null default false;
alter table admins add column if not exists failed_attempts integer not null default 0;
alter table admins add column if not exists locked_until timestamptz;
alter table admins add column if not exists session_epoch integer not null default 0;
alter table admins add column if not exists created_by text;
alter table admins add column if not exists deleted_at timestamptz;
alter table admins add column if not exists created_at timestamptz not null default now();
alter table admins add column if not exists updated_at timestamptz not null default now();

create unique index if not exists admins_user_id_key on admins (user_id) where user_id is not null;
create unique index if not exists admins_email_key on admins (lower(email)) where deleted_at is null;

-- 2) 数据范围落地所需的归属字段（自己 / 下属 / 部门等按此过滤）。
alter table orders add column if not exists owner_admin_id text;
alter table customers add column if not exists owner_admin_id text;
create index if not exists orders_owner_idx on orders (owner_admin_id);
create index if not exists customers_owner_idx on customers (owner_admin_id);

-- 3) 审计日志（登录日志 + 操作日志，单表按 category 区分）。
create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  category text not null,          -- auth | operation
  action text not null,            -- login_success | login_fail | logout | create_admin | ...
  actor_id text,
  actor_name text,
  actor_level text,
  target_id text,
  target_name text,
  module text,
  detail text,
  before jsonb,
  after jsonb,
  ip text,
  device text,
  user_agent text,
  result text not null default 'success', -- success | fail | denied
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on admin_audit_logs (created_at desc);
create index if not exists audit_category_idx on admin_audit_logs (category);
create index if not exists audit_actor_idx on admin_audit_logs (actor_id);

-- 4) RLS：敏感表不再对 anon/authenticated 开放；服务端用 service_role 访问并在应用层鉴权。
--    移除 0002 中 admins 的 "public read"。
do $$
begin
  execute 'alter table admins enable row level security';
  execute 'drop policy if exists "public read" on admins';
  -- 不再创建任何 select/insert/update/delete 策略：anon/authenticated 默认全部拒绝，
  -- 仅 service_role（绕过 RLS）可访问。删除同样被拒绝 → 满足「不物理删除 / 不可删日志」。
  execute 'alter table admin_audit_logs enable row level security';
  execute 'drop policy if exists "public read" on admin_audit_logs';
end $$;

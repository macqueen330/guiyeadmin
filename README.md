# GUIYE 瑰野 · 运营控制台

跨境订单 · 渠道 · 商品与库存 · 客户 · 仓储物流 · 财务结算 · 品牌内容 · 数据分析的一体化后台管理系统。
基于 [Claude Design](https://claude.ai/design) 导出的设计稿（`Guiye数据总览.dc.html`）实现，
像素级还原视觉框架，并按「交易管理 / 客户经营 / 品牌运营 / 经营管理」重构信息架构，每个一级模块下设二级菜单。

- **技术栈**：Next.js 16（App Router）· React 19 · TypeScript · Supabase
- **部署**：Vercel（目标域名 `guiye-admin.com`）
- **数据**：Supabase Postgres；未配置时自动回退到内置示例数据，保证随时可构建、可预览

---

## 功能模块

二级菜单通过 `?view=` 切换：侧边栏深链与页内 SubTabs 同步高亮，已建模的子视图为真实筛选，
其余子模块以「结构预留」占位卡呈现（保留信息架构、暂不接入数据）。

| 路由 | 模块（分组） | 二级菜单 | 说明 |
| --- | --- | --- | --- |
| `/` | 首页概览 | — | 任务入口：今日 KPI、今日待办（明确动作）、快捷入口、业务主流程、销售趋势、最近操作/订单 |
| `/orders` · `/orders/[no]` | 订单中心（交易管理） | 全部 / 零售 / 渠道 / 企业采购 / 售后退款 / 发货异常 | 按订单类型分流；「发货异常」联动物流异常运单；订单详情含明细与状态流转 |
| `/inventory` | 商品与库存（交易管理） | 商品管理 / 价格管理 / 库存管理 / 入库出库 / 库存预警 | 价格管理支持官网零售/会员/经销/团购/企业/海外建议多档价格；多仓库存分布 |
| `/logistics` | 仓储物流（交易管理） | 待发货 / 物流跟踪 / 仓库管理 / 异常包裹 | 履约视角的发货与物流追踪、发货仓库分布 |
| `/crm` | 客户中心（客户经营） | 消费者 / 会员 / 客户标签 / 消费记录 | 管理 C 端消费者，与渠道管理（B 端）明确区分 |
| `/channel` | 渠道管理（客户经营） | 渠道客户 / 合作申请 / 跟进记录 / 报价管理 / 样品寄送 / 合同资料 | 通用 CRM 定位，不做分销返佣/层级；合作申请=待审核客户，合同资料含到期/额度 |
| `/brand` | 品牌内容（品牌运营） | 官网内容 / 图片视频 / 宣传资料 / 渠道资料 / 多语言内容 | 官网内容可直接编辑 Banner/产品介绍/品牌故事（中英文），不只是上传文件 |
| `/finance` | 财务结算（经营管理） | 收款 / 退款 / 发票 / 对账 / 应收款 | 从原「物流财务」拆出；回款、应收逾期、退款与对账 |
| `/analytics` | 数据分析（经营管理） | 经营总览 / 消费者分析 / 渠道分析 / 商品分析 | KPI 用「回款」替代毛利率；渠道占比拆为「销售渠道 + 客户来源」两套口径；地区可切换国内省市/海外国家；产品销售排行替代重复的渠道排行 |
| `/settings` | 系统设置 | 安全策略 / 消息通知 / 操作日志 / 商品设置 / 订单规则 | 账号安全、通知开关、操作审计与业务规则（单人使用，不含多级管理员）|

所有列表均支持客户端实时搜索与下拉筛选；侧边栏二级菜单可展开/收起，导航高亮、页面标题随路由切换。

---

## 本地开发

```bash
npm install
cp .env.example .env.local   # 可留空先用示例数据
npm run dev                  # http://localhost:3000
```

未填写 Supabase 变量时，应用使用 `src/lib/mock/data.ts` 中的示例数据（与设计稿数值一致）。

---

## 连接 Supabase（真实数据）

1. 在 [supabase.com](https://supabase.com) 新建项目。
2. 打开 **SQL Editor**，依次执行：
   - `supabase/migrations/0001_init.sql`（基础表 + 视图 + 公开只读 RLS）
   - `supabase/migrations/0002_orders_payments_admin.sql`（订单支付/履约/结算字段 + 支付流水 / 退款 / 管理员表）
   - `supabase/migrations/0003_admin_auth_rbac.sql`（管理员登录鉴权 + 审计日志 + RLS 收紧）
   - `supabase/migrations/0004_order_province_suzhou.sql`（订单国内省市字段 + 中国仓库改为苏州仓）
   - `supabase/seed.sql`（导入示例数据，可选）
3. 在 **Project Settings → API** 复制 `Project URL`、`anon public` key 与 `service_role` key，填入环境变量：

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   # 仅服务端，切勿加 NEXT_PUBLIC_ 前缀
   ```

4. 重启 `npm run dev`。数据层（`src/lib/data/queries.ts`）会自动改用 Supabase，
   查询失败时回退到示例数据。填入 `SUPABASE_SERVICE_ROLE_KEY` 后即启用**真实登录鉴权与管理员系统**
   （详见下方「管理员系统」）；未填写时运行在只读**演示模式**（内置超级管理员身份，便于预览）。

> 重新生成种子 SQL（修改示例数据后）：`npm run gen:seed`

> **说明**：
> - `admins` / `admin_audit_logs` 已通过 `0003` 收紧 RLS（anon/authenticated 一律拒绝），只有服务端 `service_role` 客户端在应用层鉴权后可读写。
> - `payments` / `refunds` 仍为公开只读示例 RLS，接入真实数据前请再改成登录鉴权 + 数据范围策略。
> - 「官网数据」（PV/UV、产品点击、漏斗）目前为示例数据，应由埋点 / 统计管道（自建或 GA / 百度统计 / 神策等）写入后再接管，`src/lib/mock/web.ts` 即替换点。

---

## 登录鉴权（单人使用）

本控制台为**单人（店主本人）使用**：一个超级管理员账号 + 全部权限，不设多级管理员 / 合伙人 / 分权。
填入 `SUPABASE_SERVICE_ROLE_KEY` 后启用真实登录；未填写则为只读演示模式（内置超级管理员身份，便于预览）。
基于 **Supabase Auth**（密码加密托管，系统不存明文）。

### 1. 创建你的登录账号

```bash
npm run admin:create -- --email admin@guiye.com --password 'Guiye2026pass' --name 你的名字
# 需要 .env.local 中的 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY
```

之后访问 `/login` 用该邮箱登录。

### 2. 鉴权与会话（`src/proxy.ts` + `src/lib/auth/`）

- **`src/proxy.ts`**（Next.js 16 已将 `middleware` 更名为 `proxy`，Node 运行时）刷新 Supabase 会话，
  未登录访问任何后台路由 → 统一 302 跳转 `/login?redirect=…`。
- **`src/app/(app)/layout.tsx`** 服务端 `requireAdmin()` 是真正的门禁；仅 `active` 账号可进入。
- **会话保持**：Supabase SSR Cookie，刷新后保持登录。
- **退出登录 / 强制退出 / 30 分钟无操作自动退出**：`signOutAction` / `session_epoch` / `IdleLogout`。
- 校验永远以服务端为准，前端 `Viewer` 仅用于展示。

### 3. 个人中心与审计

- **`/profile` 个人中心**：基本资料 / 账号与权限（只读，展示你拥有全部权限）/ 安全设置（改密码）/ 登录设备 / 个人日志。
- **系统设置**：安全策略 / 消息通知 / 操作日志 / 商品设置 / 订单规则。
- **审计**：`admin_audit_logs` 记录登录成功/失败/退出与关键操作（操作人、时间、IP、设备、前后值），RLS 无 delete 策略。

### 4. 安全

- 连续输错 **5 次锁定账号 30 分钟**（到期自动解锁）。
- 改密码需校验旧密码；密码 ≥8 位且含字母 + 数字，由 Supabase Auth 加密存储。
- 二次验证（2FA）字段已预留（`two_factor`），实际 TOTP / 新设备验证码为后续项。

> **说明**：早期的多级管理员（等级 / 角色模板 / 员工管理 / 审批 / 数据范围）已按“单人使用”移除；
> `admins` 表相关列保留但不再暴露对应界面。

---

## 部署到 Vercel

1. 将本仓库推送到 GitHub（见下方“推送代码”）。
2. 在 [vercel.com](https://vercel.com) → **Add New → Project** 导入该 GitHub 仓库。
   Vercel 会自动识别 Next.js，无需额外配置。
3. 在 **Settings → Environment Variables** 添加：
   `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、
   `SUPABASE_SERVICE_ROLE_KEY`（务必设为**非公开**的服务端变量，切勿加 `NEXT_PUBLIC_` 前缀）、
   `NEXT_PUBLIC_SITE_URL=https://guiye-admin.com`
4. **Deploy**。

### 推送代码

```bash
git remote add origin https://github.com/<你的账号>/guiye-admin.git
git push -u origin feat/guiye-dashboard   # 或合并到 main 后推送
```

---

## 绑定域名 guiye-admin.com

> ⚠️ 这一步需要在**你自己的 Vercel 账号**和**域名注册商后台**完成（我无法代你登录操作）。
> 流程不超过 5 分钟：

1. Vercel 项目 → **Settings → Domains** → 输入 `guiye-admin.com` → **Add**。
   建议同时添加 `www.guiye-admin.com`（Vercel 默认会把 www 重定向到主域名）。
2. Vercel 会显示需要配置的 DNS 记录。到你的**域名注册商**（购买 guiye-admin.com 的平台）
   的 DNS 管理页，添加：

   | 类型 | 主机/名称 | 值 |
   | --- | --- | --- |
   | `A` | `@`（根域名） | `76.76.21.21` |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

   > 以 Vercel 仪表盘实际显示的记录为准；部分注册商也可改用 Vercel 提供的
   > Nameservers（`ns1.vercel-dns.com` / `ns2.vercel-dns.com`）整体托管。
3. 保存后等待 DNS 生效（通常几分钟，最长 48 小时）。Vercel 验证通过后会自动签发
   HTTPS 证书，`https://guiye-admin.com` 即可访问。

完成后把 `NEXT_PUBLIC_SITE_URL` 设为 `https://guiye-admin.com` 并重新部署即可。

---

## 项目结构

```
src/
  app/
    layout.tsx              # 根布局（Manrope 字体 + AppShell）
    page.tsx                # 首页概览
    orders/ channel/ ...    # 各业务模块（page.tsx 取数 + *View.tsx 客户端交互）
  components/
    shell/                  # Sidebar / Header / AppShell
    dashboard/              # 首页各区块 + 交互式 TrendChart
    ui/                     # Card / Tag / Button / Icon / DataTable / FilterableTable / StatStrip
  lib/
    types.ts                # 领域模型类型
    tokens.ts               # 状态/来源等配色与格式化
    charts.ts               # 图表几何（移植自设计稿）
    nav.ts                  # 导航与路由元信息
    supabase/               # 浏览器/服务端客户端 + 配置探测
    data/queries.ts         # 数据访问层（Supabase + 示例数据回退）
    mock/data.ts            # 内置示例数据（= seed.sql 来源）
supabase/
  migrations/0001_init.sql  # 表结构 + RLS
  seed.sql                  # 示例数据（由 npm run gen:seed 生成）
design-reference/           # 原始 Claude Design 导出件（设计稿 + 对话记录）
```

---

## 下一步（建议）

- 为创建/编辑按钮接入 Supabase 写入（Server Actions）+ 写策略 / 登录鉴权
- 接入真实业务字段与第三方物流、支付、开票系统
- 报表导出（当前“导出”按钮为占位）

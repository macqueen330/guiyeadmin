# GUIYE 瑰野 · 运营控制台

跨境订单 · 渠道 · 商品库存 · 客户 · 物流财务 · 数据分析的一体化后台管理系统。
基于 [Claude Design](https://claude.ai/design) 导出的设计稿（`Guiye数据总览.dc.html`）实现，
像素级还原首页概览，并扩展出全部业务模块。

- **技术栈**：Next.js 16（App Router）· React 19 · TypeScript · Supabase
- **部署**：Vercel（目标域名 `guiye-admin.com`）
- **数据**：Supabase Postgres；未配置时自动回退到内置示例数据，保证随时可构建、可预览

---

## 功能模块

| 路由 | 模块 | 说明 |
| --- | --- | --- |
| `/` | 首页概览 | KPI、业务主流程、销售趋势图（可切换指标/区间 + hover）、渠道占比环图、待办异常、多仓库存、热销 SKU、最近订单 |
| `/orders` · `/orders/[no]` | 订单中心 | 订单列表（搜索 + 状态/来源筛选）+ 订单详情（商品明细、金额、客户信息、状态流转） |
| `/channel` | 渠道管理 | 经销商档案、等级、本月销售、信用/欠款、合同到期 |
| `/inventory` | 商品库存 | 多仓库存分布图 + 商品 SKU 表（毛利率、安全库存、可售、低库存预警） |
| `/crm` | 客户中心 | 客户档案、类型/等级、累计消费、联系方式 |
| `/logistics` | 物流财务 | 物流追踪（异常件）+ 财务结算（应收/退款/开票/对账） |
| `/brand` | 品牌资料 | 素材库卡片网格（产品图/视频/培训物料/品牌手册），分类筛选 + 搜索 |
| `/analytics` | 数据分析 | 趋势图、渠道占比、地区/渠道销售额、热销 SKU、多仓库存 |
| `/settings` | 系统设置 | 成员与权限、系统偏好（币种/时区/税率/2FA 等） |

所有列表均支持客户端实时搜索与下拉筛选；导航高亮、页面标题随路由切换。

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
   - `supabase/migrations/0001_init.sql`（建表 + 视图 + 公开只读 RLS 策略）
   - `supabase/seed.sql`（导入示例数据，可选）
3. 在 **Project Settings → API** 复制 `Project URL` 与 `anon public` key，填入环境变量：

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```

4. 重启 `npm run dev`。数据层（`src/lib/data/queries.ts`）会自动改用 Supabase，
   查询失败时回退到示例数据。

> 重新生成种子 SQL（修改示例数据后）：`npm run gen:seed`

---

## 部署到 Vercel

1. 将本仓库推送到 GitHub（见下方“推送代码”）。
2. 在 [vercel.com](https://vercel.com) → **Add New → Project** 导入该 GitHub 仓库。
   Vercel 会自动识别 Next.js，无需额外配置。
3. 在 **Settings → Environment Variables** 添加：
   `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、
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

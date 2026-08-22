# GUIYE 瑰野 · 运营控制台

跨境订单 · 商品与库存 · 客户经营 · 仓储物流 · 财务结算 · 品牌内容 · 数据分析的一体化后台。

- **技术栈**：Next.js 16（App Router，`proxy.ts`）· React 19 · TypeScript · Supabase Postgres
- **部署**：Vercel（目标域名 `guiye-admin.com`）
- **数据**：全部来自 Supabase。**没有示例数据回退** —— 数据库里没有的东西，界面显示空态，
  而不是造一份看起来很真的假数据。

---

## 一条重要约定：不造假数据

这套后台此前有大量「看起来是真的，其实是写死的」内容：伪随机趋势图、编造的审计日志、
一律打绿勾的安全策略、未配置时自动登录的演示超管。这些已经全部移除，取而代之的规则是：

| 情况 | 界面表现 |
| --- | --- |
| 表里没有数据 | 空态文案，说明数据从哪来 |
| 能力尚未实现 | 明确标注「规划中」，开关不生效也会说明 |
| 支付 / 物流未配置 | 显示缺哪个环境变量、缺哪一步，不显示「已开通」 |
| 系统未配置数据库 | 登录页显示「系统尚未配置」，**没有任何降级入口** |

| 写入没命中任何行 | 报错并提示刷新，**绝不提示「已保存」** |

写代码时请沿用这条约定。

> 最后一条尤其重要。PostgREST 的 UPDATE / DELETE 命中 0 行时返回 204、
> `error` 是 **null**。只判断 `error` 的写法会在行被 RLS 过滤、被别人删除、
> 或页面开太久 id 失效时谎报成功 —— 症状就是「界面说保存了，数据没变」。
> 所有针对单条记录的写入都必须走 `mustAffect()`（`src/lib/actions/common.ts`）。

---

## 功能模块

侧边栏二级菜单通过 `?view=` 切换，页内 SubTabs 与之同步。

| 路由 | 模块 | 二级菜单 |
| --- | --- | --- |
| `/` | 首页概览 | — （今日 KPI、待办、业务主流程、趋势、最近操作） |
| `/orders` · `/orders/[no]` | 订单中心 | 全部 / 零售 / 渠道 / 企业采购 / 售后退款 / 发货异常 |
| `/inventory` | 商品与库存 | 商品管理 / 价格管理 / 库存管理 / 入库出库 / 库存预警 |
| `/logistics` | 仓储物流 | 待发货 / 物流跟踪 / 仓库管理 / 异常包裹 |
| `/crm` | 客户中心 | 消费者 / 会员 / 客户标签 / 消费记录 |
| `/payments` | 支付管理 | 支付流水 / 支付异常 / 退款管理 / 渠道对账 / 支付配置 |
| `/finance` | 财务结算 | 收款 / 退款 / 发票 / 对账 / 应收款 |
| `/analytics` | 数据分析 | 经营总览 / 官网数据 / 商品分析 / 消费者分析 / 渠道分析 |
| `/brand` | 品牌内容 | 官网内容 / 图片视频 / 宣传资料 / 渠道资料 / 多语言内容 |
| `/settings` | 系统设置 | 安全策略 / 消息通知 / 审批规则 / 业务规则 / 业务字典 / 操作日志 |
| `/search` | 全局搜索 | 顶栏搜索框跳转，覆盖订单号、客户、SKU、运单号 |
| `/profile` | 个人中心 | 基本资料 / 账号与权限 / 安全设置 / 登录设备 / 个人日志 |

---

## 本地开发

```bash
npm install
cp .env.example .env.local     # 三项 Supabase 变量必填，否则无法登录
npm run dev                    # http://localhost:3000

npm run typecheck              # tsc --noEmit
npm run lint
npm run build
npm run db:check               # 校验表 / 函数 / 时间列类型，并确认 anon 已被 RLS 挡住
```

---

## 初始化数据库

在 Supabase → **SQL Editor** 里**按顺序**执行：

| 顺序 | 文件 | 内容 |
| --- | --- | --- |
| 1 | `supabase/migrations/0001_init.sql` | 基础表 + 视图 |
| 2 | `supabase/migrations/0002_orders_payments_admin.sql` | 订单履约 / 支付 / 退款 / 管理员 |
| 3 | `supabase/migrations/0003_admin_auth_rbac.sql` | 登录鉴权 + 审计日志 |
| 4 | `supabase/migrations/0004_order_province_suzhou.sql` | 订单省市字段 |
| 5 | `supabase/migrations/0005_cleanup_and_time_types.sql` | **删除历史写死的示例账号 / 订单 / 客户**；文本时间列改为 `timestamptz`；补齐约 60 个业务字段 |
| 6 | `supabase/migrations/0006_platform_tables.sql` | 配置、字典、价格档位、承运商、支付渠道、审批、积分、官网埋点等约 30 张表 |
| 7 | `supabase/migrations/0007_functions_triggers.sql` | 单号序列、订单状态派生、客户统计、积分、库存流水、官网日汇总、`order_finance_view` |
| 8 | `supabase/migrations/0008_rls_lockdown.sql` | **收紧 RLS**：anon / authenticated 对所有业务表 0 条策略 |
| 9 | `supabase/migrations/0009_id_defaults.sql` | **必须执行**：给 0001/0002 建的 13 张表补主键默认值。不执行则「新建客户 / 新建订单 / 新建商品 / 新增仓库 / 登记发货 / 登记收款 / 发起退款」全部会因 `id` 非空约束失败 |
| 10 | `supabase/migrations/0010_source_and_web_uniques.sql` | 订单来源不再由下单渠道硬猜（后台代下单不再被记成经销商）；新增 `gy_web_uniques()` 供官网独立访客窗口去重 |
| 11 | `supabase/seed_reference.sql` | **必须执行**：字典、系统配置、价格档位、会员等级、支付渠道、承运商、审批规则、角色等基础配置 |
| 12 | `supabase/seed_samples.sql` | **可选**：几条演示用的商品 / 客户 / 订单 / 支付 / 运单 + 30 天官网埋点，全部以 `sample-` 开头 |

- 样例数据随时可以清掉：执行 `supabase/clean_samples.sql`（只删 `sample-%`，真实数据不受影响）。
- 需要彻底重来：`supabase/reset.sql`（**会删掉所有表**）。

> 第 9、11 步不是可选的。字典、审批阈值、支付渠道、承运商这些「配置类」数据以前写死在
> TypeScript 里，现在都在数据库中，不导入界面会大面积空白。

---

## 环境变量

完整清单与说明见 `.env.example`。必填三项：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...     # 仅服务端，切勿加 NEXT_PUBLIC_ 前缀
```

缺任意一项：`/login` 显示「系统尚未配置」，所有后台路由被 `proxy.ts` 拦截。
**不存在**「未配置就以超级管理员身份进入」这种降级路径。

可选：支付（微信 / 支付宝 / 银联）、物流承运商、官网埋点上报的密钥，见 `.env.example`。
密钥**从不入库** —— `payment_gateways.credential_env` 与 `carriers.api_credential_env`
里存的是变量名，值只存在于运行环境。

---

## 登录、权限与审计

### 创建第一个管理员

```bash
npm run admin:create -- --email admin@guiye.com --name 你的名字 --level L1
# 默认生成一个随机强密码并打印一次（只打印这一次）；也可以：
#   --password-stdin   从标准输入读取密码
#   --reactivate       重新启用一个已停用的账号
```

脚本不会静默重置已存在账号的密码，也会把这次创建写进 `admin_audit_logs`。

### 权限模型

- **等级**：L1（超级管理员，拥有全部权限）/ L2 / L3。
- **模块 × 动作授权**：`admins.grants`，或通过 `roles` 表按角色下发（角色改名不会丢权限）。
- **数据范围**：`scope`（all / region / dept / warehouse / subordinate / self）。
- 服务端是唯一的授权边界：页面用 `requireModule()`，Server Action 用 `assertCan()`；
  侧边栏隐藏链接只是 UX。

### 会话与安全

- `src/proxy.ts`（Next.js 16 里 `middleware` 已更名为 `proxy`）刷新 Supabase 会话并拦截未登录访问。
- `session_epoch` + httpOnly Cookie：一键强制下线其它设备，旧 Cookie 立即失效。
- 登录会话记录在 `admin_sessions`（设备 / IP / 登录时间 / 注销时间），个人中心可见可撤销。
- 锁定次数、锁定时长、空闲退出、会话时长、密码强度、脱敏等级、导出审批阈值
  全部存在 `app_settings.security.*`，系统设置页可改，登录页 / 个人中心 / 安全策略页读的是同一份。
- 安全策略页对每条策略标注真实状态（**已生效 / 已关闭 / 规划中**）。
  短信验证码与 TOTP 尚未接入，界面明确写「规划中」，不打对勾。

### 审计

`admin_audit_logs` 记录登录成功 / 失败 / 退出与全部关键写操作（操作人、等级、时间、IP、设备、前后值）。
没有记录就显示空态 —— 不会用示例日志填充。

---

## 支付接入（预留接口，已实现验签）

三个在线渠道的**回调验签与解密已经实现**，这是资金安全的关键；下单 / 退款接口需要真实商户
资质才能联调，因此保留为「配置齐全才可用」，缺配置时抛错并在界面上说明缺什么。

| 渠道 | 回调地址 | 已实现 |
| --- | --- | --- |
| 微信支付 V3 | `/api/pay/wechat_pay/notify` | SHA256withRSA 验签 + `resource` 的 AES-256-GCM 解密 |
| 支付宝 | `/api/pay/alipay/notify` | RSA2 排序验签 |
| 银联 5.1.0 | `/api/pay/unionpay/notify` | SHA-256 摘要 + RSA 验签 |
| 银行转账 / 线下收款 / 账期 | — | 人工登记，无需接口 |

回调统一走 `storeWebhookEvent()` + `applyPaymentNotification()`：先落 `payment_webhook_events`
做幂等，验签不通过直接拒绝，金额对不上标记 `pay_exception` 而不是照单入账。

渠道在 `/payments?view=config` 里配置，状态（未开通 / 已开通）与联调状态都是数据库里的真实值。

## 物流接入（预留接口）

`carriers.api_provider` 决定一家承运商怎么走：

- `NULL` —— 人工录单（默认）。界面显示「人工录单」，不会假装能自动同步。
- `http` —— 通用 REST 适配器，请求方式与字段映射写在 `carriers.api_config`（JSON 指针），
  无需为每家承运商写代码。

承运商推送走 `/api/logistics/{code}/webhook`，HMAC-SHA256 验签（`timingSafeEqual`），
轨迹写入 `shipment_events` 并按 `externalId` 去重。

---

## 数据分析

- **后台自身**的页面浏览由 [`@vercel/analytics`](https://vercel.com/docs/analytics/quickstart)
  采集：`src/app/layout.tsx` 里挂了 `<Analytics />` 与 `<SpeedInsights />`，
  部署到 Vercel 后在项目的 Analytics 面板查看，无需额外配置。
- **官网（对外站点）**的流量走自建埋点：官网 POST 到 `/api/analytics/collect`
  （单次最多 50 条，事件类型需在 `web_event_types` 白名单内），写入 `web_events`，
  再由 `gy_rollup_web_day()` 汇总成 `web_analytics_daily` / `web_page_stats` /
  `web_traffic_sources` / `web_device_stats` / `web_region_stats` / `web_product_stats`。
  `/analytics?view=web` 读的就是这些汇总表。
- 经营指标（KPI / 趋势 / 排行 / 漏斗 / 待办）统一在 `src/lib/data/metrics.ts` 计算，
  所以同一个「待发货」在首页数字、侧边栏徽标、业务流程条上永远是同一个值。
  日切按 `app_settings.analytics.tz_offset_hours`（默认 +8），不是服务器的 UTC。

---

## 项目结构

```
src/
  proxy.ts                    # 会话刷新 + 未登录拦截（Next.js 16 的 middleware）
  app/
    layout.tsx                # 根布局 + Vercel Analytics / Speed Insights
    login/                    # 登录页（未配置时显示「系统尚未配置」）
    (app)/                    # 需要登录的后台：各模块 page.tsx 取数 + *View.tsx 交互 + actions.ts 写入
    api/
      pay/[provider]/notify/  # 微信 / 支付宝 / 银联回调
      logistics/[carrier]/webhook/
      analytics/collect/      # 官网埋点上报
  components/
    shell/                    # AppShell / Sidebar / Header / DictProvider / IdleLogout
    dashboard/                # 首页各区块
    ui/                       # Card / Tag / Button / Icon / DataTable / FilterableTable / Form
  lib/
    types.ts  tokens.ts  charts.ts  nav.ts  rbac.ts  dict.ts  settings.ts
    auth/                     # context / store / permissions / actions / audit
    data/                     # db(服务端唯一取数入口) queries metrics web settings dict approvals policy search
    actions/                  # runAction 授权 + 审计 + 统一返回值
    payments/                 # types wechat alipay unionpay manual registry apply
    logistics/                # types manual httpCarrier registry
    supabase/                 # 浏览器 / 服务端 / service-role 客户端
supabase/
  migrations/0001…0010.sql
  seed_reference.sql          # 必须执行：基础配置
  seed_samples.sql            # 可选：sample- 前缀的演示数据
  clean_samples.sql  reset.sql
scripts/
  create-admin.mts  db-check.mts
design-reference/             # 原始 Claude Design 导出件
```

---

## 端到端测试

容器 / CI 里没有 Supabase 时，也能把整套后台真的跑起来测：`e2e/mock/` 用本地
Postgres 实现了 PostgREST 与 GoTrue 的兼容层（查询构造、过滤器、count、rpc、
json 列编码、date/timestamptz 按 JSON 返回字符串、密码 bcrypt 校验、会话 Cookie）。

**应用源码里没有任何测试分支** —— `next.config.ts` 只在 `E2E_MOCK_SUPABASE=1`
时把 `@supabase/supabase-js` 与 `@supabase/ssr` 指向 mock，所以被测的是真实的
页面、Server Action、SQL 触发器与 RLS，只换掉网络传输层。

```bash
# 1) 起一个本地 Postgres，按顺序灌入 0001…0010 + seed_reference + seed_samples
# 2) 写一份 .env.e2e：E2E_MOCK_SUPABASE=1 与 E2E_DATABASE_URL
set -a; . ./.env.e2e; set +a
npx next build && npx next start -p 3100

npm run e2e:crawl      # 遍历 52 个页面 × 子视图，抓页面异常 / 500 / 空白，逐页截图
npm run e2e:interact   # 真实点击写操作，再回数据库核对副作用
npm run e2e:export     # 7 个 CSV 导出：真下载、解析文件、对数
npm run e2e:controls   # 编辑回显、逐字段回写、高级筛选、搜索、批量操作与触发器
```

`e2e:interact` 覆盖：登录与会话落库、新建客户、新建订单（单号序列 / 状态派生 /
时间轴）、收款确认引发的客户统计与成长值联动、库存单据、安全阈值改完登录页
跟着变、业务字典改完界面跟着变、全局搜索命中、审计日志、RBAC 越权拦截、退出登录。

`e2e:controls` 覆盖：编辑客户后列表立即回显、连续编辑不串数据、11 个表单字段
逐一回写、**更新命中 0 行时必须报错**、订单「高级筛选」展开 / 过滤 / 收起、
列表搜索与下拉筛选、勾选后的批量操作条。

`e2e:export` 覆盖 7 个 CSV 导出：真触发浏览器下载并解析文件 —— 行数与库对数、
UTF-8 BOM、中文表头、列数对齐、**公式注入防护**、导出留痕，以及审批阈值对
L1（本人即审批人，放行）/ L2（被规则拦下）/ L3（看不到按钮）的不同表现。

---

## 关于 CSV 导出

7 个导出（订单 / 客户 / 库存 / 运单 / 收款 / 退款 / 结算）共用
`src/lib/csv.ts`：

- **中文表头**。文件是给运营和财务的，不该让他们对着 `settle_status`
  `amount_received` 猜字段。
- **公式注入防护**。客户姓名、备注、异常说明都是自由文本，以 `=` `+` `-` `@`
  或制表符开头的单元格在 Excel / WPS / Google Sheets 里会被当公式执行。
  这里统一加单引号前缀（纯数字不受影响）。
- **UTF-8 BOM** 由前端下载时补，Excel 打开中文不乱码。
- **超阈值需审批**：行数超过 `security.export_approval_rows` 时走
  `approval_rules`。一级管理员本身是审批人所以直接放行，二级会被挡下并提示
  规则名，三级连按钮都看不到。每次导出都写 `admin_audit_logs`。

---

## 部署到 Vercel

1. 推送到 GitHub 后在 [vercel.com](https://vercel.com) → **Add New → Project** 导入仓库。
2. **Settings → Environment Variables** 填入 `.env.example` 里的必填项
   （`SUPABASE_SERVICE_ROLE_KEY` 务必设为非公开的服务端变量）。
3. Deploy。Web Analytics 需要在 Vercel 项目的 **Analytics** 标签页点一次启用。

### 绑定域名 guiye-admin.com

Vercel 项目 → **Settings → Domains** → 添加 `guiye-admin.com`（建议同时加 `www`），
按仪表盘提示在域名注册商处配置 DNS（通常是根域 `A` 记录与 `www` 的 `CNAME`），
等待验证后 Vercel 自动签发 HTTPS 证书。最后把 `NEXT_PUBLIC_SITE_URL` 设为
`https://guiye-admin.com` 并重新部署。

---

## 后续待办

- 短信验证码 / TOTP 二次验证（安全策略页现标注「规划中」）
- 微信 / 支付宝 / 银联的下单与退款联调（验签已就绪，缺商户资质）
- 承运商 API 实际对接（通用 `http` 适配器已就绪，填 `carriers.api_config` 即可）
- 品牌内容模块仍在使用旧实现，尚未纳入本轮改造

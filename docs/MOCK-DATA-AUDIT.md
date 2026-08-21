# 瑰野 GUIYE 后台 · Mock 数据与写死数据全量审计

> **审计对象**：`macqueen330/guiyeadmin` @ `bb4703d`
> **审计范围**：`src/**`、`scripts/**`、`supabase/**` 全量文件（约 11,900 行）
> **审计目的**：找出所有**本应由管理员在后台调整、但当前是 mock 数据或写死常量**的内容（价格、状态、名称、阈值、开关等）
> **生成方式**：10 个 agent 分片盘点 + 关键结论逐条人工复核

---

## 一、执行摘要

| 结论 | 数字 |
| --- | --- |
| 全库**能真正写数据库**的操作 | **4 个**（登录、登出、改本人资料、改本人密码） |
| 点了**完全没有反应**的按钮/控件 | **约 45 个** |
| `queries.ts` 中**永远读不到数据库**的取数函数 | **18 个**（纯 `return mock.xxx`） |
| `queries.ts` 中 DB 优先、失败/空表回退 mock 的函数 | 13 个 + 3 个派生 |
| 数据库现有表 | 15 张 + 1 视图 |
| 要让本文清单可配置，**还缺的表** | 约 **25 张**（其中 11 张为 P0） |
| 数据库层的**写策略（insert/update/delete）** | **0 条** |

### 三句话总结

1. **首页整屏经营数字没有一个是真的**，而且不是"数据库还没填"——是代码里**结构上就没有数据库路径**。即使 Supabase 塞满真实数据，首页 6 张 KPI、所有趋势图、所有官网分析、待办预警、业务流程、各类排行榜，**一个像素都不会变**。
2. **有一类东西比"假数据"更棘手：假算法。** 趋势曲线是线性同余伪随机数当场生成的；会员积分是 `累计消费 ÷ 10` 渲染时算的；六档价格是 `零售价 × 写死倍率` 算的；渠道转化率是 `6/16` 这样的常数除法。**业务规则被写成了渲染代码**，不迁移数据无法解决。
3. **风险最高的不是数字不准，是三件事**：① 未配置环境变量时全站降级为"无需登录的超管"；② 安全策略页面用绿色对勾展示了一批**根本没实现**的管控（5 次锁定、新设备验证码、强制 2FA、导出审批）；③ 审计日志里混着 11 条**带真人姓名的伪造操作流水**。

---

## 二、数据来源分层（最重要的结构性结论）

理解这套代码，必须先分清三层。**同一个页面上的数字，可能分属不同层，用户完全无从分辨。**

### 第 1 层：纯 mock，永不可变（最严重）

`src/lib/data/queries.ts` 里 **18 个非 async 函数**，函数体就是 `return mock.xxx`，**没有任何 Supabase 调用**：

| 行号 | 函数 | 驱动的界面 |
| --- | --- | --- |
| L40 | `getKpis()` | 首页 4 张经营 KPI（GMV / 订单 / 退款 / 客单价） |
| L43 | `getPipeline()` | 首页业务主流程 7 节点 |
| L46 | `getSalesChannels()` | 首页 + 分析 · 销售渠道占比 |
| L49 | `getCustomerSources()` | 分析 · 客户来源占比 |
| L52 | `getProductRanking()` | 首页 + 分析 · 商品排行 |
| L55 | `getProvinceRanking()` | 首页 + 分析 · 地区排行 |
| L64 | `getAlerts()` | 首页今日待办 6 条 |
| L67 | `getWarehouseStock()` | 首页 + 物流 · 多仓库存 |
| L70 | `getTopSku()` | 首页热销 SKU 榜 |
| L162–L188 | `getWebOverview()` 等 **9 个官网分析函数** | 整个「官网数据」页 |

> 代码注释自认（queries.ts L161）：*"官网数据（示例数据；接入统计后替换为真实埋点）"*

**还有比这更隐蔽的一类——完全绕过数据层：**
- `KpiRow.tsx` L3 **直接 `import { kpis } from "@/lib/mock/data"`**
- `page.tsx` L16–23 `todayStats` 是**页面文件内的字符串常量**
- `RecentActivity.tsx` L3–9 是**组件内的数组**
- 所有趋势曲线来自 `charts.ts:genSeries()` **伪随机数**

### 第 2 层：DB 优先 + 静默回退 mock

`fetchTable()`（queries.ts L26–38）覆盖 13 张表：`payments` `refunds` `orders` `customers` `dealers` `products` `warehouses` `inventory_view` `shipments` `settlements` `brand_assets` `system_users` `admins`。

**这里有一个设计缺陷：**

```ts
if (error || !data || data.length === 0) return fallback;   // L36
```

"查询成功但表为空"和"没连上数据库"被当成同一件事。后果：一个**真实但尚无数据**的系统（刚上线、本月还没有退款单）会显示 8 条编造的退款记录，管理员无从分辨。**空集是合法答案，不是失败。**

而且回退是**完全静默**的——没有 UI 标识、没有日志、没有警告。与此同时 `Header.tsx` L48 还给**每个页面**无条件盖了个绿色的 **「实时」** 徽标。

### 第 3 层：写死在组件里的常量

菜单结构、状态字典、价格倍率、审批档位、安全策略、支付配置、官网内容板块……详见下文分类清单。

---

## 三、按类别的完整清单

### A. 价格与金额 💰

> 用户点名的第一类。这是本次审计中**商业影响最直接**的部分。

#### A1. 多档价格体系：六档价格全是「零售价 × 写死倍率」

**`src/app/(app)/inventory/InventoryView.tsx` L51–68 / L110 / L127–132**

| 档位 | 倍率 | 位置 |
| --- | --- | --- |
| 官网零售价 | `× 1` | L127 |
| 会员价 | `× 0.92` | L128 |
| 经销价 | `× 0.78` | L129 |
| 团购价 | `× 0.85` | L130 |
| 企业采购价 | `× 0.75` | L131 |
| 海外建议价 | `× 1.15` | L132 |

渲染式：`fmtCurrency(Math.round(r.price * factor))`（L64）

**问题**：`products` 表只有 `price` / `cost` 两列，**不存在价格档位表**。因此：
- 不能给单个 SKU 设例外价
- 不能做限时价、阶梯量价、区域价
- 没有生效时间、没有审批留痕
- 改一次折扣政策 = 改代码 + 重新发版

「价格管理」页只有一个**无 `onClick`** 的「新增价格策略」按钮（L206–209）。

#### A2. 商品售价与成本

**`src/lib/mock/data.ts` L53–64** — 10 个 SKU

- `price`：138 / 168 / 218 / 256 / 288 / 298 / 388 / 458 / 528 / 688
- `cost`：58 / 72 / 94 / 108 / 121 / 132 / 165 / 196 / 224 / 286
- 毛利率公式内联在 render 里：`((price - cost) / price * 100).toFixed(1)`（InventoryView L117，**未做 `price = 0` 保护**，会出 `Infinity`/`NaN`）

#### A3. 支付渠道手续费率 —— **配置项完全不存在**

`payments` mock（data.ts L212–225）里逐笔写死 `fee` 金额，反推出：微信 0.6%、支付宝 0.6%、银联 0.5%、银行转账 0%。

**但「支付配置」页里根本没有"费率"这一项。** 没有费率表、没有生效时间、没有阶梯费率、没有变更审计。渠道调价需要改代码并重算历史数据。

#### A4. 经销商授信与欠款

**`src/lib/mock/data.ts` L122–131** — 8 家经销商
- `credit_limit`：300000 / 200000 / 150000 / 130000 / 120000 / 100000 / 90000 / 80000
- `debt`：86400（US West Spirits）、41200（Dubai Premium Cellar）
- **无信用占用流水表**，欠款是写死数字而非应收汇总

#### A5. 其它金额

| 内容 | 位置 | 现值 |
| --- | --- | --- |
| 订单金额 / 实收 | data.ts L193–209 | 15 笔，4280 最大；样品/补发单为 0 |
| 结算单金额 | data.ts L253–262 | 8 笔：132400 / 86400 / 58200 … |
| 退款金额 | data.ts L228–233 | 4 笔 |
| **单品漏斗"估算销售额"客单价 `210`** | ProductFunnel.tsx L32 | **全部 5 个产品共用同一个 210 元**，礼盒与小样收入被严重错估 |
| 货币符号 `¥` | tokens.ts L206–208 | 硬编码，被 **15 个文件**引用；`Math.round()` **直接抹掉小数** |

> **跨境业务的币种问题**：往来方含 `US West Spirits`、`Maison Vert`、`Tokyo Sake House`，订单来自美/德/法/日/新，但**全库无币种字段、无汇率**。且 `Math.round` 导致手续费 `1.13` 显示成 `¥1`，而合计 `47.59` 显示 `¥48` —— **明细与合计对不上**。

---

### B. 业务状态与流程字典 🔄

> 用户点名的第二类。**这些是"业务字典"，管理员本应能改名、增删状态。**

#### B1. `src/lib/tokens.ts` —— 15 张状态映射表

| 常量 | 行号 | 数量 | 样例 |
| --- | --- | --- | --- |
| `ORDER_STATUS` | L28–37 | 8 | `pending:"待付款"`、`settled:"已结算"` |
| `ORDER_SOURCE` | L39–47 | 7 | `web:"GUIYE 官网"`、`dealer:"经销商代下单"` |
| `DEALER_STATUS` | L49–53 | 3 | `active:"合作中"` |
| `SHIPMENT_STATUS` | L55–61 | 5 | `in_transit:"运输中"`、`customs:"清关中"` |
| `SETTLEMENT_STATUS` | L63–67 | 3 | `overdue:"已逾期"` |
| `SETTLEMENT_TYPE` | L69–74 | 4 | `dealer_payout:"渠道结算"` |
| `ORDER_TYPE` | L78–85 | 6 | `enterprise:"企业采购"` |
| `ORDER_CHANNEL` | L87–93 | 5 | `offline_pos:"线下收银"` |
| `CUSTOMER_SOURCE` | L95–103 | 7 | `xhs:"小红书"` |
| `PAYMENT_METHOD` | L105–113 | 7 | `credit_term:"账期"` |
| `PAY_STATUS` | L115–123 | 7 | `partial_refund:"部分退款"` |
| `FULFILL_STATUS` | L125–132 | 6 | `wait_ship:"待发货"` |
| `SETTLE_STATUS` | L134–139 | 4 | `reconciling:"对账中"` |
| `REFUND_STATUS` | L141–148 | 6 | `reviewing:"审核中"` |
| `ADMIN_LEVEL` / `ADMIN_STATUS` | L152–165 | 3 / 6 | `L1:"一级"`、`resigned:"已离职"` |

#### B2. `src/lib/types.ts` —— 类型层的**编译期封死**

同一批字典在 `types.ts` 又以联合类型字面量存在一份（`OrderStatus` L4–12、`PayStatus` L61–68、`PaymentMethod` L49–56、`AdminLevel` L271 …）。

**这意味着：管理员永远不可能新增一个订单状态或一种支付方式** —— 不只是"没有界面"，而是类型层面就是封闭集合。

> **并且数据库层没有任何兜底**：`grep "check("` 在 4 个迁移文件里 **0 命中**，`orders` 等表用的是普通 `text` 列，没有 check 约束。字典只靠 TS 类型在编译期约束。

#### B3. 新增一个状态要改几处？

以「订单状态」为例，至少 **4 处**：
1. `types.ts` 的联合类型
2. `tokens.ts` 的中文标签映射
3. 各页面的筛选项派生（如 OrdersView L21–22）
4. 数据库列（无约束，但要同步数据）

**字典重复定义清单**（改一处另一处不会同步）：
- `DATA_SCOPES`(rbac L52) vs `DATA_SCOPE_LABEL`(rbac L61) —— 同一份数据两份拷贝
- `LEVELS[].name`(rbac L16) vs `LEVEL_NAME`(rbac L40)
- `NEW_ORDER_TYPES`(OrdersView L24，5 项) vs `ORDER_TYPE`(tokens L78，**6 项**) —— 新建入口**缺「活动订单」**，且 `reissue` 两处中文名不同（「新建补发订单」vs「售后补发」）
- `FULFILL_FLOW`(订单详情 L22) 叫「待分配仓库」 vs `FULFILL_STATUS`(tokens L125) 叫「待分配」
- `ResultTag` 在 settings/page.tsx L68 与 profile/page.tsx L60 **各写一遍**
- 库存图例「可售/锁定/在途」在 inventory/page.tsx L127 与 LogisticsView L77 **各写一份**

#### B4. 状态推导规则也是写死的

**`src/lib/mock/data.ts` L156–164 `coarseStatus()`** —— 由支付+履约+结算推导订单总状态的规则引擎，7 条判定规则写死在函数里。

**`src/app/(app)/orders/OrdersView.tsx` L99–107 `contextAction()`** —— 「什么状态显示什么操作按钮」的工作流规则：未支付→「收款确认」、异常→「处理异常」、备货/待发→「发货」。

---

### C. 名称与主数据 🏷️

#### C1. 仓库

**`src/lib/mock/data.ts` L46–51** — 4 个仓库

```
{ id: "wh-cn",     name: "苏州仓",         code: "CN · 苏州",  region: "中国" }
{ id: "wh-eu",     name: "法国 / 欧洲仓",  code: "FR · 里昂",  region: "欧洲" }
{ id: "wh-us",     name: "美国仓",         code: "US · 洛杉矶", region: "美洲" }
{ id: "wh-dealer", name: "经销商仓（合计）", code: "12 家",     region: "经销商" }
```

**数据建模缺陷**：
- `code` 字段被塞了 `"12 家"`（数量当成编码）—— 而 `dealers` 实际只有 **8 家**，数据自相矛盾
- `orders[].ship_from` 用 `"法国/欧洲仓"`，`warehouses[].name` 用 `"法国 / 欧洲仓"`（**空格不同**），**无法关联**
- 「仓库管理」页（LogisticsView L136–138）只渲染一个只读分布条 —— **没有仓库列表、地址、联系人、启用开关**
- 仓库改名这种运营动作，目前需要**写一条 SQL 迁移**（见 `0004_order_province_suzhou.sql` L152–153）

#### C2. 商品、分类与 SKU

- 10 个 SKU（data.ts L53–64），品名如 `瑰野·桂花酿米酒 500ml`
- **商品分类**：`米酒 / 果酒 / 礼盒 / 利口酒 / 清酒` —— 是 `products.category` 上的**自由文本**，无分类表。筛选项靠对现有数据去重推导（InventoryView L183–186），**无法新增空分类、无法排序、无法改名**

#### C3. 承运商 —— **无主数据**

`shipments.carrier` 是自由文本：`DHL Express`、`顺丰国际`、`FedEx`、`新加坡邮政`、`日本郵便 EMS`、`DPD`（6 家）。没有承运商表，因此没有时效、计费方式、单号规则、查询链接。

#### C4. 其它主数据

| 内容 | 位置 | 现值 |
| --- | --- | --- |
| 客户 | data.ts L133–144 | 10 个 |
| 经销商 | data.ts L122–131 | 8 家，等级 `金牌/银牌/标准` |
| 管理员 | mock/admin.ts L5–15 | 9 个账号 |
| 部门 | admins[].dept | `管理层/运营部/财务部/销售部/客服部/仓储部/品牌部`（自由文本，无部门表） |
| 角色 | admins[].role | 9 个中文名（自由字符串，无角色表） |
| 品牌名 / Logo | Sidebar.tsx L239/L244/L247 | `瑰`、`GUIYE 瑰野`、`订单 · 渠道 · 履约中台` |
| 官网页面清单 | mock/web.ts L42–48 | `首页/产品/品牌故事/…` |
| 官网城市榜 | mock/web.ts L70–77 | 苏州/成都等 6 城 |
| 埋点事件字典 | mock/web.ts L89–102 | **12 个事件**（含「点击 WhatsApp」「下载产品资料」）—— 新增一个官网按钮就要改 TS 发版 |
| 流量来源渠道 | mock/web.ts L51–60 | 8 个渠道，占比合计 100 |

---

### D. 阈值与业务规则 ⚙️

#### D1. 库存阈值

| 内容 | 位置 | 现值 |
| --- | --- | --- |
| 单品安全库存 | data.ts L54–63 | 800 / 600 / 500 / 450 / 400 / 350 / 300 / 250 / 180 |
| **全局默认安全库存** | data.ts L104（函数默认参数） | **200**（23 条库存行中 19 条走默认） |
| 低库存判定 | inventory/page.tsx L40, L63 | `sellable < safety_stock` —— 严格小于，**不计在途 transit** |
| 补货缺口 | InventoryView L159 | `safety_stock - sellable`，**不含在途、无安全系数** |
| 预警分级 | InventoryView L181 | **只有一档**（低于安全库存），无「紧急/一般」 |

#### D2. 安全策略阈值 —— **同一个数字散落 3~4 处**

| 阈值 | 真正生效的实现 | 其它重复写死处 |
| --- | --- | --- |
| 连续输错锁定次数 = **5** | `auth/actions.ts` L12 `MAX_ATTEMPTS` | `rbac.ts` L177（文案）、`login/page.tsx` L117（文案） |
| 锁定时长 = **30 分钟** | `auth/actions.ts` L13 `LOCK_MINUTES` | `rbac.ts` L177、`login/page.tsx` L117 |
| 无操作自动退出 = **30 分钟** | `IdleLogout.tsx` L8（默认参数，调用处不传） | `rbac.ts` L181、`login/page.tsx` L117 |
| 密码强度正则 | `profile/actions.ts` L16 | `scripts/create-admin.mts` L36（**独立副本**）、`rbac.ts` L176（中文）、`ProfileForms.tsx` L85（placeholder） |
| 会话 cookie 有效期 = 12h | `auth/actions.ts` L31 `maxAge: 60*60*12` | — |

**系统设置 → 安全策略页里没有任何一项可以修改**，全是只读文字。

#### D3. 审批与风控阈值（**全部是死代码**）

`src/lib/rbac.ts` 定义了完整的风控体系，但**零处调用**：

| 常量 | 行号 | 内容 | 状态 |
| --- | --- | --- | --- |
| `L1_ONLY` | L131–142 | 10 条一级独有操作 | ❌ 零引用 |
| `CONFIRM_ACTIONS` | L145–153 | 7 条需二次确认操作 | ❌ 零引用 |
| `APPROVAL_L2` | L156 | 5 项三级→二级审批 | ❌ 零引用 |
| `APPROVAL_L1` | L159 | 7 项二级→一级审批 | ❌ 零引用 |
| `REFUND_TIERS` | L168–172 | 退款分级：`¥0–500`→二级、`¥500–5,000`→一级、`¥5,000 以上`→一级+二次验证 | ❌ 零引用 |
| `LEVELS` / `DATA_SCOPES` | L16 / L52 | 等级与数据范围定义 | ❌ 零引用 |

> **`REFUND_TIERS` 的注释自相矛盾**：L167 写着*"阈值可在系统设置调整，不写死"*，紧接着就是写死的数组。更关键的是金额存成 `"¥0 – 500"` 这样的**中文字符串**，**无法与订单金额做数值比较** —— 即使将来接审批逻辑，也必须先重构成 `{min, max, approver, require2fa}`。
>
> 同理 `APPROVAL_L1` 里的「大额退款」「大批量库存调整」**没有任何量化定义**。

#### D4. 会员规则 —— **积分是渲染时算的**

**`src/app/(app)/crm/CrmView.tsx`**

```ts
L152:  积分   = Math.round(c.total_spent / 10)     // 消费 10 元 = 1 积分
L160:  成长值 = c.orders_count * 100               // 每单 100 成长值
```

数据库里**没有 `points` / `growth` 字段**。后果：
- 积分**不能手工调增/扣减/冻结/过期/兑换/补发**
- 退款不会扣分
- 改比例会让**历史积分整体漂移**

界面把它们当会员资产展示（有列头、有千分位格式化），但它们没有独立存储 —— 属于会导致业务事故的伪造字段。

**会员判定**：`level !== "新客"`（page.tsx L21 + CrmView L141，**同一规则写两遍**），没有任何消费额/订单数/时间门槛。

#### D5. 分析阈值与写死日期

| 内容 | 位置 | 问题 |
| --- | --- | --- |
| 「新增消费者」基准日 | analytics/page.tsx L135 | 写死 `"2026-05-01"`，副标题却写「近 60 天」（今天 2026-08-21，实为近 3.7 个月） |
| 「今年新增渠道客户」基准日 | analytics/page.tsx L185 | 写死 **`"2024-01-01"`** —— 副标题「今年新增」，实为**近 2.7 年累计** |
| 消费频次分桶 | analytics/page.tsx L143–148 | `1 / 2–3 / 4–9 / 10+` |
| 跳出率告警线 | WebAnalytics.tsx L141 | `>= 45` 变红 |
| 漏斗健康度色阶 | Funnel.tsx L21 | `>=50` 绿 / `>=25` 橙 / 其余红 |
| 单品诊断规则 | ProductFunnel.tsx L13–20 | 4 条阈值（30/55/20/80）+ 4 段建议话术 —— 一套**内置运营知识库**，改一句话要发版 |

> 这两个写死日期**不会报错，只会随时间静默变得越来越离谱**。

---

### E. KPI / 统计 / 图表 📊

#### E1. ⚠️ 最严重：趋势图数据是**伪随机数生成器**

**`src/lib/charts.ts` L7–42 `genSeries()`**

```ts
let s = (seedMap[metric] || 11) * 1000 + n;
const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };   // 线性同余
...
v += (rnd() - 0.46) * (hi - lo) * 0.16;    // ← 0.46 是人为的「上升偏置」
```

- **`0.46` 而非 `0.5`** —— 保证曲线看起来"总体向上"。**"业绩增长"被编码进了渲染代码。**
- `baseMap`（L23–32）写死取值区间：销售额 `[22000, 52000]`、订单 `[70, 210]`、PV `[620, 1420]`…业务量级一变（日销破 10 万），图表**永远画不出来**
- **X 轴日期锚点写死**：`labelFor()` L112 `const d = new Date(2026, 5, 20)` —— 「近 7 天」永远从 **2026-06-20** 倒推，与今天（2026-08-21）**差两个月**

切换「今日/7天/30天/90天」**不发任何请求、不读任何数据 —— 看起来是在查询，实际是在造数。**

`KpiRow.tsx` L8 更直接：退款走势是**手写的 16 个数字** `[9,7,11,6,8,5,7,4,6,5,7,4,5,3,4,3]`。

#### E2. 首页 KPI

**`src/app/(app)/page.tsx` L16–23** — 6 张卡全是字符串常量：

```
今日销售额 ¥86,400（较昨日 +6.2%）  |  今日订单 142（已支付 128）
待发货 128（含 8 单超时）           |  待跟进客户 3（超 7 天未跟进）
库存预警 4（低于安全线 SKU）        |  待回款 ¥127,600（应收逾期 2 笔）
```

整页**唯一走过数据库的是 `getRecentOrders(6)`**。

**`src/lib/mock/data.ts` L39–44** — 另外 4 张经营 KPI：GMV `¥1,284,560`、订单 `3,642`、退款率 `1.82%`、客单价 `¥352.7` / 毛利率 `54.6%` / 复购 `31%`。

#### E3. 假计数与徽标

| 内容 | 位置 | 现值 |
| --- | --- | --- |
| 侧边栏「订单中心」徽标 | nav.ts L55 | **`"128"`** |
| 侧边栏「仓储物流」红色徽标 | nav.ts L87 | **`"3"`** |
| Header 通知铃铛未读数 | Header.tsx L156 | **`9`** |
| 环形图中心「成交订单」 | ChannelMix.tsx L20 | `"3,642"` |
| 环形图中心「新增客户」 | ChannelMix.tsx L27 / analytics L167 | `"962"`（与同页真实算出的 `newConsumers` **冲突**） |
| 渠道转化率 | analytics/page.tsx L197–198 | `Math.round((6/16)*100)`、`Math.round((6/9)*100)` —— **常数除法冒充计算** |
| 「库存周转 5.2 次/月」「退货率 1.8%」 | analytics/page.tsx L236–241 | 4 张卡里 2 张纯写死 |
| 单品「平均停留 2分36秒」 | ProductFunnel.tsx L59 | **所有 5 个产品都显示同一值**；`ProductAnalytics` 类型里根本没这个字段 |
| 「上一周期」对比 | WebTrend.tsx L48 | `total / (1 + delta/100)` —— 用**写死的 delta** 去除**随机造出的 total** |

#### E4. 数字之间已经互相矛盾

- `orderItems` 对 `o-28471` 的明细合计 **1514**，而该订单 `amount` 是 **1186**
- `topSku` 与 `productRanking` 对同一 SKU 的 pct 口径不同（杨梅气泡：**74 vs 81**）
- 仓库「12 家」vs `dealers` 实际 **8 家**
- 物流页用 `getWarehouseStock()`（**纯 mock，永不查库**），库存页用 `getWarehouses()+getInventory()`（**会查库**）—— 同一个「苏州仓」两页显示不同数字
- 同名「转化率」：排行表 = 下单÷详情（**7.7%**），单品页 = 支付÷曝光（**1.36%**）—— **差 5 倍**

---

### F. 配置与开关 🎛️

#### F1. ⚠️ 支付渠道配置 —— 整页是「静态截图式 JSX」

**`src/app/(app)/payments/PaymentsView.tsx` L234–276**

```
微信支付：商户号 16018****01 / AppID wx****a1b2 / 支付场景 JSAPI · H5 · Native
          / 回调 /api/pay/wx/notify / 状态 已启用 / 测试 已通过
支付宝：  应用 ID 2021****8899 / 商户账号 pay@guiye.com / 支付产品 电脑 · 手机 · 当面付
银联：    商户号 8985****0071 / 证书 即将过期 / 对账文件 每日 10:00
          / 状态 待启用 / 测试 待验证
```

**22 个配置值全是字面量字符串**，没有 state、没有 input、**没有保存按钮**。

最刺眼的是：银联卡片显示「证书：**即将过期**」「状态：待启用 / 测试：待验证」—— **界面明确在提示需要人工处理，却不提供任何处理入口**。

> 而且 `rbac.ts` L134–136 明确把"修改支付账户 / 修改微信支付宝银联配置"列为 **L1 独有权限** —— 但这个功能根本不存在，那几个 `/api/pay/*` 路由在代码库里**也不存在**。
>
> 另外 `PAYMENT_METHOD` 支持 7 种支付方式，配置页却只有 3 张卡 —— **银行转账、线下收款、账期（credit_term）完全没有配置入口**（无银行账户、无收款户名、无账期天数）。

#### F2. 消息通知开关 —— **是文字，不是开关**

**`src/app/(app)/settings/page.tsx` L146–152**

5 条通知规则（订单异常 / 库存预警 / 渠道客户跟进 / 回款应收 / 售后退款）的值是写死的 `<OnValue text="已开启" />` 或 `"仅站内"`。

`OnValue` 组件（L12–18）**结构上只能渲染开启态** —— 说明后端根本没有开关字段。

副标题里还藏着规则参数：「超 7 天未跟进」「低于安全库存」「应收逾期」。

#### F3. 多语言 —— 只有一个字符串标签

**`src/app/(app)/brand/BrandView.tsx` L31–36**：`langs: "中 / EN"` / `langs: "中"`

**可选语种清单本身不存在**，无法按语种维护发布状态、无法查询统计。「多语言内容」页是 `ModulePlaceholder` 空壳。

> 全库约 **45 处以上**中文串直接内联在 JSX / 常量里（表头、占位、图例、空态、按钮、KPI 副标题、状态字典），**没有任何 i18n key 层**，而系统本身有「多语言内容」菜单。

#### F4. 其它开关

| 内容 | 位置 |
| --- | --- |
| 各模块默认落地子页 | 6 个 page.tsx 各写一份 `?? "products"` / `"pending"` / `"receipts"` / `"flow"` / `"consumers"` / `"website"`，**与 nav.ts 的 `default: true` 重复定义** |
| 首页最近订单条数 | page.tsx L26 `getRecentOrders(6)` |
| 趋势图默认范围 | page.tsx L44 `defaultRange="7"` |
| 日志分页上限 | store.ts L109/L124 `limit = 100 / 50`，**无 UI 翻页** |
| 2FA | profile/page.tsx L254 | 只有文字 `"未开启 · 预留"`，**无开关** |

---

### G. 权限与安全 🔐

#### G1. ⚠️ 最高优先级：两个安全降级开关

**`src/lib/auth/context.ts` L53 / L56**

```ts
if (!isAuthConfigured) return DEMO_ADMIN;   // L53
if (!sb) return DEMO_ADMIN;                 // L56
```

`DEMO_ADMIN`（L23–36）是一个写死的 **L1 超级管理员**：`演示管理员 / demo@guiye.com / level:"L1" / scope:"all"`。

同时 **`src/proxy.ts` L31** `if (!isAuthConfigured) return NextResponse.next()` —— **路由守卫一并短路**。

> **生产环境一次配置失误 = 全站无鉴权的超管入口。**
> 而 `login/page.tsx` L92 还会主动把缺失的变量名 `SUPABASE_SERVICE_ROLE_KEY` **显示给未登录访客**，L109 提供「以超级管理员身份进入控制台」按钮。

#### G2. ⚠️ 安全承诺与实现脱节

`SecurityPolicy.tsx` L14–21 把 `LOGIN_POLICY` 逐条打上**绿色对勾**展示，暗示"已生效"。但其中：

| 策略文案 | 实际 |
| --- | --- |
| 「连续输错 5 次锁定账号」 | ✅ 已实现（actions.ts L99） |
| 「锁定 30 分钟后自动解锁」 | ✅ 已实现（actions.ts L71） |
| 「30 分钟无操作自动退出」 | ✅ 已实现（IdleLogout） |
| **「新设备登录需手机验证码」** | ❌ **代码里不存在** |
| **「一级管理员强制开启二次验证」** | ❌ **不存在，2FA 无任何入口** |
| **「单次导出超过阈值需二级/一级审批」**（L55） | ❌ **连"阈值"数值都不存在** |

#### G3. ⚠️ 脱敏是"示例图片"，不是真实脱敏

- `rbac.ts` L184–188 `MASKING_EXAMPLES` 展示 `138****5678` / `320***********1234` / `**** **** **** 8890`
- `tokens.ts` L167–172 `maskPhone()` 函数存在，**全库零调用**
- `permissions.ts` L81 `canSeeSensitive()` 存在，**全库零调用**
- **而 `CrmView.tsx` L193–194 里 `c.email` 和 `c.phone` 是明文全量渲染的**

`types.ts` L295 的注释还写着 *"full value; masked in the UI per viewer level"* —— 实际上**手机号在 UI 里是明文的**。

#### G4. RBAC 是投入最大、落空最彻底的部分

`rbac.ts` 200 行定义了三级体系、9 个权限模块、52 个权限动作、12 个角色模板、L1 专属操作、二次确认清单、两级审批流、退款分级 —— **实际生效的只有"侧边栏菜单按 level 过滤"一件事**。

**经我逐一验证的死代码清单**（仅有定义、零调用点）：

| 符号 | 位置 |
| --- | --- |
| `can()` | permissions.ts L48 |
| `canSeeSensitive()` | permissions.ts L81 |
| `LEVELS` / `DATA_SCOPES` / `L1_ONLY` / `CONFIRM_ACTIONS` / `APPROVAL_L1` / `APPROVAL_L2` / `REFUND_TIERS` | rbac.ts |
| `getAdmins()` / `getSystemUsers()` | queries.ts L157 / L151 |
| `insertAdmin()` / `countActiveSuperAdmins()` | store.ts L66 / L54 |
| `<Forbidden />` 组件 | components/ui/Forbidden.tsx |

> **注**：`InfoHint` 组件曾被报为死代码，经复核**不成立** —— 它在 `analytics/WebAnalytics.tsx` 有 8 处引用，是活代码。
>
> `Forbidden` 变成死代码，是因为早前"精简为单人使用"时移除了 settings 下的管理员管理页 —— 属预期内。

**另外发现一个真实缺陷**：`ROLE_TEMPLATES` 中 `customer_mgr`(L111)、`sales_mgr`(L115)、`sales_op`(L117) 三个角色的 grants 引用了 **`channel` 模块**，但 `PERMISSION_MODULES` 里**没有 key 为 `channel` 的模块**（渠道管理已删除）。`can()` 找不到模块返回 `false`，`canViewModule()` 对 `"all"` 返回 `true` —— **同一权限在两个函数里行为不一致**。

#### G5. 伪造的审计流水（合规风险）

**11 条带真人姓名的假操作记录**：

| 位置 | 条数 | 样例 |
| --- | --- | --- |
| `RecentActivity.tsx` L3–9 | 5 | `李娜 审核通过订单 #GY-28469 · 12 分钟前`、`王浩然 确认回款 RCV-2026-0588` |
| `settings/page.tsx` L54–58 | 3 | `陈思远 L1 · 将订单 GY-28471 状态从「待发货」改为「已发货」· ip:"已记录"` |
| `profile/page.tsx` L98–104 | 3 | `编辑管理员「刘洋」的权限` ← **系统里根本没有这个功能** |

这些在 UI 上与真实审计记录**完全同构**（有姓名、等级、模块、单号、设备、IP、时间戳），一旦用于责任认定就是直接的合规问题。

> **`admin_audit_logs` 表是存在的**，`RecentActivity` 本可以读真实日志却没接。

#### G6. 脚本层的安全问题

**`scripts/create-admin.mts`**
- L7–8 注释里**明文写了口令 `--password 'Guiye2026'`** —— 会被直接复制粘贴成生产弱口令
- L88 `password_change_required: false` —— 与迁移 `0003` L91 的 `default true` **直接矛盾**，脚本建的管理员**绕过首次强制改密**
- L57 邮箱已存在时**静默重置该 Auth 用户密码**，L95 把账号强制改回 `active` —— 可用来**复活被停用的管理员**，且**全程无 `logAudit`**
- L24–25 不传 `--level` 默认造 **L1 超管**

**RLS 现状**（`0001` L150–162、`0002` L67–76、`0003` L136–144）
- **零条写策略** —— 只有 `select`，注释 L147 自认*"Add authenticated write policies later"*
- `0003` 仅收回了 `admins` 和 `admin_audit_logs`
- **`payments`、`refunds`、`customers` 至今仍对 anon 完全开放** —— anon 可读全部客户 email/phone 与全部支付流水

---

### H. 界面文案与标签 📝

数量最多、优先级最低，但**多语言化时必须先解决**。约 200+ 处，主要类型：

| 类型 | 典型位置 |
| --- | --- |
| 表格列头 | 每个 `*View.tsx` 的 `columns[].header`（订单 10 列、支付 8 列、退款 7 列、日志 7 列…） |
| 搜索占位 | `PLACEHOLDER` / `VIEW_PLACEHOLDER` / `VIEW_META` 各模块一份 |
| 空态文案 | `"暂无商品"` / `"该类型暂无订单"` / `"该类目暂无单据"` … |
| 按钮名 | `BATCH_ACTIONS`(6)、`NEW_ORDER_TYPES`(5)、`UPLOAD_LABEL`(4)… |
| 模块标题/副标题 | nav.ts 10 组共 30 条 |
| 分组标题 | nav.ts L48/L100/L119/L139：`交易管理/客户经营/品牌运营/经营管理` |
| 指标口径说明 hint | `WebAnalytics.tsx` L66–94（这些是**对外统一的指标定义**，口径变更必须能改） |

**几条属于"误导性文案"，建议优先处理**：

| 文案 | 位置 | 问题 |
| --- | --- | --- |
| **「实时」绿色徽标** | Header.tsx L48 | **对所有页面无条件渲染**，包括纯 mock 页 |
| 「数据截至今日 18:00 · 含全部渠道」 | TrendChart.tsx L125 | 声称数据新鲜度，实际是随机数 |
| **「该订单明细未同步（示例数据）」** | 订单详情 L123 | **直接向管理员暴露"示例数据"字样**（15 单中 12 单会命中） |
| 「直接编辑官网各板块，支持中英文文案」 | BrandView.tsx L45 | 向管理员承诺了不存在的能力 |
| 「账号角色 X · **拥有系统全部权限**」 | profile/page.tsx L206 | **无条件写死**，不看 `me.level` |
| `⌘K` 快捷键提示 | Header.tsx L80 | 全库唯一一处出现，**无 keydown 监听，快捷键不存在** |
| 「本月回款 / 本月退款 / 本月支付渠道费」 | finance L31/L62、payments L30 | **代码里没有任何时间窗过滤**，实为全量汇总 |
| 「近 7 日」（已送达） | logistics/page.tsx L56 | 计算里**没有日期过滤** |

---

## 四、官网内容（CMS）—— 一个只有外壳的模块

**`src/app/(app)/brand/BrandView.tsx` L23–37 `SITE_SECTIONS`**

6 个官网板块：首页 Banner / 产品介绍 / 品牌故事 / 饮用建议 / 新闻动态 / 联系方式

每个板块只有 5 个字段：`title` / `sub` / `status`(published|draft) / `langs` / `updated`（**写死的假日期** `2026-06-18` 等）。

> **关键问题：没有任何存放正文的字段。中英文文案在整个仓库里不存在。**

而文件顶部 L21–22 的注释自陈：*"官网内容 —— editable site sections，这是规格书的核心诉求"*，界面副标题也向管理员承诺"直接编辑官网各板块，支持中英文文案"。

「新增板块」和每行「编辑」按钮**都没有 `onClick`**。

**这是整个项目里"承诺与实现"落差最大的一块。**

---

## 五、占位按钮完整清单（点了没有任何反应）

> **统计：约 45 个占位控件；真实可写 = 2 个（保存资料、修改密码）+ 登录/登出。**

### 全局外壳

| 文件 | 控件 | 行号 |
| --- | --- | --- |
| Header.tsx | **导出报表** | L94–121（只有 hover，无 onClick，且**不受权限控制**） |
| Header.tsx | 通知铃铛 | L123+ |
| Header.tsx | 全局搜索框 + `⌘K` | L68–92（**无 value/onChange/onSubmit**） |
| AdminMenu.tsx | **我的审批** | L149 → `/settings?view=approval`，**该 view 不存在**，静默落到「安全策略」页 |
| QuickActions.tsx | 5 个快捷入口 | L5–9（只跳列表页，**不触发新建**） |

### 订单中心

| 控件 | 行号 | 说明 |
| --- | --- | --- |
| **新建订单** | L48 | `onClick` 只 `setOpen()` 展开菜单 |
| 5 个订单类型项 | L69–72 | `onClick={() => setOpen(false)}` —— **只关菜单** |
| **6 个批量操作** | L330–346 | 渲染成 `<span>`，**连 `<button>` 都不是** |
| **高级筛选** | L366 | 无 handler |
| 行内 收款确认/处理异常/发货 | L280–292 | `<span cursor:pointer>` |
| 行内「查看」 | L274 | ✅ 唯一能用（Link 跳详情） |

**订单详情页全文没有一个 `<button>`** —— 无法改单、取消、确认收款、发货、打印面单、编辑地址、换仓、备注。履约时间轴只能看，不能推进。

### 其它模块

| 模块 | 占位按钮 | 行号 |
| --- | --- | --- |
| 商品库存 | 新增价格策略 / 导出 / 新增商品 | InventoryView L207/L212/L215 |
| 物流 | 导出物流 | LogisticsView L159 |
| 客户 | 导出记录 / 新增会员 / 新增消费者 | CrmView L131/L213 |
| 品牌 | 新增板块 / 编辑(×6) / 上传素材 / 素材「查看」 | BrandView L47/L114/L165/L201 |
| 财务 | 导出对账 | FinanceView L106 |
| 支付 | **导入对账文件** / 导出退款 / 导出流水 | PaymentsView L155/L299/L349 |
| 支付配置 | — | **连按钮都没有**，纯只读 |
| 首页 | TopSku「全部 →」/ RecentOrders「筛选」 | TopSku L29 / RecentOrders L56 |
| 设置 | 消息通知 5 项 / 安全策略全部 / 商品设置 / 订单规则 | 全只读 |

> 「导入对账文件」尤其致命 —— **「渠道对账」整页的设计前提就是导入平台对账文件**，但没有 file input、没有上传接口、没有解析器。

### 唯一真实的写入路径（穷举）

| 文件 | 函数 | 写入目标 |
| --- | --- | --- |
| `auth/actions.ts` L42–139 | `signInAction` | Auth + `admins` + `admin_audit_logs` |
| `auth/actions.ts` L141–160 | `signOutAction` / `signOutIdleAction` | Auth + 审计 |
| `profile/actions.ts` L19–46 | `updateOwnProfileAction` | `admins`(name/phone/dept) + 审计 |
| `profile/actions.ts` L49–83 | `changeOwnPasswordAction` | Auth 密码 + 审计 |

> **即：整个"运营控制台"能写进数据库的，只有「我登录了」「我改了自己的名字/电话/部门」「我改了自己的密码」。零条业务数据可以被创建、修改或删除。**
>
> 而且这两个 profile action 都有 `if (isDemoMode()) return {error:"演示模式不支持保存"}` —— **在最常见的部署状态下，连这两条唯一的写路径也是关闭的**。

---

## 六、数据库结构缺口

### 现有对象（15 表 + 1 视图）

`warehouses` · `products` · `inventory` · `inventory_view` · `dealers` · `customers` · `orders` · `order_items` · `shipments` · `settlements` · `brand_assets` · `system_users` · `payments` · `refunds` · `admins` · `admin_audit_logs`

### P0 缺失表 —— 直接对应"看得见但改不了"

| 缺失表 | 现在写死在哪 | 关键字段建议 |
| --- | --- | --- |
| **`app_settings`** 全局配置 | `MAX_ATTEMPTS` / `LOCK_MINUTES` / IdleLogout 30min / `PASSWORD_RE` / `LOGIN_POLICY` | `key, value(jsonb), category, updated_by, updated_at` |
| **`price_tiers`** 价格档位 | InventoryView L127–132 的 `0.92/0.78/0.85/0.75/1.15` | `id, code, name, sort, currency, is_active` |
| **`product_prices`** SKU×档位价 | 完全不存在（靠乘法算） | `product_id, tier_id, price, currency, valid_from, valid_to, min_qty` ← 支持阶梯价/时段价 |
| **`product_categories`** | `products.category` 自由文本 | `id, parent_id, name, code, sort, tax_rate, is_active` |
| **`carriers`** 承运商 | `shipments.carrier` 自由文本 | `id, name, code, tracking_url_template, service_levels, is_active` |
| **`notification_rules`** | settings/page.tsx L146–152 的 5 条 | `id, event_key, name, channels, threshold(jsonb), recipients, enabled` |
| **`approval_rules`** 审批阈值 | `APPROVAL_L1/L2`、`REFUND_TIERS` | `id, action_key, min_amount, max_amount, currency, required_level, require_2fa` |
| **`approval_requests`** 审批单 | 不存在（AdminMenu 有入口无页面） | `id, action_key, requester_id, approver_id, payload, status, decided_at` |
| **`site_sections`** 官网 CMS | BrandView L23–37 | `id, key, title, sub, status, sort, updated_by, updated_at` |
| **`site_content_i18n`** 多语言文案 | `langs:"中 / EN"` 只是标签 | `section_id, locale, field_key, value(text)` ← **没有这张表，"支持中英文"就是空话** |
| **`payment_gateways`** 支付配置 | PaymentsView L234–276 | `id, provider, merchant_no, app_id, cert_ref, notify_url, scenarios, status, cert_expires_at, fee_rate` |

### P1 —— 让 RBAC 落地

`roles` · `permission_modules` · `permission_actions` · `role_permissions` · `data_scopes` · `departments` · `admin_sessions`（现在无法"踢下线单个设备"）

### P2 —— 让首页与分析页不再是假的

`daily_metrics` · `web_analytics_daily` · `funnel_steps` · `web_events` · `alerts/todos` · **`customer_points` + `points_ledger`** · `membership_tiers` · `dictionaries`

### ⚠️ 三个跨表的结构性问题

#### 1. 所有时间字段是 `text` 而非 `timestamptz`

`orders.created_at`、`customers.last_order_at`、`shipments.shipped_at`、`payments.paid_at`、`admins.last_login` **全是 `text`**（0001 L79/L80/L93/L115/L126、0002 L24/L61）。

后果：
- `.order("created_at", {ascending:false})` 是**字符串排序**
- 无法做日期范围查询、无法建时间分区、**无法算日/周/月聚合**
- **这是"仪表盘接不上真数据"的根因之一** —— 就算填了真订单，也算不出「今日销售额」

> seed 里 `admins.last_login` 存的是 `'今天 09:32'`、`'3 天前'` 这种**相对时间字符串**，永远不会变。

只有 `admin_audit_logs`（0003 L128）和 `admins.created_at/updated_at` 用对了 `timestamptz`。

#### 2. 主键是 `text` + 人工前缀

`'a-001'`、`'p-001'`、`'wh-cn'`。跨环境合并会主键碰撞；`create-admin.mts` L74 的 `a-{uuid前8位}` 与 seed 的 `a-001` 是**两套命名空间**。

#### 3. RLS 只有读策略，且过度开放

见 G6。**零条写策略** —— 即使前端补齐按钮，anon/authenticated 也会被 RLS 全部拒绝，必须走 service_role，**应用层是唯一的授权边界**；而 `can()` / `canSeeSensitive()` 目前零调用。

### 现有表的字段缺口（摘要）

| 表 | 缺失字段 |
| --- | --- |
| `orders` | `city` `address` `currency` `exchange_rate` `freight_fee` `discount` `tax` `remark` `updated_at` `approved_by/at` |
| `products` | `unit` `spec` `barcode` `tax_rate` `images` `description` `weight` `category_id`(FK) |
| `customers` | **`points` `growth` `tier_id`** `tags` `birthday` `address` `next_follow_up_at` |
| `dealers` | `discount_rate` `payment_terms` `bank_account` `owner_admin_id` |
| `warehouses` | `address` `contact` `phone` `is_active` `type`（且 `code` 被塞了 `'12 家'`） |
| `shipments` | `carrier_id`(FK) `freight_cost` `estimated_at` `delivered_at` `track_events`、**`order_id`（现在只有文本 `order_no`，无外键）** |
| `brand_assets` | **`url`/`storage_path`（没有文件地址字段！）** `mime` `bytes`（现在 `size` 是 `'2.4 MB'` 字符串） |
| `admins` | `role_id`(FK) `dept_id`(FK) `last_login_at timestamptz` `two_factor_secret` |
| `system_users` | **整张表与 `admins` 语义重叠**，且 `getSystemUsers()` 零调用 → 建议合并或删除 |

---

## 七、建议的处理优先级

### 🔴 P0 · 安全与合规（与 mock 数据无关，但更紧急）

1. **移除 `DEMO_ADMIN` 降级路径**（context.ts L53/L56 + proxy.ts L31）—— 配置缺失应当**拒绝服务**，而不是降级成超管
2. **删除 11 条伪造审计流水**（RecentActivity / SAMPLE_LOGS / SAMPLE_AUTH / SAMPLE_OPS）→ 改成明确空态
3. **修正安全策略页**：把未实现的 4 条（新设备验证码、强制 2FA、导出审批、脱敏）改成"规划中"，或补齐实现
4. **收回 `payments` / `refunds` / `customers` 的 anon public read**
5. 清理 `create-admin.mts` 的明文口令注释 + 修 `password_change_required` 矛盾 + 补审计
6. 把 `maskPhone()` 真正接到 CRM 表格上

### 🟠 P1 · 数据模型地基（不做这步，后面全是白搭）

7. **所有时间列 `text` → `timestamptz`**（这是仪表盘能接真数据的前提）
8. 建 `app_settings` 配置表，把散落 3~4 处的安全阈值收敛到单一来源
9. 建 `price_tiers` + `product_prices`，把六档价格从"乘法"变成"存储"
10. 建 `dictionaries` 或独立字典表，收敛 `tokens.ts` 的 15 张映射表 + `types.ts` 的联合类型

### 🟡 P2 · 打通写入路径

11. 商品 / 订单 / 客户 / 仓库的基础 CRUD Server Action（配套 RLS 写策略）
12. 支付渠道配置页（`payment_gateways`）
13. 官网 CMS（`site_sections` + `site_content_i18n`）—— 承诺落差最大的一块
14. 出入库单据（这是库存**唯一合法变动来源**，目前完全缺失）

### 🟢 P3 · 让数字变真

15. 建 `daily_metrics`，用真实聚合替换 `charts.ts:genSeries()` 伪随机数
16. 首页 6 张 KPI + `queries.ts` 的 18 个纯 mock 函数接真实查询
17. 会员积分改成持久化字段 + 流水表
18. 修 `fetchTable` 的空表回退逻辑；去掉/条件化 Header 的「实时」徽标

---

## 八、附录：按文件索引

| 文件 | 主要问题 | 严重度 |
| --- | --- | --- |
| `src/lib/charts.ts` | 伪随机数生成全部曲线 + 日期锚点写死 2026-06-20 | 🔴 |
| `src/lib/auth/context.ts` | `DEMO_ADMIN` 超管降级 | 🔴 |
| `src/proxy.ts` | 未配置时路由守卫短路 | 🔴 |
| `src/lib/mock/data.ts` | 25 个 export，全系统假数据源头 | 🔴 |
| `src/lib/mock/web.ts` | 官网分析全量假数据 + 埋点事件字典 | 🟠 |
| `src/lib/mock/admin.ts` | 9 个管理员账号 | 🟠 |
| `src/lib/data/queries.ts` | 18 个纯 mock 函数 + 空表回退缺陷 | 🔴 |
| `src/lib/tokens.ts` | 15 张状态字典 + `¥` 硬编码 + `maskPhone` 零调用 | 🟠 |
| `src/lib/rbac.ts` | 7 组常量为死代码 + `REFUND_TIERS` 不可计算 | 🟠 |
| `src/lib/types.ts` | 联合类型编译期封死所有字典 | 🟠 |
| `src/lib/nav.ts` | 菜单树写死 + 徽标 `128`/`3` 假计数 | 🟡 |
| `inventory/InventoryView.tsx` | **六档价格倍率** | 🔴 |
| `payments/PaymentsView.tsx` | **支付配置整页只读** + 无费率表 | 🔴 |
| `brand/BrandView.tsx` | **官网 CMS 无正文字段** | 🔴 |
| `crm/CrmView.tsx` | **积分/成长值渲染时现算** + 手机号明文 | 🔴 |
| `app/(app)/page.tsx` | 6 张 KPI 全字符串常量 | 🟠 |
| `dashboard/RecentActivity.tsx` | 5 条伪造操作流水 | 🔴 |
| `settings/page.tsx` | 通知开关是文字 + 假日志 | 🟠 |
| `settings/SecurityPolicy.tsx` | 未实现的安全承诺打绿勾 | 🔴 |
| `orders/OrdersView.tsx` | 6 个批量操作渲染成 `<span>` | 🟠 |
| `analytics/page.tsx` | 写死日期 `2024-01-01` + 常数除法冒充计算 | 🟠 |
| `components/shell/Header.tsx` | 「实时」徽标 + 通知数 `9` + 搜索框纯装饰 | 🟠 |
| `scripts/create-admin.mts` | 明文口令注释 + 绕过强制改密 + 无审计 | 🔴 |
| `supabase/migrations/*.sql` | 时间列全 `text` + 零写策略 + 过度开放 RLS | 🔴 |

---

*本文档由 10 个并行 agent 分片盘点全库生成，关键结论（伪随机图表、积分公式、价格倍率、支付配置、死代码清单、降级路径）已逐条打开源文件人工复核。*
*已修正 agent 的一处误报：`InfoHint` 组件并非死代码（在 `WebAnalytics.tsx` 有 8 处引用）。*

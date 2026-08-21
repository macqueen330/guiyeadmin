// Domain model for the Guiye (瑰野) cross-border operations console.
// These types mirror the Supabase schema in supabase/migrations/*.sql —
// snake_case field names match the SQL columns so `select('*')` rows are usable
// unchanged.
//
// 字典类联合类型仍然保留：它们是「合法取值集合」，由 supabase/seed_reference.sql
// 的 dictionaries 表同步维护中文名 / 配色 / 排序。运营改的是标签，不是取值。

export type OrderStatus =
  | "pending" // 待付款
  | "review" // 待审核
  | "assign" // 待分配
  | "prep" // 备货中
  | "shipped" // 已发货
  | "signed" // 已签收
  | "settled" // 已结算
  | "refund"; // 已退款

export type OrderSource =
  | "web"
  | "dealer"
  | "fair"
  | "whatsapp"
  | "instagram"
  | "wechat"
  | "wholesale";

// 订单类型（业务性质）· 下单渠道（在哪下单）· 客户来源（最早从哪认识）。
export type OrderType =
  | "retail" // 零售订单
  | "channel" // 渠道订单
  | "enterprise" // 企业采购
  | "sample" // 样品订单
  | "event" // 活动订单
  | "reissue"; // 售后补发

export type OrderChannel =
  | "web_store" // 官网商城
  | "wechat_store" // 微信商城
  | "backend" // 后台代下单
  | "offline_pos" // 线下收银
  | "api"; // API 导入

export type CustomerSource =
  | "wechat"
  | "xhs" // 小红书
  | "instagram"
  | "whatsapp"
  | "fair" // 展会
  | "referral" // 转介绍
  | "organic"; // 自然搜索

export type PaymentMethod =
  | "wechat_pay" // 微信支付
  | "alipay" // 支付宝
  | "unionpay" // 银联
  | "bank_transfer" // 银行转账
  | "offline" // 线下收款
  | "credit_term" // 账期
  | "unpaid"; // 未支付

// Order status is split into four independent lines so payment ≠ fulfillment ≠
// settlement. `status` / `source` below are derived by the DB trigger
// gy_orders_derive() (migration 0007) — never write them from application code.
export type PayStatus =
  | "unpaid"
  | "paying"
  | "paid"
  | "failed"
  | "partial_refund"
  | "refunded"
  | "pay_exception";

export type FulfillStatus =
  | "assign"
  | "prep"
  | "wait_ship"
  | "shipped"
  | "signed"
  | "fulfill_exception";

export type SettleStatus =
  | "unsettled"
  | "reconciling"
  | "settled"
  | "settle_exception";

export interface Order {
  id: string;
  order_no: string;
  customer_id: string | null;
  customer_name: string;
  country: string;
  province?: string | null; // 国内订单的省，海外订单留空
  city?: string | null;
  address?: string | null;
  contact_phone?: string | null;
  order_type: OrderType;
  order_channel: OrderChannel;
  customer_source: CustomerSource;
  payment_method: PaymentMethod;
  warehouse_id?: string | null;
  ship_from: string;
  currency: string;
  exchange_rate: number;
  goods_amount: number;
  freight_fee: number;
  discount: number;
  tax: number;
  amount: number; // 应付
  amount_received: number; // 实付
  pay_status: PayStatus;
  fulfill_status: FulfillStatus;
  settle_status: SettleStatus;
  remark?: string | null;
  // Derived by the database trigger — read-only for the app.
  source: OrderSource;
  status: OrderStatus;
  paid_at?: string | null;
  shipped_at?: string | null;
  signed_at?: string | null;
  cancelled_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

// 支付流水 — keyed off the platform transaction, not just the internal order,
// so 微信/支付宝/银联 reconciliation has an authoritative record.
export interface PaymentTxn {
  id: string;
  order_no: string;
  txn_no: string; // 平台支付流水号
  method: PaymentMethod;
  merchant_no: string; // 支付渠道商户号
  gateway_id?: string | null;
  amount_due: number;
  amount_paid: number;
  fee: number;
  fee_rate: number;
  currency: string;
  pay_status: PayStatus;
  paid_at: string | null;
  arrived: boolean;
  settle_status: SettleStatus;
  refunded: number;
  raw?: unknown;
  created_at?: string;
}

export type RefundStatus =
  | "applying"
  | "reviewing"
  | "processing"
  | "success"
  | "reconciled"
  | "rejected";

// 退款单 — a single order can have 多笔退款，累计不超过原交易。
export interface RefundRecord {
  id: string;
  order_no: string;
  refund_no: string;
  origin_txn_no: string;
  method: PaymentMethod;
  gateway_id?: string | null;
  applied_amount: number;
  actual_amount: number;
  currency: string;
  reason: string;
  operator: string;
  operator_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  reject_note?: string | null;
  applied_at: string;
  arrived_at: string | null;
  partial: boolean;
  status: RefundStatus;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  sku_code: string;
  qty: number;
  price: number;
  cost: number;
  discount: number;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  order_no: string;
  event_type: string;
  field: string | null;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  operator_id: string | null;
  operator_name: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  country: string;
  email: string;
  phone: string;
  type: "individual" | "dealer" | "wholesale";
  level: string; // 展示用等级名（与 membership_tiers.name 同步）
  tier_id: string | null;
  points: number;
  growth: number;
  orders_count: number;
  total_spent: number;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  birthday?: string | null;
  source?: string | null;
  remark?: string | null;
  status: string;
  last_order_at: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  bg: string;
  sort: number;
}

export interface CustomerFollowUp {
  id: string;
  customer_id: string;
  channel: string;
  content: string;
  next_at: string | null;
  operator_id: string | null;
  operator_name: string | null;
  created_at: string;
}

export interface MembershipTier {
  id: string;
  code: string;
  name: string;
  min_spent: number;
  min_orders: number;
  discount_rate: number;
  points_per_currency: number;
  growth_per_order: number;
  color: string;
  bg: string;
  sort: number;
  is_active: boolean;
}

export interface PointsEntry {
  id: string;
  customer_id: string;
  change: number;
  balance_after: number;
  type: string;
  reason: string | null;
  ref_no: string | null;
  operator_id: string | null;
  operator_name: string | null;
  expires_at: string | null;
  created_at: string;
}

export type DealerStatus = "active" | "pending" | "suspended";

export interface Dealer {
  id: string;
  name: string;
  region: string;
  contact: string;
  level: string;
  status: DealerStatus;
  contract_end: string | null;
  credit_limit: number;
  debt: number;
  mtd_sales: number;
  discount_rate: number;
  payment_terms_days: number;
  bank_account?: string | null;
  owner_admin_id?: string | null;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  region: string;
  address?: string | null;
  contact?: string | null;
  phone?: string | null;
  type: string; // own | bonded | dealer | 3pl
  is_active: boolean;
  sort: number;
}

export interface ProductCategory {
  id: string;
  parent_id: string | null;
  name: string;
  code: string;
  sort: number;
  tax_rate: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  category_id: string | null;
  price: number;
  cost: number;
  safety_stock: number;
  status: "active" | "draft" | "archived";
  unit: string;
  spec?: string | null;
  barcode?: string | null;
  tax_rate: number;
  image_url?: string | null;
  description?: string | null;
  weight_g?: number | null;
  sort: number;
  created_at?: string;
  updated_at?: string;
}

export interface PriceTier {
  id: string;
  code: string;
  name: string;
  sort: number;
  currency: string;
  default_factor: number;
  requires_approval: boolean;
  is_active: boolean;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  tier_id: string;
  price: number;
  currency: string;
  min_qty: number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
}

export interface InventoryRow {
  id: string;
  product_id: string;
  product_name: string;
  sku_code: string;
  warehouse_id: string;
  warehouse_name: string;
  sellable: number;
  locked: number;
  transit: number;
  safety_stock: number;
}

export interface InventoryMove {
  id: string;
  move_no: string;
  type: "in" | "out" | "transfer" | "adjust";
  product_id: string;
  warehouse_id: string;
  to_warehouse_id: string | null;
  qty: number;
  before_sellable: number | null;
  after_sellable: number | null;
  reason: string | null;
  ref_no: string | null;
  operator_id: string | null;
  operator_name: string | null;
  status: string;
  occurred_at: string;
}

export type ShipmentStatus =
  | "preparing"
  | "in_transit"
  | "customs"
  | "delivered"
  | "exception";

export interface Shipment {
  id: string;
  order_id: string | null;
  order_no: string;
  carrier_id: string | null;
  carrier: string;
  tracking_no: string;
  destination: string;
  status: ShipmentStatus;
  exception: string | null;
  warehouse_id?: string | null;
  freight_cost: number;
  weight_g?: number | null;
  external_no?: string | null;
  estimated_at: string | null;
  delivered_at: string | null;
  last_synced_at?: string | null;
  shipped_at: string | null;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  occurred_at: string;
  status: string;
  location: string | null;
  description: string | null;
  source: "manual" | "carrier_api" | "webhook";
}

export interface Carrier {
  id: string;
  code: string;
  name: string;
  region: string | null;
  contact: string | null;
  phone: string | null;
  tracking_url_template: string | null;
  service_levels: string[];
  /** null = 尚未接入物流公司 API，只能人工录单 */
  api_provider: string | null;
  api_base_url: string | null;
  api_credential_env: string | null;
  webhook_secret_env: string | null;
  api_config: Record<string, unknown>;
  is_active: boolean;
  sort: number;
}

export type SettlementStatus = "pending" | "paid" | "overdue";

export interface Settlement {
  id: string;
  ref_no: string;
  type: "dealer_payout" | "refund" | "receivable" | "invoice";
  party: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  due_date: string | null;
  paid_at: string | null;
  remark?: string | null;
  created_at: string;
}

export interface BrandAsset {
  id: string;
  title: string;
  category: string;
  kind: "image" | "video" | "doc" | "deck";
  size: string;
  updated_at: string;
}

// ---- 支付渠道配置（微信 / 支付宝 / 银联 API 接入位）----

export type PaymentProviderKey =
  | "wechat_pay"
  | "alipay"
  | "unionpay"
  | "bank_transfer"
  | "offline"
  | "credit_term";

export interface PaymentGateway {
  id: string;
  provider: PaymentProviderKey;
  name: string;
  merchant_no: string | null;
  app_id: string | null;
  /** 环境变量名 — 密钥本身永不入库 */
  credential_env: string | null;
  cert_ref: string | null;
  cert_expires_at: string | null;
  notify_url: string | null;
  return_url: string | null;
  scenarios: string[];
  fee_rate: number;
  fee_fixed: number;
  settle_cycle: string | null;
  bank_account_name: string | null;
  bank_account_no: string | null;
  bank_name: string | null;
  term_days: number | null;
  status: "enabled" | "disabled" | "pending";
  test_status: "passed" | "failed" | "untested";
  last_test_at: string | null;
  last_test_message: string | null;
  is_sandbox: boolean;
  config: Record<string, unknown>;
  sort: number;
  updated_at?: string;
}

export interface ReconciliationBatch {
  id: string;
  provider: string;
  stat_date: string;
  file_name: string | null;
  total_rows: number;
  matched_rows: number;
  diff_rows: number;
  total_amount: number;
  total_fee: number;
  status: string;
  note: string | null;
  operator_name: string | null;
  created_at: string;
}

// ---- 配置 / 字典 / 规则 ----

export interface AppSetting {
  key: string;
  value: unknown;
  value_type: "string" | "number" | "boolean" | "json";
  category: string;
  label: string;
  description: string | null;
  min_value: number | null;
  max_value: number | null;
  updated_at: string;
}

export interface DictEntry {
  id: string;
  group_key: string;
  code: string;
  label: string;
  color: string;
  bg: string;
  sort: number;
  is_active: boolean;
  is_system: boolean;
}

export interface NotificationRule {
  id: string;
  event_key: string;
  name: string;
  description: string | null;
  channels: string[];
  threshold: Record<string, unknown>;
  recipients: string[];
  enabled: boolean;
  sort: number;
}

export interface ApprovalRule {
  id: string;
  action_key: string;
  name: string;
  min_amount: number;
  max_amount: number | null;
  currency: string;
  required_level: AdminLevel;
  require_2fa: boolean;
  note: string | null;
  enabled: boolean;
  sort: number;
}

export interface ApprovalRequest {
  id: string;
  request_no: string;
  action_key: string;
  title: string;
  amount: number | null;
  currency: string;
  payload: Record<string, unknown>;
  requester_id: string | null;
  requester_name: string | null;
  required_level: AdminLevel;
  approver_id: string | null;
  approver_name: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  sort: number;
  is_active: boolean;
}

export interface RoleRow {
  id: string;
  key: string;
  name: string;
  level: AdminLevel;
  scope: DataScope;
  description: string | null;
  grants: Record<string, AdminGrant>;
  is_system: boolean;
  sort: number;
}

export interface AdminSession {
  id: string;
  admin_id: string;
  session_epoch: number;
  ip: string | null;
  device: string | null;
  user_agent: string | null;
  signed_in_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

// ---- Admin & permissions (等级 + 模块权限 + 数据范围) ----

export type AdminLevel = "L1" | "L2" | "L3";

export type DataScope =
  | "all"
  | "region"
  | "dept"
  | "subordinate"
  | "self"
  | "warehouse";

export type AdminStatus =
  | "pending"
  | "active"
  | "suspended"
  | "locked"
  | "resigned"
  | "closed";

// 模块授权：整模块("all")、只读("view")、或指定动作名数组。
export type AdminGrant = "all" | "view" | string[];

export interface Admin {
  id: string;
  name: string;
  phone: string; // full value; masked in the UI per viewer level
  email: string;
  level: AdminLevel;
  role: string;
  role_id?: string | null;
  dept: string;
  dept_id?: string | null;
  scope: DataScope;
  scope_label: string;
  status: AdminStatus;
  last_login: string;
  last_login_at?: string | null;
  avatar_url?: string | null;

  user_id?: string | null;
  grants?: Record<string, AdminGrant>;
  scope_values?: string[];
  password_change_required?: boolean;
  two_factor?: boolean;
  failed_attempts?: number;
  locked_until?: string | null;
  session_epoch?: number;
  created_by?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ---- Dashboard aggregates（全部由 src/lib/data/metrics.ts 从真实表算出）----

export interface PipelineStage {
  key: string;
  title: string;
  count: number;
  sub: string;
  tone: "accent" | "amber" | "blue" | "red";
  href?: string;
}

export interface ChannelSlice {
  label: string;
  /** 原始值（金额或单量）；百分比由 RatioDonut 自行归一化 */
  val: number;
  color: string;
}

export interface ProductRank {
  id: string;
  name: string;
  revenue: number;
  units: number;
  orders: number;
  /** 相对榜首的条宽 0–100，由取数层派生，不入库 */
  pct: number;
  growth: number;
}

export interface RegionRank {
  name: string;
  value: number;
  orders: number;
}

export interface TopSku {
  id: string;
  name: string;
  units: number;
  pct: number;
}

export interface WarehouseStock {
  id: string;
  name: string;
  code: string;
  sellable: number;
  locked: number;
  transit: number;
  low: number;
}

export interface AlertItem {
  key: string;
  title: string;
  detail: string;
  count: number;
  tone: "red" | "amber" | "blue";
  icon: "clock" | "truck" | "box" | "refund" | "cash" | "file";
  href?: string;
}

/** 一张经营 KPI 卡。数值是数字，格式化在渲染层完成（不再是预格式化字符串 + HTML）。 */
export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: "currency" | "number" | "percent";
  subLabel?: string;
  subValue?: number;
  subFormat?: "currency" | "number" | "percent";
  /** 环比变化百分比；null = 缺少可比区间 */
  delta: number | null;
  deltaLabel: string;
  /** delta 为正是否算“好” */
  positiveWhenUp: boolean;
  tone: "accent" | "clay" | "red" | "blue";
  /** 迷你趋势线的原始序列 */
  spark?: number[];
}

/** 首页 6 张今日速览。 */
export interface TodayStat {
  key: string;
  label: string;
  value: number;
  format: "currency" | "number";
  sub: string;
  icon: string;
  tone: "accent" | "clay" | "amber" | "red" | "blue";
  alert: boolean;
  href?: string;
}

/** 一条按日期分桶的时间序列。 */
export interface SeriesPoint {
  date: string; // YYYY-MM-DD（range=today 时为 YYYY-MM-DDTHH）
  label: string;
  value: number;
}

// ---- 官网数据 / 网站分析 ----

export interface WebOverview {
  pv: number;
  uv: number;
  sessions: number;
  newVisitors: number;
  productClicks: number;
  addCart: number;
  orders: number;
  paid: number;
  inquiries: number;
  avgStaySeconds: number;
  bounceRate: number;
  /** 与上一个等长区间相比的变化 %，null = 无可比数据 */
  pvDelta: number | null;
  uvDelta: number | null;
  ctr: number;
  convRate: number;
  newRate: number;
}

export interface WebViewsSummary {
  pvToday: number;
  uvToday: number;
  pvTodayDelta: number | null;
  pvMonth: number;
  uvMonth: number;
  pvMonthDelta: number | null;
  pvTotal: number;
  uvTotal: number;
  since: string | null;
}

export interface ProductAnalytics {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  views: number;
  add_cart: number;
  orders: number;
  paid: number;
}

export interface PageStat {
  page: string;
  pv: number;
  uv: number;
  /** 平均停留秒数；格式化在渲染层 */
  avg_stay_seconds: number;
  bounce: number;
}

export interface WebCity {
  name: string;
  visitors: number;
  clicks: number;
  orders: number;
}

export interface FunnelStep {
  label: string;
  count: number;
}

export interface WebEventCount {
  event_key: string;
  name: string;
  count: number;
}

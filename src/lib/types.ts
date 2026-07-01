// Domain model for the Guiye (瑰野) cross-border operations console.
// These types mirror the Supabase schema in supabase/migrations/0001_init.sql.

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

// The old single `source` mixed three dimensions. They are now separate fields:
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
// settlement. The list surfaces 支付状态 + 履约状态; settlement stays out of the
// main order status.
export type PayStatus =
  | "unpaid" // 待支付
  | "paying" // 支付中
  | "paid" // 支付成功
  | "failed" // 支付失败
  | "partial_refund" // 部分退款
  | "refunded" // 已退款
  | "pay_exception"; // 支付异常

export type FulfillStatus =
  | "assign" // 待分配仓库
  | "prep" // 备货中
  | "wait_ship" // 待发货
  | "shipped" // 已发货
  | "signed" // 已签收
  | "fulfill_exception"; // 发货异常

export type SettleStatus =
  | "unsettled" // 未结算
  | "reconciling" // 对账中
  | "settled" // 已结算
  | "settle_exception"; // 结算异常

export interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  country: string;
  order_type: OrderType;
  order_channel: OrderChannel;
  customer_source: CustomerSource;
  payment_method: PaymentMethod;
  ship_from: string;
  amount: number; // 应付
  amount_received: number; // 实付
  pay_status: PayStatus;
  fulfill_status: FulfillStatus;
  settle_status: SettleStatus;
  // Legacy coarse fields, derived from the split statuses for summary views
  // (home recent orders, CRM records, order detail flow).
  source: OrderSource;
  status: OrderStatus;
  created_at: string;
}

// 支付流水 — keyed off the platform transaction, not just the internal order,
// so 微信/支付宝/银联 reconciliation has an authoritative record.
export interface PaymentTxn {
  id: string;
  order_no: string;
  txn_no: string; // 平台支付流水号
  method: PaymentMethod;
  merchant_no: string; // 支付渠道商户号
  amount_due: number; // 应付
  amount_paid: number; // 实付
  fee: number; // 手续费
  pay_status: PayStatus;
  paid_at: string | null; // 支付时间
  arrived: boolean; // 到账状态
  settle_status: SettleStatus; // 对账状态
  refunded: number; // 累计退款
}

export type RefundStatus =
  | "applying" // 用户申请
  | "reviewing" // 客服审核
  | "processing" // 支付平台处理中
  | "success" // 退款成功
  | "reconciled" // 对账完成
  | "rejected"; // 已驳回

// 退款单 — a single order can have多笔退款 (银联等支持部分/多次退货)，累计不超过原交易。
export interface RefundRecord {
  id: string;
  order_no: string;
  refund_no: string; // 退款流水号
  origin_txn_no: string; // 原支付流水号
  method: PaymentMethod;
  applied_amount: number; // 申请退款金额
  actual_amount: number; // 实际退款金额
  reason: string;
  operator: string;
  applied_at: string;
  arrived_at: string | null; // 到账时间
  partial: boolean;
  status: RefundStatus;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  sku_code: string;
  qty: number;
  price: number;
}

export interface Customer {
  id: string;
  name: string;
  country: string;
  email: string;
  phone: string;
  type: "individual" | "dealer" | "wholesale";
  level: string; // VIP / 普通 / 新客
  orders_count: number;
  total_spent: number;
  last_order_at: string;
  created_at: string;
}

export type DealerStatus = "active" | "pending" | "suspended";

export interface Dealer {
  id: string;
  name: string;
  region: string;
  contact: string;
  level: string; // 金牌 / 银牌 / 标准
  status: DealerStatus;
  contract_end: string;
  credit_limit: number;
  debt: number;
  mtd_sales: number;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  region: string;
}

export interface Product {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  safety_stock: number;
  status: "active" | "draft" | "archived";
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

export type ShipmentStatus =
  | "preparing"
  | "in_transit"
  | "customs"
  | "delivered"
  | "exception";

export interface Shipment {
  id: string;
  order_no: string;
  carrier: string;
  tracking_no: string;
  destination: string;
  status: ShipmentStatus;
  exception: string | null;
  shipped_at: string;
}

export type SettlementStatus = "pending" | "paid" | "overdue";

export interface Settlement {
  id: string;
  ref_no: string;
  type: "dealer_payout" | "refund" | "receivable" | "invoice";
  party: string;
  amount: number;
  status: SettlementStatus;
  due_date: string;
  created_at: string;
}

export interface BrandAsset {
  id: string;
  title: string;
  category: string; // 产品图 / 视频 / 培训物料 / 品牌手册
  kind: "image" | "video" | "doc" | "deck";
  size: string;
  updated_at: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string; // 超级管理员 / 运营 / 财务 / 仓储 / 客服
  status: "active" | "invited" | "disabled";
  last_active: string;
}

// ---- Admin & permissions (等级 + 模块权限 + 数据范围) ----

export type AdminLevel = "L1" | "L2" | "L3"; // 超级管理员 / 业务管理员 / 操作员

export type DataScope =
  | "all" // 全部数据
  | "region" // 指定区域
  | "dept" // 指定部门
  | "subordinate" // 自己及下属
  | "self" // 仅本人数据
  | "warehouse"; // 指定仓库

export type AdminStatus =
  | "pending" // 待激活
  | "active" // 正常
  | "suspended" // 暂停使用
  | "locked" // 已锁定
  | "resigned" // 已离职
  | "closed"; // 已注销

export interface Admin {
  id: string;
  name: string;
  phone: string; // full value; masked in the UI per viewer level
  email: string;
  level: AdminLevel;
  role: string; // 岗位 / 角色模板名
  dept: string;
  scope: DataScope;
  scope_label: string; // e.g. 华东（江苏 / 上海 / 浙江）
  status: AdminStatus;
  last_login: string;
}

// ---- Dashboard aggregates ----

export interface PipelineStage {
  title: string;
  count: string;
  sub: string;
  tone: "accent" | "amber" | "blue" | "red";
}

export interface ChannelSlice {
  label: string;
  val: number;
  color: string;
}

// 产品销售排行 — replaces the old "销售额·渠道" panel (which duplicated the donut).
export interface ProductRank {
  name: string;
  revenue: number;
  units: number;
  orders: number;
  pct: number; // bar width relative to the top product (0–100)
  growth: number; // 环比增长 %, may be negative
}

// 地区排行 — domestic provinces/cities or overseas countries.
export interface RegionRank {
  name: string;
  value: number; // 销售额
  orders: number;
}

export interface AlertItem {
  title: string;
  detail: string;
  count: number;
  tone: "red" | "amber" | "blue";
  icon: "clock" | "truck" | "box" | "refund" | "cash" | "file";
}

export interface WarehouseStock {
  name: string;
  code: string;
  sellable: number;
  locked: number;
  transit: number;
  low: number;
}

export interface TopSku {
  name: string;
  units: number;
  pct: number;
}

export interface Kpi {
  label: string;
  value: string;
  sub: string;
  delta: string;
  deltaLabel: string;
  deltaDir: "up" | "down";
  positive: boolean;
  tone: "accent" | "clay" | "red" | "blue";
}

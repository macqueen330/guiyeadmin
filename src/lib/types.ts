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

export interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  country: string;
  source: OrderSource;
  ship_from: string;
  amount: number;
  amount_received: number;
  status: OrderStatus;
  created_at: string;
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

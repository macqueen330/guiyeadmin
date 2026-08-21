import "server-only";

// Read-side data access. Every function reads Supabase and returns [] / null
// when there is nothing to show. There is no seed-data fallback: an empty table
// renders an empty state, so live data is always distinguishable from no data.
//
// Aggregates (KPI / 排行 / 漏斗 / 待办) live in ./metrics.ts, website analytics
// in ./web.ts, configuration in ./settings.ts and ./dict.ts.

import { getDb, selectAll, coerceNumbers, num } from "./db";
import type {
  Admin,
  ApprovalRequest,
  ApprovalRule,
  BrandAsset,
  Carrier,
  Customer,
  CustomerFollowUp,
  CustomerTag,
  Dealer,
  InventoryMove,
  InventoryRow,
  MembershipTier,
  NotificationRule,
  Order,
  OrderEvent,
  OrderItem,
  PaymentGateway,
  PaymentTxn,
  PointsEntry,
  PriceTier,
  Product,
  ProductCategory,
  ProductPrice,
  ReconciliationBatch,
  RefundRecord,
  Settlement,
  Shipment,
  ShipmentEvent,
  Warehouse,
} from "../types";

// ---------------------------------------------------------------------------
// 订单
// ---------------------------------------------------------------------------

export async function getOrders(): Promise<Order[]> {
  const rows = await selectAll<Order>("orders", {
    order: { column: "created_at", ascending: false },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "amount",
    "amount_received",
    "goods_amount",
    "freight_fee",
    "discount",
    "tax",
    "exchange_rate",
  ]) as unknown as Order[];
}

export async function getRecentOrders(limit = 6): Promise<Order[]> {
  const all = await getOrders();
  return all.slice(0, limit);
}

export async function getOrderByNo(orderNo: string): Promise<Order | null> {
  const sb = await getDb();
  if (!sb) return null;
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .eq("order_no", orderNo)
    .maybeSingle();
  if (error || !data) return null;
  const [row] = coerceNumbers([data as Record<string, unknown>], [
    "amount",
    "amount_received",
    "goods_amount",
    "freight_fee",
    "discount",
    "tax",
    "exchange_rate",
  ]);
  return row as unknown as Order;
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data, error } = await sb
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("id");
  if (error || !data) return [];
  return coerceNumbers(data as Record<string, unknown>[], [
    "qty",
    "price",
    "cost",
    "discount",
  ]) as unknown as OrderItem[];
}

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data, error } = await sb
    .from("order_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as OrderEvent[];
}

/** 每张订单的累计退款（口径统一，取代三处各算一遍的 net-received 逻辑）。 */
export async function getRefundedByOrder(): Promise<Record<string, number>> {
  const sb = await getDb();
  if (!sb) return {};
  const { data, error } = await sb
    .from("order_finance_view")
    .select("order_no,refunded");
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const r of data as { order_no: string; refunded: unknown }[]) {
    out[r.order_no] = num(r.refunded);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 客户 / 会员
// ---------------------------------------------------------------------------

export async function getCustomers(): Promise<Customer[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data, error } = await sb
    .from("customers")
    .select("*")
    .is("deleted_at", null)
    .order("last_order_at", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return coerceNumbers(data as Record<string, unknown>[], [
    "orders_count",
    "total_spent",
    "points",
    "growth",
  ]) as unknown as Customer[];
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const sb = await getDb();
  if (!sb) return null;
  const { data } = await sb.from("customers").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const [row] = coerceNumbers([data as Record<string, unknown>], [
    "orders_count",
    "total_spent",
    "points",
    "growth",
  ]);
  return row as unknown as Customer;
}

export async function getMembershipTiers(): Promise<MembershipTier[]> {
  const rows = await selectAll<MembershipTier>("membership_tiers", {
    order: { column: "sort" },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "min_spent",
    "min_orders",
    "discount_rate",
    "points_per_currency",
    "growth_per_order",
  ]) as unknown as MembershipTier[];
}

export async function getCustomerTags(): Promise<CustomerTag[]> {
  return selectAll<CustomerTag>("customer_tags", { order: { column: "sort" } });
}

export async function getCustomerTagLinks(): Promise<Record<string, string[]>> {
  const sb = await getDb();
  if (!sb) return {};
  const { data } = await sb.from("customer_tag_links").select("customer_id,tag_id");
  const out: Record<string, string[]> = {};
  for (const r of (data ?? []) as { customer_id: string; tag_id: string }[]) {
    (out[r.customer_id] ??= []).push(r.tag_id);
  }
  return out;
}

export async function getPointsLedger(customerId: string, limit = 50): Promise<PointsEntry[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data } = await sb
    .from("points_ledger")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PointsEntry[];
}

export async function getFollowUps(customerId: string, limit = 20): Promise<CustomerFollowUp[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data } = await sb
    .from("customer_follow_ups")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as CustomerFollowUp[];
}

export async function getDealers(): Promise<Dealer[]> {
  const rows = await selectAll<Dealer>("dealers", {
    order: { column: "mtd_sales", ascending: false },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "credit_limit",
    "debt",
    "mtd_sales",
    "discount_rate",
    "payment_terms_days",
  ]) as unknown as Dealer[];
}

// ---------------------------------------------------------------------------
// 商品 / 价格 / 库存
// ---------------------------------------------------------------------------

export async function getProducts(): Promise<Product[]> {
  const rows = await selectAll<Product>("products", {
    order: { column: "sort" },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "price",
    "cost",
    "safety_stock",
    "tax_rate",
    "sort",
  ]) as unknown as Product[];
}

export async function getProductCategories(): Promise<ProductCategory[]> {
  return selectAll<ProductCategory>("product_categories", { order: { column: "sort" } });
}

export async function getPriceTiers(): Promise<PriceTier[]> {
  const rows = await selectAll<PriceTier>("price_tiers", { order: { column: "sort" } });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "default_factor",
    "sort",
  ]) as unknown as PriceTier[];
}

export async function getProductPrices(): Promise<ProductPrice[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data } = await sb
    .from("product_prices")
    .select("*")
    .eq("is_active", true)
    .order("min_qty", { ascending: true });
  return coerceNumbers((data ?? []) as Record<string, unknown>[], [
    "price",
    "min_qty",
  ]) as unknown as ProductPrice[];
}

export async function getWarehouses(): Promise<Warehouse[]> {
  return selectAll<Warehouse>("warehouses", { order: { column: "sort" } });
}

export async function getInventory(): Promise<InventoryRow[]> {
  const rows = await selectAll<InventoryRow>("inventory_view", {
    order: { column: "sku_code" },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "sellable",
    "locked",
    "transit",
    "safety_stock",
  ]) as unknown as InventoryRow[];
}

export async function getInventoryMoves(limit = 100): Promise<InventoryMove[]> {
  const rows = await selectAll<InventoryMove>("inventory_moves", {
    order: { column: "occurred_at", ascending: false },
    limit,
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "qty",
    "before_sellable",
    "after_sellable",
  ]) as unknown as InventoryMove[];
}

// ---------------------------------------------------------------------------
// 物流
// ---------------------------------------------------------------------------

export async function getShipments(): Promise<Shipment[]> {
  const rows = await selectAll<Shipment>("shipments", {
    order: { column: "shipped_at", ascending: false, nullsFirst: false },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "freight_cost",
  ]) as unknown as Shipment[];
}

export async function getCarriers(): Promise<Carrier[]> {
  return selectAll<Carrier>("carriers", { order: { column: "sort" } });
}

export async function getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data } = await sb
    .from("shipment_events")
    .select("*")
    .eq("shipment_id", shipmentId)
    .order("occurred_at", { ascending: false });
  return (data ?? []) as ShipmentEvent[];
}

// ---------------------------------------------------------------------------
// 支付 / 财务
// ---------------------------------------------------------------------------

export async function getPayments(): Promise<PaymentTxn[]> {
  const rows = await selectAll<PaymentTxn>("payments", {
    order: { column: "paid_at", ascending: false, nullsFirst: true },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "amount_due",
    "amount_paid",
    "fee",
    "fee_rate",
    "refunded",
  ]) as unknown as PaymentTxn[];
}

export async function getRefunds(): Promise<RefundRecord[]> {
  const rows = await selectAll<RefundRecord>("refunds", {
    order: { column: "applied_at", ascending: false },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "applied_amount",
    "actual_amount",
  ]) as unknown as RefundRecord[];
}

export async function getSettlements(): Promise<Settlement[]> {
  const rows = await selectAll<Settlement>("settlements", {
    order: { column: "created_at", ascending: false },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "amount",
  ]) as unknown as Settlement[];
}

export async function getPaymentGateways(): Promise<PaymentGateway[]> {
  const rows = await selectAll<PaymentGateway>("payment_gateways", {
    order: { column: "sort" },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "fee_rate",
    "fee_fixed",
  ]) as unknown as PaymentGateway[];
}

export async function getReconciliationBatches(limit = 50): Promise<ReconciliationBatch[]> {
  const rows = await selectAll<ReconciliationBatch>("reconciliation_batches", {
    order: { column: "created_at", ascending: false },
    limit,
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "total_rows",
    "matched_rows",
    "diff_rows",
    "total_amount",
    "total_fee",
  ]) as unknown as ReconciliationBatch[];
}

// ---------------------------------------------------------------------------
// 规则 / 审批 / 管理员
// ---------------------------------------------------------------------------

export async function getNotificationRules(): Promise<NotificationRule[]> {
  return selectAll<NotificationRule>("notification_rules", { order: { column: "sort" } });
}

export async function getApprovalRules(): Promise<ApprovalRule[]> {
  const rows = await selectAll<ApprovalRule>("approval_rules", {
    order: { column: "sort" },
  });
  return coerceNumbers(rows as unknown as Record<string, unknown>[], [
    "min_amount",
    "max_amount",
  ]) as unknown as ApprovalRule[];
}

export async function getApprovalRequests(status?: string): Promise<ApprovalRequest[]> {
  const sb = await getDb();
  if (!sb) return [];
  let q = sb.from("approval_requests").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return coerceNumbers((data ?? []) as Record<string, unknown>[], [
    "amount",
  ]) as unknown as ApprovalRequest[];
}

export async function getAdmins(): Promise<Admin[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data } = await sb
    .from("admins")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as Admin[];
}

// 品牌素材 —— 本次改造不含品牌内容模块，保留原读取方式。
export async function getBrandAssets(): Promise<BrandAsset[]> {
  return selectAll<BrandAsset>("brand_assets", {
    order: { column: "updated_at", ascending: false },
  });
}

// Read-side data access. Every function attempts Supabase first and falls back
// to bundled seed data when the project isn't connected (or a query fails), so
// the UI always renders. Server Components call these directly.

import { getSupabaseServer } from "../supabase/server";
import * as mock from "../mock/data";
import type {
  BrandAsset,
  Customer,
  Dealer,
  InventoryRow,
  Order,
  OrderItem,
  Product,
  Settlement,
  Shipment,
  SystemUser,
  Warehouse,
} from "../types";

async function fetchTable<T>(
  table: string,
  fallback: T[],
  order?: { column: string; ascending?: boolean },
): Promise<T[]> {
  const sb = await getSupabaseServer();
  if (!sb) return fallback;
  let query = sb.from(table).select("*");
  if (order) query = query.order(order.column, { ascending: order.ascending ?? true });
  const { data, error } = await query;
  if (error || !data || data.length === 0) return fallback;
  return data as T[];
}

export function getKpis() {
  return mock.kpis;
}
export function getPipeline() {
  return mock.pipeline;
}
export function getSalesChannels() {
  return mock.salesChannels;
}
export function getCustomerSources() {
  return mock.customerSources;
}
export function getProductRanking() {
  return mock.productRanking;
}
export function getProvinceRanking() {
  return mock.provinceRanking;
}
export function getAlerts() {
  return mock.alerts;
}
export function getWarehouseStock() {
  return mock.warehouseStock;
}
export function getTopSku() {
  return mock.topSku;
}

export async function getOrders(): Promise<Order[]> {
  return fetchTable<Order>("orders", mock.orders, {
    column: "created_at",
    ascending: false,
  });
}

export async function getRecentOrders(limit = 6): Promise<Order[]> {
  const all = await getOrders();
  return all.slice(0, limit);
}

export async function getOrderByNo(orderNo: string): Promise<Order | null> {
  const all = await getOrders();
  return all.find((o) => o.order_no === orderNo) ?? null;
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const sb = await getSupabaseServer();
  if (!sb) return mock.orderItems.filter((i) => i.order_id === orderId);
  const { data, error } = await sb
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);
  if (error || !data) return mock.orderItems.filter((i) => i.order_id === orderId);
  return data as OrderItem[];
}

export async function getCustomers(): Promise<Customer[]> {
  return fetchTable<Customer>("customers", mock.customers, {
    column: "last_order_at",
    ascending: false,
  });
}

export async function getDealers(): Promise<Dealer[]> {
  return fetchTable<Dealer>("dealers", mock.dealers, {
    column: "mtd_sales",
    ascending: false,
  });
}

export async function getProducts(): Promise<Product[]> {
  return fetchTable<Product>("products", mock.products, { column: "sku_code" });
}

export async function getWarehouses(): Promise<Warehouse[]> {
  return fetchTable<Warehouse>("warehouses", mock.warehouses, { column: "id" });
}

export async function getInventory(): Promise<InventoryRow[]> {
  return fetchTable<InventoryRow>("inventory_view", mock.inventory, {
    column: "sku_code",
  });
}

export async function getShipments(): Promise<Shipment[]> {
  return fetchTable<Shipment>("shipments", mock.shipments, {
    column: "shipped_at",
    ascending: false,
  });
}

export async function getSettlements(): Promise<Settlement[]> {
  return fetchTable<Settlement>("settlements", mock.settlements, {
    column: "created_at",
    ascending: false,
  });
}

export async function getBrandAssets(): Promise<BrandAsset[]> {
  return fetchTable<BrandAsset>("brand_assets", mock.brandAssets, {
    column: "updated_at",
    ascending: false,
  });
}

export async function getSystemUsers(): Promise<SystemUser[]> {
  return fetchTable<SystemUser>("system_users", mock.systemUsers, {
    column: "id",
  });
}

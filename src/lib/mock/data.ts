// Bundled seed data for the Guiye console. This is the single source of truth
// for both the offline fallback (when Supabase isn't configured) and the SQL
// seed in supabase/seed.sql. Dashboard figures intentionally match the original
// design (Guiye数据总览.dc.html).

import type {
  AlertItem,
  BrandAsset,
  ChannelSlice,
  Customer,
  Dealer,
  InventoryRow,
  Kpi,
  Order,
  OrderChannel,
  OrderItem,
  OrderSource,
  OrderStatus,
  OrderType,
  CustomerSource,
  PaymentMethod,
  PaymentTxn,
  PayStatus,
  FulfillStatus,
  RefundRecord,
  SettleStatus,
  PipelineStage,
  Product,
  ProductRank,
  RegionRank,
  Settlement,
  Shipment,
  SystemUser,
  TopSku,
  Warehouse,
  WarehouseStock,
} from "../types";

export const kpis: Kpi[] = [
  { label: "销售额（GMV）· 本月", value: "¥1,284,560", sub: "实收 <b>¥1,196,200</b>", delta: "12.4%", deltaLabel: "较上月", deltaDir: "up", positive: true, tone: "accent" },
  { label: "订单数 · 本月", value: "3,642", sub: "待发货 <b>128</b>", delta: "8.1%", deltaLabel: "较上月", deltaDir: "up", positive: true, tone: "clay" },
  { label: "退款金额 · 本月", value: "¥23,180", sub: "退款率 <b>1.82%</b>", delta: "0.4%", deltaLabel: "同比下降", deltaDir: "down", positive: true, tone: "red" },
  { label: "客单价 / 毛利率", value: "¥352.7", sub: "毛利率 <b>54.6%</b> · 复购 <b>31%</b>", delta: "5.2%", deltaLabel: "客单价提升", deltaDir: "up", positive: true, tone: "blue" },
];

export const warehouses: Warehouse[] = [
  { id: "wh-cn", name: "苏州仓", code: "CN · 苏州", region: "中国" },
  { id: "wh-eu", name: "法国 / 欧洲仓", code: "FR · 里昂", region: "欧洲" },
  { id: "wh-us", name: "美国仓", code: "US · 洛杉矶", region: "美洲" },
  { id: "wh-dealer", name: "经销商仓（合计）", code: "12 家", region: "经销商" },
];

export const products: Product[] = [
  { id: "p-001", sku_code: "GY-MJ-500", name: "瑰野·桂花酿米酒 500ml", category: "米酒", price: 168, cost: 72, safety_stock: 800, status: "active" },
  { id: "p-002", sku_code: "GY-YM-6PK", name: "瑰野·杨梅气泡果酒 6瓶", category: "果酒", price: 298, cost: 132, safety_stock: 600, status: "active" },
  { id: "p-003", sku_code: "GY-QM-GIFT", name: "瑰野·青梅清酒礼盒", category: "礼盒", price: 458, cost: 196, safety_stock: 400, status: "active" },
  { id: "p-004", sku_code: "GY-GF-1500", name: "瑰野·古法米酿 1.5L", category: "米酒", price: 388, cost: 165, safety_stock: 300, status: "active" },
  { id: "p-005", sku_code: "GY-LZ-RG", name: "瑰野·荔枝玫瑰利口酒", category: "利口酒", price: 256, cost: 108, safety_stock: 350, status: "active" },
  { id: "p-006", sku_code: "GY-YM-JIU", name: "瑰野·杨梅果酒 750ml", category: "果酒", price: 218, cost: 94, safety_stock: 500, status: "active" },
  { id: "p-007", sku_code: "GY-GH-GIFT", name: "瑰野·桂花酿礼盒装", category: "礼盒", price: 528, cost: 224, safety_stock: 250, status: "active" },
  { id: "p-008", sku_code: "GY-MG-SAKE", name: "瑰野·梅子清酒 720ml", category: "清酒", price: 288, cost: 121, safety_stock: 300, status: "active" },
  { id: "p-009", sku_code: "GY-OS-OSM", name: "瑰野·桂花乌龙气泡", category: "果酒", price: 138, cost: 58, safety_stock: 450, status: "draft" },
  { id: "p-010", sku_code: "GY-FT-SET", name: "瑰野·节庆品鉴套装", category: "礼盒", price: 688, cost: 286, safety_stock: 180, status: "active" },
];

// Per-warehouse inventory. The four headline warehouse totals match the design.
export const inventory: InventoryRow[] = [
  // China HQ — large sellable stock
  row("inv-001", "p-001", "wh-cn", 4200, 520, 360),
  row("inv-002", "p-002", "wh-cn", 3100, 410, 280),
  row("inv-003", "p-003", "wh-cn", 2600, 360, 220),
  row("inv-004", "p-004", "wh-cn", 2200, 300, 200),
  row("inv-005", "p-005", "wh-cn", 1800, 240, 180),
  row("inv-006", "p-006", "wh-cn", 2320, 180, 120),
  row("inv-007", "p-007", "wh-cn", 2200, 300, 200),
  // Europe — yangmei low
  row("inv-101", "p-001", "wh-eu", 1600, 240, 820),
  row("inv-102", "p-002", "wh-eu", 1240, 180, 640),
  row("inv-103", "p-006", "wh-eu", 120, 80, 360, 500),
  row("inv-104", "p-005", "wh-eu", 180, 60, 320, 350),
  row("inv-105", "p-003", "wh-eu", 1900, 320, 700),
  row("inv-106", "p-004", "wh-eu", 1200, 100, 280),
  // US
  row("inv-201", "p-001", "wh-us", 980, 160, 520),
  row("inv-202", "p-002", "wh-us", 760, 120, 440),
  row("inv-203", "p-003", "wh-us", 240, 80, 380, 300),
  row("inv-204", "p-005", "wh-us", 600, 100, 280),
  row("inv-205", "p-008", "wh-us", 600, 80, 240),
  // Dealer warehouses (aggregate)
  row("inv-301", "p-001", "wh-dealer", 1600, 360, 220),
  row("inv-302", "p-002", "wh-dealer", 1200, 280, 160),
  row("inv-303", "p-007", "wh-dealer", 180, 120, 80, 250),
  row("inv-304", "p-004", "wh-dealer", 1240, 240, 100),
  row("inv-305", "p-010", "wh-dealer", 1200, 120, 80),
];

function row(
  id: string,
  product_id: string,
  warehouse_id: string,
  sellable: number,
  locked: number,
  transit: number,
  safety_stock = 200,
): InventoryRow {
  const p = products.find((x) => x.id === product_id)!;
  const w = warehouses.find((x) => x.id === warehouse_id)!;
  return {
    id,
    product_id,
    product_name: p.name,
    sku_code: p.sku_code,
    warehouse_id,
    warehouse_name: w.name,
    sellable,
    locked,
    transit,
    safety_stock,
  };
}

export const dealers: Dealer[] = [
  { id: "d-001", name: "Maison Vert", region: "法国 · 巴黎", contact: "Camille Laurent", level: "金牌", status: "active", contract_end: "2026-12-31", credit_limit: 200000, debt: 0, mtd_sales: 184200, created_at: "2023-04-12" },
  { id: "d-002", name: "US West Spirits", region: "美国 · 洛杉矶", contact: "Michael Cho", level: "金牌", status: "active", contract_end: "2026-07-15", credit_limit: 300000, debt: 86400, mtd_sales: 226800, created_at: "2022-11-03" },
  { id: "d-003", name: "Tokyo Sake House", region: "日本 · 东京", contact: "佐藤 健", level: "银牌", status: "active", contract_end: "2027-03-20", credit_limit: 150000, debt: 0, mtd_sales: 132400, created_at: "2023-09-21" },
  { id: "d-004", name: "Berlin Fine Drinks", region: "德国 · 柏林", contact: "Hannah Weber", level: "银牌", status: "pending", contract_end: "2026-10-01", credit_limit: 120000, debt: 0, mtd_sales: 64800, created_at: "2024-02-18" },
  { id: "d-005", name: "Singapore Lux Trade", region: "新加坡", contact: "Lim Wei", level: "标准", status: "active", contract_end: "2026-06-30", credit_limit: 100000, debt: 24600, mtd_sales: 58200, created_at: "2024-05-30" },
  { id: "d-006", name: "Dubai Premium Cellar", region: "阿联酋 · 迪拜", contact: "Omar Haddad", level: "标准", status: "suspended", contract_end: "2026-08-12", credit_limit: 80000, debt: 41200, mtd_sales: 0, created_at: "2023-12-09" },
  { id: "d-007", name: "Seoul Craft Imports", region: "韩国 · 首尔", contact: "박지훈", level: "银牌", status: "active", contract_end: "2027-01-05", credit_limit: 130000, debt: 0, mtd_sales: 96400, created_at: "2024-01-22" },
  { id: "d-008", name: "Milano Vini", region: "意大利 · 米兰", contact: "Giulia Rossi", level: "标准", status: "active", contract_end: "2026-09-18", credit_limit: 90000, debt: 0, mtd_sales: 47600, created_at: "2024-07-14" },
];

export const customers: Customer[] = [
  { id: "c-001", name: "Camille Laurent", country: "法国 FR", email: "camille@maisonvert.fr", phone: "+33 6 12 34 56", type: "dealer", level: "VIP", orders_count: 42, total_spent: 486200, last_order_at: "2026-06-20", created_at: "2023-04-12" },
  { id: "c-002", name: "林晚晴", country: "中国 CN", email: "wanqing.lin@example.com", phone: "+86 138 0013 8000", type: "individual", level: "VIP", orders_count: 18, total_spent: 24680, last_order_at: "2026-06-20", created_at: "2024-03-08" },
  { id: "c-003", name: "Michael Cho", country: "美国 US", email: "m.cho@uswest.com", phone: "+1 213 555 0148", type: "wholesale", level: "VIP", orders_count: 31, total_spent: 312400, last_order_at: "2026-06-19", created_at: "2022-11-03" },
  { id: "c-004", name: "Hannah Weber", country: "德国 DE", email: "hannah.w@berlinfine.de", phone: "+49 30 9087 6543", type: "dealer", level: "普通", orders_count: 9, total_spent: 68400, last_order_at: "2026-06-19", created_at: "2024-02-18" },
  { id: "c-005", name: "周慕白", country: "中国 CN", email: "mubai.zhou@example.com", phone: "+86 159 8888 6666", type: "individual", level: "新客", orders_count: 2, total_spent: 574, last_order_at: "2026-06-18", created_at: "2026-05-30" },
  { id: "c-006", name: "Sophie Martin", country: "法国 FR", email: "sophie.martin@example.fr", phone: "+33 7 88 99 00", type: "individual", level: "普通", orders_count: 12, total_spent: 18420, last_order_at: "2026-06-18", created_at: "2024-09-12" },
  { id: "c-007", name: "佐藤 健", country: "日本 JP", email: "ken.sato@tokyosake.jp", phone: "+81 3 1234 5678", type: "dealer", level: "VIP", orders_count: 27, total_spent: 198600, last_order_at: "2026-06-17", created_at: "2023-09-21" },
  { id: "c-008", name: "Lim Wei", country: "新加坡 SG", email: "wei.lim@sglux.sg", phone: "+65 8123 4567", type: "wholesale", level: "普通", orders_count: 14, total_spent: 86200, last_order_at: "2026-06-16", created_at: "2024-05-30" },
  { id: "c-009", name: "陈思远", country: "中国 CN", email: "siyuan.chen@example.com", phone: "+86 137 1234 5678", type: "individual", level: "VIP", orders_count: 23, total_spent: 42800, last_order_at: "2026-06-15", created_at: "2023-07-19" },
  { id: "c-010", name: "Giulia Rossi", country: "意大利 IT", email: "giulia@milanovini.it", phone: "+39 02 8765 4321", type: "dealer", level: "普通", orders_count: 7, total_spent: 47600, last_order_at: "2026-06-14", created_at: "2024-07-14" },
];

// Legacy coarse fields are derived from the split statuses so summary views
// (home / CRM / order detail flow) keep working off a single source of truth.
const SOURCE_FROM_CHANNEL: Record<OrderChannel, OrderSource> = {
  web_store: "web",
  wechat_store: "wechat",
  backend: "dealer",
  offline_pos: "fair",
  api: "wholesale",
};

function coarseStatus(pay: PayStatus, fulfill: FulfillStatus, settle: SettleStatus): OrderStatus {
  if (pay === "refunded") return "refund";
  if (pay === "unpaid" || pay === "paying") return "pending";
  if (pay === "failed" || pay === "pay_exception" || fulfill === "fulfill_exception") return "review";
  if (fulfill === "signed") return settle === "settled" ? "settled" : "signed";
  if (fulfill === "shipped") return "shipped";
  if (fulfill === "prep" || fulfill === "wait_ship") return "prep";
  return "assign";
}

interface OrderSeed {
  id: string;
  order_no: string;
  customer_name: string;
  country: string;
  province?: string;
  order_type: OrderType;
  order_channel: OrderChannel;
  customer_source: CustomerSource;
  payment_method: PaymentMethod;
  ship_from: string;
  amount: number;
  amount_received: number;
  pay_status: PayStatus;
  fulfill_status: FulfillStatus;
  settle_status: SettleStatus;
  created_at: string;
}

function mkOrder(s: OrderSeed): Order {
  return {
    ...s,
    source: SOURCE_FROM_CHANNEL[s.order_channel],
    status: coarseStatus(s.pay_status, s.fulfill_status, s.settle_status),
  };
}

export const orders: Order[] = [
  mkOrder({ id: "o-28471", order_no: "#GY-28471", customer_name: "Camille Laurent", country: "法国 FR", order_type: "channel", order_channel: "backend", customer_source: "fair", payment_method: "bank_transfer", ship_from: "法国/欧洲仓", amount: 1186, amount_received: 1186, pay_status: "paid", fulfill_status: "shipped", settle_status: "reconciling", created_at: "2026-06-20T16:42:00Z" }),
  mkOrder({ id: "o-28470", order_no: "#GY-28470", customer_name: "林晚晴", country: "中国 CN", province: "上海 · 上海", order_type: "retail", order_channel: "web_store", customer_source: "xhs", payment_method: "unpaid", ship_from: "苏州仓", amount: 386, amount_received: 0, pay_status: "unpaid", fulfill_status: "assign", settle_status: "unsettled", created_at: "2026-06-20T15:18:00Z" }),
  mkOrder({ id: "o-28469", order_no: "#GY-28469", customer_name: "Michael Cho", country: "美国 US", order_type: "enterprise", order_channel: "api", customer_source: "referral", payment_method: "credit_term", ship_from: "美国仓", amount: 2680, amount_received: 0, pay_status: "unpaid", fulfill_status: "prep", settle_status: "unsettled", created_at: "2026-06-20T14:05:00Z" }),
  mkOrder({ id: "o-28468", order_no: "#GY-28468", customer_name: "Hannah Weber", country: "德国 DE", order_type: "retail", order_channel: "web_store", customer_source: "instagram", payment_method: "alipay", ship_from: "法国/欧洲仓", amount: 857, amount_received: 0, pay_status: "paying", fulfill_status: "prep", settle_status: "unsettled", created_at: "2026-06-20T12:36:00Z" }),
  mkOrder({ id: "o-28467", order_no: "#GY-28467", customer_name: "周慕白", country: "中国 CN", province: "江苏 · 苏州", order_type: "event", order_channel: "offline_pos", customer_source: "fair", payment_method: "wechat_pay", ship_from: "苏州仓", amount: 188, amount_received: 188, pay_status: "refunded", fulfill_status: "signed", settle_status: "reconciling", created_at: "2026-06-20T11:20:00Z" }),
  mkOrder({ id: "o-28466", order_no: "#GY-28466", customer_name: "Sophie Martin", country: "法国 FR", order_type: "retail", order_channel: "web_store", customer_source: "whatsapp", payment_method: "alipay", ship_from: "经销商·Maison Vert", amount: 1536, amount_received: 1536, pay_status: "partial_refund", fulfill_status: "signed", settle_status: "reconciling", created_at: "2026-06-20T09:48:00Z" }),
  mkOrder({ id: "o-28465", order_no: "#GY-28465", customer_name: "佐藤 健", country: "日本 JP", order_type: "channel", order_channel: "backend", customer_source: "referral", payment_method: "bank_transfer", ship_from: "经销商·Tokyo Sake House", amount: 3240, amount_received: 3240, pay_status: "paid", fulfill_status: "signed", settle_status: "settled", created_at: "2026-06-19T18:10:00Z" }),
  mkOrder({ id: "o-28464", order_no: "#GY-28464", customer_name: "Lim Wei", country: "新加坡 SG", order_type: "enterprise", order_channel: "api", customer_source: "organic", payment_method: "unionpay", ship_from: "苏州仓", amount: 1980, amount_received: 1980, pay_status: "paid", fulfill_status: "fulfill_exception", settle_status: "reconciling", created_at: "2026-06-19T16:22:00Z" }),
  mkOrder({ id: "o-28463", order_no: "#GY-28463", customer_name: "陈思远", country: "中国 CN", province: "浙江 · 杭州", order_type: "retail", order_channel: "wechat_store", customer_source: "wechat", payment_method: "wechat_pay", ship_from: "苏州仓", amount: 524, amount_received: 524, pay_status: "paid", fulfill_status: "signed", settle_status: "settled", created_at: "2026-06-19T14:51:00Z" }),
  mkOrder({ id: "o-28462", order_no: "#GY-28462", customer_name: "Giulia Rossi", country: "意大利 IT", order_type: "channel", order_channel: "backend", customer_source: "fair", payment_method: "bank_transfer", ship_from: "法国/欧洲仓", amount: 1476, amount_received: 0, pay_status: "pay_exception", fulfill_status: "assign", settle_status: "settle_exception", created_at: "2026-06-19T11:33:00Z" }),
  mkOrder({ id: "o-28461", order_no: "#GY-28461", customer_name: "Sophie Martin", country: "法国 FR", order_type: "retail", order_channel: "web_store", customer_source: "instagram", payment_method: "alipay", ship_from: "法国/欧洲仓", amount: 298, amount_received: 298, pay_status: "paid", fulfill_status: "shipped", settle_status: "reconciling", created_at: "2026-06-19T10:07:00Z" }),
  mkOrder({ id: "o-28460", order_no: "#GY-28460", customer_name: "Michael Cho", country: "美国 US", order_type: "enterprise", order_channel: "api", customer_source: "referral", payment_method: "unionpay", ship_from: "美国仓", amount: 4280, amount_received: 4280, pay_status: "paid", fulfill_status: "signed", settle_status: "settled", created_at: "2026-06-18T19:40:00Z" }),
  mkOrder({ id: "o-28459", order_no: "#GY-28459", customer_name: "林晚晴", country: "中国 CN", province: "上海 · 上海", order_type: "retail", order_channel: "wechat_store", customer_source: "wechat", payment_method: "wechat_pay", ship_from: "苏州仓", amount: 168, amount_received: 168, pay_status: "paid", fulfill_status: "signed", settle_status: "settled", created_at: "2026-06-18T15:12:00Z" }),
  mkOrder({ id: "o-28458", order_no: "#GY-28458", customer_name: "Hannah Weber", country: "德国 DE", order_type: "sample", order_channel: "backend", customer_source: "instagram", payment_method: "offline", ship_from: "法国/欧洲仓", amount: 0, amount_received: 0, pay_status: "unpaid", fulfill_status: "prep", settle_status: "unsettled", created_at: "2026-06-18T13:28:00Z" }),
  mkOrder({ id: "o-28457", order_no: "#GY-28457", customer_name: "Camille Laurent", country: "法国 FR", order_type: "reissue", order_channel: "backend", customer_source: "fair", payment_method: "offline", ship_from: "法国/欧洲仓", amount: 0, amount_received: 0, pay_status: "paid", fulfill_status: "wait_ship", settle_status: "unsettled", created_at: "2026-06-18T09:55:00Z" }),
];

// 支付流水（平台交易为准）。unpaid 账期 / 线下样品 / 0 元补发无平台流水。
export const payments: PaymentTxn[] = [
  { id: "pt-1", order_no: "#GY-28471", txn_no: "BANK-20260620-4471", method: "bank_transfer", merchant_no: "—", amount_due: 1186, amount_paid: 1186, fee: 0, pay_status: "paid", paid_at: "2026-06-20 16:58:12", arrived: true, settle_status: "reconciling", refunded: 0 },
  { id: "pt-2", order_no: "#GY-28470", txn_no: "WX-4200001962-28470", method: "wechat_pay", merchant_no: "16018****01", amount_due: 386, amount_paid: 0, fee: 0, pay_status: "unpaid", paid_at: null, arrived: false, settle_status: "unsettled", refunded: 0 },
  { id: "pt-3", order_no: "#GY-28468", txn_no: "ALI-2088****8031", method: "alipay", merchant_no: "2088****3021", amount_due: 857, amount_paid: 0, fee: 0, pay_status: "paying", paid_at: null, arrived: false, settle_status: "unsettled", refunded: 0 },
  { id: "pt-4", order_no: "#GY-28467", txn_no: "WX-4200001947-28467", method: "wechat_pay", merchant_no: "16018****01", amount_due: 188, amount_paid: 188, fee: 1.13, pay_status: "refunded", paid_at: "2026-06-20 11:24:06", arrived: true, settle_status: "reconciling", refunded: 188 },
  { id: "pt-5", order_no: "#GY-28466", txn_no: "ALI-2088****7788", method: "alipay", merchant_no: "2088****3021", amount_due: 1536, amount_paid: 1536, fee: 9.22, pay_status: "partial_refund", paid_at: "2026-06-20 09:52:41", arrived: true, settle_status: "reconciling", refunded: 336 },
  { id: "pt-6", order_no: "#GY-28465", txn_no: "BANK-20260619-4465", method: "bank_transfer", merchant_no: "—", amount_due: 3240, amount_paid: 3240, fee: 0, pay_status: "paid", paid_at: "2026-06-19 18:20:33", arrived: true, settle_status: "settled", refunded: 0 },
  { id: "pt-7", order_no: "#GY-28464", txn_no: "UP-8985****0071", method: "unionpay", merchant_no: "8985****0071", amount_due: 1980, amount_paid: 1980, fee: 9.9, pay_status: "paid", paid_at: "2026-06-19 16:31:09", arrived: true, settle_status: "reconciling", refunded: 0 },
  { id: "pt-8", order_no: "#GY-28463", txn_no: "WX-4200001938-28463", method: "wechat_pay", merchant_no: "16018****01", amount_due: 524, amount_paid: 524, fee: 3.14, pay_status: "paid", paid_at: "2026-06-19 14:55:02", arrived: true, settle_status: "settled", refunded: 0 },
  { id: "pt-9", order_no: "#GY-28462", txn_no: "BANK-20260619-4462", method: "bank_transfer", merchant_no: "—", amount_due: 1476, amount_paid: 0, fee: 0, pay_status: "pay_exception", paid_at: null, arrived: false, settle_status: "settle_exception", refunded: 0 },
  { id: "pt-10", order_no: "#GY-28461", txn_no: "ALI-2088****6120", method: "alipay", merchant_no: "2088****3021", amount_due: 298, amount_paid: 298, fee: 1.79, pay_status: "paid", paid_at: "2026-06-19 10:12:55", arrived: true, settle_status: "reconciling", refunded: 0 },
  { id: "pt-11", order_no: "#GY-28460", txn_no: "UP-8985****0060", method: "unionpay", merchant_no: "8985****0071", amount_due: 4280, amount_paid: 4280, fee: 21.4, pay_status: "paid", paid_at: "2026-06-18 19:46:18", arrived: true, settle_status: "settled", refunded: 0 },
  { id: "pt-12", order_no: "#GY-28459", txn_no: "WX-4200001915-28459", method: "wechat_pay", merchant_no: "16018****01", amount_due: 168, amount_paid: 168, fee: 1.01, pay_status: "paid", paid_at: "2026-06-18 15:16:44", arrived: true, settle_status: "settled", refunded: 0 },
];

// 退款单 — 一笔订单可对应多笔退款（#GY-28466 有两笔），累计不超过原交易。
export const refunds: RefundRecord[] = [
  { id: "rf-1", order_no: "#GY-28467", refund_no: "WXR-4620001947-01", origin_txn_no: "WX-4200001947-28467", method: "wechat_pay", applied_amount: 188, actual_amount: 188, reason: "活动取消 · 全额退款", operator: "刘洋", applied_at: "2026-06-20 11:40:12", arrived_at: "2026-06-20 11:52:03", partial: false, status: "reconciled" },
  { id: "rf-2", order_no: "#GY-28466", refund_no: "ALR-4620007788-01", origin_txn_no: "ALI-2088****7788", method: "alipay", applied_amount: 236, actual_amount: 236, reason: "一件破损补偿", operator: "王浩然", applied_at: "2026-06-20 10:30:20", arrived_at: "2026-06-20 10:41:55", partial: true, status: "success" },
  { id: "rf-3", order_no: "#GY-28466", refund_no: "ALR-4620007788-02", origin_txn_no: "ALI-2088****7788", method: "alipay", applied_amount: 100, actual_amount: 100, reason: "运费补偿", operator: "王浩然", applied_at: "2026-06-20 14:02:10", arrived_at: null, partial: true, status: "processing" },
  { id: "rf-4", order_no: "#GY-28462", refund_no: "BKR-4620004462-01", origin_txn_no: "BANK-20260619-4462", method: "bank_transfer", applied_amount: 1476, actual_amount: 0, reason: "支付异常 · 待人工核实", operator: "王浩然", applied_at: "2026-06-19 12:10:44", arrived_at: null, partial: false, status: "reviewing" },
];

export const orderItems: OrderItem[] = [
  { id: "oi-1", order_id: "o-28471", product_name: "瑰野·桂花酿礼盒装", sku_code: "GY-GH-GIFT", qty: 2, price: 528 },
  { id: "oi-2", order_id: "o-28471", product_name: "瑰野·青梅清酒礼盒", sku_code: "GY-QM-GIFT", qty: 1, price: 458 },
  { id: "oi-3", order_id: "o-28470", product_name: "瑰野·桂花酿米酒 500ml", sku_code: "GY-MJ-500", qty: 2, price: 168 },
  { id: "oi-4", order_id: "o-28469", product_name: "瑰野·节庆品鉴套装", sku_code: "GY-FT-SET", qty: 3, price: 688 },
  { id: "oi-5", order_id: "o-28469", product_name: "瑰野·古法米酿 1.5L", sku_code: "GY-GF-1500", qty: 1, price: 388 },
];

export const shipments: Shipment[] = [
  { id: "s-001", order_no: "#GY-28471", carrier: "DHL Express", tracking_no: "DHL4582193756", destination: "法国 巴黎", status: "in_transit", exception: null, shipped_at: "2026-06-20" },
  { id: "s-002", order_no: "#GY-28466", carrier: "顺丰国际", tracking_no: "SF1209348761", destination: "法国 里昂", status: "delivered", exception: null, shipped_at: "2026-06-19" },
  { id: "s-003", order_no: "#GY-28460", carrier: "FedEx", tracking_no: "FX7781256340", destination: "美国 洛杉矶", status: "customs", exception: "清关待补税单", shipped_at: "2026-06-18" },
  { id: "s-004", order_no: "#GY-28457", carrier: "DHL Express", tracking_no: "DHL4582100912", destination: "法国 巴黎", status: "exception", exception: "包裹破损 · 待理赔", shipped_at: "2026-06-18" },
  { id: "s-005", order_no: "#GY-28464", carrier: "新加坡邮政", tracking_no: "SG556120399", destination: "新加坡", status: "in_transit", exception: null, shipped_at: "2026-06-19" },
  { id: "s-006", order_no: "#GY-28465", carrier: "日本郵便 EMS", tracking_no: "EE229381764JP", destination: "日本 东京", status: "customs", exception: "清关查验中", shipped_at: "2026-06-19" },
  { id: "s-007", order_no: "#GY-28461", carrier: "DPD", tracking_no: "DPD9087612334", destination: "法国 马赛", status: "preparing", exception: null, shipped_at: "2026-06-20" },
];

export const settlements: Settlement[] = [
  { id: "f-001", ref_no: "SETT-2026-0612", type: "dealer_payout", party: "Maison Vert", amount: 32400, status: "pending", due_date: "2026-06-30", created_at: "2026-06-12" },
  { id: "f-002", ref_no: "RCV-2026-0588", type: "receivable", party: "US West Spirits", amount: 86400, status: "overdue", due_date: "2026-06-10", created_at: "2026-05-26" },
  { id: "f-003", ref_no: "RFD-2026-0341", type: "refund", party: "周慕白", amount: 188, status: "pending", due_date: "2026-06-22", created_at: "2026-06-20" },
  { id: "f-004", ref_no: "INV-2026-1042", type: "invoice", party: "Tokyo Sake House", amount: 132400, status: "paid", due_date: "2026-06-15", created_at: "2026-06-08" },
  { id: "f-005", ref_no: "RCV-2026-0590", type: "receivable", party: "Dubai Premium Cellar", amount: 41200, status: "overdue", due_date: "2026-06-05", created_at: "2026-05-20" },
  { id: "f-006", ref_no: "SETT-2026-0613", type: "dealer_payout", party: "Tokyo Sake House", amount: 18600, status: "pending", due_date: "2026-06-28", created_at: "2026-06-14" },
  { id: "f-007", ref_no: "INV-2026-1043", type: "invoice", party: "Singapore Lux Trade", amount: 58200, status: "paid", due_date: "2026-06-16", created_at: "2026-06-09" },
  { id: "f-008", ref_no: "RFD-2026-0342", type: "refund", party: "林晚晴", amount: 386, status: "paid", due_date: "2026-06-18", created_at: "2026-06-16" },
];

export const brandAssets: BrandAsset[] = [
  { id: "b-001", title: "桂花酿米酒 · 主图组", category: "产品图", kind: "image", size: "24 张 · 86 MB", updated_at: "2026-06-15" },
  { id: "b-002", title: "瑰野品牌故事短片", category: "视频", kind: "video", size: "1 个 · 412 MB", updated_at: "2026-06-10" },
  { id: "b-003", title: "经销商培训手册 2026", category: "培训物料", kind: "doc", size: "PDF · 18 MB", updated_at: "2026-06-08" },
  { id: "b-004", title: "品牌 VI 规范手册", category: "品牌手册", kind: "deck", size: "PDF · 32 MB", updated_at: "2026-05-28" },
  { id: "b-005", title: "杨梅气泡果酒 · 详情页素材", category: "产品图", kind: "image", size: "16 张 · 54 MB", updated_at: "2026-06-12" },
  { id: "b-006", title: "展会物料 KV 设计源文件", category: "品牌手册", kind: "deck", size: "AI · 240 MB", updated_at: "2026-06-02" },
  { id: "b-007", title: "产品调饮教程合集", category: "视频", kind: "video", size: "6 个 · 1.2 GB", updated_at: "2026-05-30" },
  { id: "b-008", title: "礼盒系列拍摄大片", category: "产品图", kind: "image", size: "32 张 · 128 MB", updated_at: "2026-06-14" },
];

export const systemUsers: SystemUser[] = [
  { id: "u-001", name: "陈思远", email: "siyuan.chen@guiye.com", role: "超级管理员", status: "active", last_active: "2026-06-20 18:02" },
  { id: "u-002", name: "李娜", email: "na.li@guiye.com", role: "运营", status: "active", last_active: "2026-06-20 17:41" },
  { id: "u-003", name: "王浩然", email: "haoran.wang@guiye.com", role: "财务", status: "active", last_active: "2026-06-20 16:55" },
  { id: "u-004", name: "赵敏", email: "min.zhao@guiye.com", role: "仓储", status: "active", last_active: "2026-06-20 15:30" },
  { id: "u-005", name: "刘洋", email: "yang.liu@guiye.com", role: "客服", status: "invited", last_active: "—" },
  { id: "u-006", name: "Sophie Tran", email: "sophie.tran@guiye.com", role: "运营", status: "disabled", last_active: "2026-05-12 09:14" },
];

// ---- Dashboard aggregates (exact values from the design) ----

export const pipeline: PipelineStage[] = [
  { title: "订单进入", count: "1,284", sub: "本月新单", tone: "accent" },
  { title: "支付 / 审核", count: "86", sub: "待审核", tone: "amber" },
  { title: "匹配库存", count: "42", sub: "待分配", tone: "blue" },
  { title: "分配发货方", count: "73", sub: "备货中", tone: "accent" },
  { title: "填写物流", count: "128", sub: "待发货", tone: "amber" },
  { title: "签收 / 售后", count: "9", sub: "异常待处理", tone: "red" },
  { title: "财务结算", count: "64", sub: "待结算", tone: "blue" },
];

// 销售渠道 — where the order is finally placed (口径一：成交渠道).
export const salesChannels: ChannelSlice[] = [
  { label: "官网商城", val: 30, color: "var(--accent)" },
  { label: "人工代下单", val: 24, color: "#c2703d" },
  { label: "渠道采购", val: 18, color: "#e0a44a" },
  { label: "企业采购", val: 12, color: "#2b6cb0" },
  { label: "线下活动", val: 10, color: "#8a6fb0" },
  { label: "微信商城", val: 6, color: "#2a9c74" },
];

// 客户来源 — where the customer first discovered 瑰野 (口径二：获客来源).
export const customerSources: ChannelSlice[] = [
  { label: "小红书", val: 22, color: "#c0392b" },
  { label: "展会", val: 18, color: "#b07d18" },
  { label: "抖音", val: 14, color: "#3a403c" },
  { label: "微信", val: 12, color: "#2f7d4f" },
  { label: "线下转介绍", val: 11, color: "#c2703d" },
  { label: "Instagram", val: 9, color: "#8a6fb0" },
  { label: "自然搜索", val: 8, color: "#2b6cb0" },
  { label: "WhatsApp", val: 6, color: "#1f8a5b" },
];

// 产品销售排行（替代重复的"销售额·渠道"面板）。
export const productRanking: ProductRank[] = [
  { name: "瑰野·桂花酿米酒 500ml", revenue: 386400, units: 1842, orders: 1126, pct: 100, growth: 12.6 },
  { name: "瑰野·杨梅气泡果酒 6瓶", revenue: 312800, units: 1356, orders: 742, pct: 81, growth: 8.4 },
  { name: "瑰野·青梅清酒礼盒", revenue: 224700, units: 980, orders: 651, pct: 58, growth: 15.2 },
  { name: "瑰野·古法米酿 1.5L", revenue: 168200, units: 712, orders: 498, pct: 44, growth: -3.1 },
  { name: "瑰野·荔枝玫瑰利口酒", revenue: 124600, units: 524, orders: 386, pct: 32, growth: 6.7 },
  { name: "瑰野·桂花酿礼盒装", revenue: 98400, units: 318, orders: 246, pct: 25, growth: 21.5 },
];

// 地区排行 · 国内省市（中国业务阶段优先）。
export const provinceRanking: RegionRank[] = [
  { name: "江苏", value: 246800, orders: 642 },
  { name: "上海", value: 218400, orders: 586 },
  { name: "北京", value: 192600, orders: 503 },
  { name: "浙江", value: 168200, orders: 471 },
  { name: "广东", value: 154800, orders: 438 },
  { name: "四川", value: 96400, orders: 282 },
];

// 首页待办 — each item is a clear action, not just a number (per the spec).
export const alerts: AlertItem[] = [
  { title: "订单待发货", detail: "超时未发货 8 单", count: 8, tone: "amber", icon: "truck" },
  { title: "渠道客户待跟进", detail: "超 7 天未跟进 3 家", count: 3, tone: "red", icon: "clock" },
  { title: "报价待确认", detail: "2 份报价等待客户确认", count: 2, tone: "amber", icon: "file" },
  { title: "库存不足", detail: "杨梅果酒 等 4 个 SKU", count: 4, tone: "amber", icon: "box" },
  { title: "售后待处理", detail: "退款 / 客诉待处理", count: 1, tone: "red", icon: "refund" },
  { title: "应收逾期", detail: "US West 等 2 家逾期", count: 2, tone: "red", icon: "cash" },
];

export const warehouseStock: WarehouseStock[] = [
  { name: "苏州仓", code: "CN · 苏州", sellable: 18420, locked: 2310, transit: 1560, low: 0 },
  { name: "法国 / 欧洲仓", code: "FR · 里昂", sellable: 6240, locked: 980, transit: 3120, low: 2 },
  { name: "美国仓", code: "US · 洛杉矶", sellable: 3180, locked: 540, transit: 1860, low: 1 },
  { name: "经销商仓（合计）", code: "12 家", sellable: 5420, locked: 1120, transit: 640, low: 1 },
];

export const topSku: TopSku[] = [
  { name: "瑰野·桂花酿米酒 500ml", units: 1842, pct: 100 },
  { name: "瑰野·杨梅气泡果酒 6瓶", units: 1356, pct: 74 },
  { name: "瑰野·青梅清酒礼盒", units: 980, pct: 56 },
  { name: "瑰野·古法米酿 1.5L", units: 712, pct: 38 },
  { name: "瑰野·荔枝玫瑰利口酒", units: 524, pct: 24 },
];

import "server-only";

import { cache } from "react";
import { getDb, num } from "./db";
import { loadSettings } from "./settings";
import { loadDict } from "./dict";
import { dictLabel, dictTone } from "@/lib/dict";
import type {
  AlertItem,
  ChannelSlice,
  Kpi,
  PipelineStage,
  ProductRank,
  RegionRank,
  SeriesPoint,
  TodayStat,
  TopSku,
  WarehouseStock,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// 经营指标。全部由真实表实时聚合 —— 取代 charts.ts:genSeries() 的伪随机数、
// page.tsx 的 6 个字符串常量、mock/data.ts 的 kpis / pipeline / 各类排行榜。
//
// 口径统一放在这一个文件里：同一个「待发货」在首页、侧边栏徽标、业务流程条上
// 是同一次查询的同一个数字，不会互相矛盾。
// ---------------------------------------------------------------------------

// ---- 经营日切（按配置的时区，而不是服务器的 UTC）--------------------------

/** 该业务日 00:00 对应的 UTC 时刻。daysAgo=0 表示今天。 */
export function businessDayStart(tzOffsetHours: number, daysAgo = 0): Date {
  const shifted = new Date(Date.now() + tzOffsetHours * 3_600_000);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - daysAgo);
  return new Date(shifted.getTime() - tzOffsetHours * 3_600_000);
}

/**
 * N 小时 / N 天之前的时间戳（毫秒）。页面用它算「超时未发货」「超期未跟进」
 * 之类的阈值 —— 放在这里而不是页面里直接调 Date.now()，既统一口径，
 * 也让 Server Component 的渲染函数保持纯粹。
 */
export function hoursAgo(hours: number): number {
  return Date.now() - hours * 3_600_000;
}

export function daysAgo(days: number): number {
  return Date.now() - days * 86_400_000;
}

export function businessMonthStart(tzOffsetHours: number, monthsAgo = 0): Date {
  const shifted = new Date(Date.now() + tzOffsetHours * 3_600_000);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() - monthsAgo);
  return new Date(shifted.getTime() - tzOffsetHours * 3_600_000);
}

/** ISO 时刻 → 业务日的 YYYY-MM-DD。 */
export function businessDateKey(iso: string | Date, tzOffsetHours: number): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const shifted = new Date(d.getTime() + tzOffsetHours * 3_600_000);
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${m}-${day}`;
}

function businessHourKey(iso: string, tzOffsetHours: number): number {
  const shifted = new Date(new Date(iso).getTime() + tzOffsetHours * 3_600_000);
  return shifted.getUTCHours();
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

// ---- 原始取数 ---------------------------------------------------------------

interface OrderSlice {
  id: string;
  order_no: string;
  customer_id: string | null;
  amount: number;
  amount_received: number;
  pay_status: string;
  fulfill_status: string;
  settle_status: string;
  order_channel: string;
  order_type: string;
  customer_source: string;
  country: string;
  province: string | null;
  warehouse_id: string | null;
  created_at: string;
  paid_at: string | null;
}

const ORDER_COLS =
  "id,order_no,customer_id,amount,amount_received,pay_status,fulfill_status," +
  "settle_status,order_channel,order_type,customer_source,country,province," +
  "warehouse_id,created_at,paid_at";

async function fetchOrdersSince(since: Date): Promise<OrderSlice[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data, error } = await sb
    .from("orders")
    .select(ORDER_COLS)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(20000);
  if (error || !data) return [];
  return (data as unknown as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as OrderSlice),
    amount: num(r.amount),
    amount_received: num(r.amount_received),
  }));
}

/** 已成交订单：支付成功 / 部分退款（退款单独计入退款指标）。 */
const PAID_STATUSES = new Set(["paid", "partial_refund"]);

function sumAmount(rows: OrderSlice[]): number {
  return rows.reduce((s, o) => s + o.amount, 0);
}
function sumReceived(rows: OrderSlice[]): number {
  return rows.reduce((s, o) => s + o.amount_received, 0);
}

// ---- 首页「今日速览」6 张卡 --------------------------------------------------

export const getTodayStats = cache(async (): Promise<TodayStat[]> => {
  const sb = await getDb();
  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;
  if (!sb) return [];

  const todayStart = businessDayStart(tz, 0);
  const yesterdayStart = businessDayStart(tz, 1);

  const [orders, inventory, receivables, staleCustomers] = await Promise.all([
    fetchOrdersSince(yesterdayStart),
    sb.from("inventory_view").select("sellable,transit,safety_stock"),
    sb
      .from("settlements")
      .select("amount,status,due_date")
      .eq("type", "receivable")
      .neq("status", "paid"),
    sb
      .from("customers")
      .select("id,last_contacted_at")
      .is("deleted_at", null)
      .or(
        `last_contacted_at.is.null,last_contacted_at.lt.${new Date(
          Date.now() - settings.crm.followUpDays * 86_400_000,
        ).toISOString()}`,
      ),
  ]);

  const today = orders.filter((o) => new Date(o.created_at) >= todayStart);
  const yesterday = orders.filter((o) => new Date(o.created_at) < todayStart);

  const todaySales = sumAmount(today.filter((o) => PAID_STATUSES.has(o.pay_status)));
  const yesterdaySales = sumAmount(
    yesterday.filter((o) => PAID_STATUSES.has(o.pay_status)),
  );
  const salesDelta = pctChange(todaySales, yesterdaySales);
  const todayPaid = today.filter((o) => PAID_STATUSES.has(o.pay_status)).length;

  // 待发货（全量，不只今天）+ 其中超时的
  const pendingShip = await sb
    .from("orders")
    .select("id,created_at", { count: "exact" })
    .in("fulfill_status", ["assign", "prep", "wait_ship"])
    .not("pay_status", "in", "(refunded)")
    .limit(5000);
  const pendingRows = (pendingShip.data ?? []) as { created_at: string }[];
  const overdueCutoff = Date.now() - settings.orders.overdueShipHours * 3_600_000;
  const overdue = pendingRows.filter((r) => new Date(r.created_at).getTime() < overdueCutoff).length;

  const invRows = (inventory.data ?? []) as Record<string, unknown>[];
  const lowSkus = invRows.filter((r) => {
    const avail = num(r.sellable) + (settings.inventory.countTransit ? num(r.transit) : 0);
    return avail < num(r.safety_stock);
  }).length;

  const recvRows = (receivables.data ?? []) as Record<string, unknown>[];
  const receivableTotal = recvRows.reduce((s, r) => s + num(r.amount), 0);
  const overdueRecv = recvRows.filter(
    (r) => r.due_date && new Date(String(r.due_date)).getTime() < Date.now(),
  ).length;

  const followUpCount = (staleCustomers.data ?? []).length;

  return [
    {
      key: "today_sales",
      label: "今日销售额",
      value: todaySales,
      format: "currency",
      sub:
        salesDelta === null
          ? "昨日无成交，暂无对比"
          : `较昨日 ${salesDelta >= 0 ? "+" : ""}${salesDelta.toFixed(1)}%`,
      icon: "dollar",
      tone: "accent",
      alert: false,
      href: "/analytics",
    },
    {
      key: "today_orders",
      label: "今日订单",
      value: today.length,
      format: "number",
      sub: `已支付 ${todayPaid}`,
      icon: "bag",
      tone: "clay",
      alert: false,
      href: "/orders",
    },
    {
      key: "pending_ship",
      label: "待发货",
      value: pendingRows.length,
      format: "number",
      sub: overdue > 0 ? `含 ${overdue} 单超时` : "无超时订单",
      icon: "truck",
      tone: "amber",
      alert: overdue > 0,
      href: "/logistics?view=pending",
    },
    {
      key: "follow_up",
      label: "待跟进客户",
      value: followUpCount,
      format: "number",
      sub: `超 ${settings.crm.followUpDays} 天未跟进`,
      icon: "users",
      tone: "amber",
      alert: followUpCount > 0,
      href: "/crm",
    },
    {
      key: "low_stock",
      label: "库存预警",
      value: lowSkus,
      format: "number",
      sub: "低于安全线 SKU",
      icon: "box",
      tone: "red",
      alert: lowSkus > 0,
      href: "/inventory?view=alerts",
    },
    {
      key: "receivable",
      label: "待回款",
      value: receivableTotal,
      format: "currency",
      sub: overdueRecv > 0 ? `应收逾期 ${overdueRecv} 笔` : "无逾期应收",
      icon: "cash",
      tone: "red",
      alert: overdueRecv > 0,
      href: "/finance?view=receivable",
    },
  ];
});

// ---- 经营 KPI（本月 vs 上月）------------------------------------------------

export const getKpis = cache(async (): Promise<Kpi[]> => {
  const sb = await getDb();
  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;
  if (!sb) return [];

  const monthStart = businessMonthStart(tz, 0);
  const prevMonthStart = businessMonthStart(tz, 1);

  const orders = await fetchOrdersSince(prevMonthStart);
  const thisMonth = orders.filter((o) => new Date(o.created_at) >= monthStart);
  const lastMonth = orders.filter((o) => new Date(o.created_at) < monthStart);

  const { data: refundRows } = await sb
    .from("refunds")
    .select("actual_amount,applied_at,status")
    .gte("applied_at", prevMonthStart.toISOString())
    .in("status", ["success", "reconciled"]);
  const refunds = (refundRows ?? []) as Record<string, unknown>[];
  const refundThis = refunds
    .filter((r) => new Date(String(r.applied_at)) >= monthStart)
    .reduce((s, r) => s + num(r.actual_amount), 0);
  const refundLast = refunds
    .filter((r) => new Date(String(r.applied_at)) < monthStart)
    .reduce((s, r) => s + num(r.actual_amount), 0);

  const paidThis = thisMonth.filter((o) => PAID_STATUSES.has(o.pay_status));
  const paidLast = lastMonth.filter((o) => PAID_STATUSES.has(o.pay_status));

  const gmv = sumAmount(paidThis);
  const gmvLast = sumAmount(paidLast);
  const received = sumReceived(paidThis);
  const aov = paidThis.length ? gmv / paidThis.length : 0;
  const aovLast = paidLast.length ? gmvLast / paidLast.length : 0;
  const refundRate = gmv ? (refundThis / gmv) * 100 : 0;
  const refundRateLast = gmvLast ? (refundLast / gmvLast) * 100 : 0;

  const pendingShipCount = thisMonth.filter((o) =>
    ["assign", "prep", "wait_ship"].includes(o.fulfill_status),
  ).length;

  const sales = await getTrendSeries("sales", "30");
  const orderSeries = await getTrendSeries("orders", "30");
  const refundSeries = await getTrendSeries("refunds", "30");
  const receivedSeries = await getTrendSeries("received", "30");

  return [
    {
      key: "gmv",
      label: "销售额（GMV）· 本月",
      value: gmv,
      format: "currency",
      subLabel: "实收",
      subValue: received,
      subFormat: "currency",
      delta: pctChange(gmv, gmvLast),
      deltaLabel: "较上月",
      positiveWhenUp: true,
      tone: "accent",
      spark: sales.map((p) => p.value),
    },
    {
      key: "orders",
      label: "订单数 · 本月",
      value: thisMonth.length,
      format: "number",
      subLabel: "待发货",
      subValue: pendingShipCount,
      subFormat: "number",
      delta: pctChange(thisMonth.length, lastMonth.length),
      deltaLabel: "较上月",
      positiveWhenUp: true,
      tone: "clay",
      spark: orderSeries.map((p) => p.value),
    },
    {
      key: "refund",
      label: "退款金额 · 本月",
      value: refundThis,
      format: "currency",
      subLabel: "退款率",
      subValue: refundRate,
      subFormat: "percent",
      delta: pctChange(refundRate, refundRateLast),
      deltaLabel: "较上月",
      positiveWhenUp: false,
      tone: "red",
      spark: refundSeries.map((p) => p.value),
    },
    {
      key: "aov",
      label: "客单价 · 本月",
      value: aov,
      format: "currency",
      subLabel: "实收合计",
      subValue: received,
      subFormat: "currency",
      delta: pctChange(aov, aovLast),
      deltaLabel: "较上月",
      positiveWhenUp: true,
      tone: "blue",
      spark: receivedSeries.map((p) => p.value),
    },
  ];
});

// ---- 趋势序列（真实分桶，不再是线性同余伪随机数）----------------------------

export type TrendMetric = "sales" | "orders" | "received" | "refunds";
export type TrendRange = "today" | "7" | "30" | "90";

export async function getTrendSeries(
  metric: TrendMetric,
  range: TrendRange,
): Promise<SeriesPoint[]> {
  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;
  const sb = await getDb();
  if (!sb) return [];

  if (range === "today") {
    const start = businessDayStart(tz, 0);
    const rows = metric === "refunds" ? [] : await fetchOrdersSince(start);
    const buckets = new Array(24).fill(0);
    for (const o of rows) {
      const h = businessHourKey(o.created_at, tz);
      if (metric === "orders") buckets[h] += 1;
      else if (metric === "received") buckets[h] += o.amount_received;
      else if (PAID_STATUSES.has(o.pay_status)) buckets[h] += o.amount;
    }
    if (metric === "refunds") {
      const { data } = await sb
        .from("refunds")
        .select("actual_amount,applied_at")
        .gte("applied_at", start.toISOString())
        .in("status", ["success", "reconciled"]);
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        buckets[businessHourKey(String(r.applied_at), tz)] += num(r.actual_amount);
      }
    }
    const nowHour = businessHourKey(new Date().toISOString(), tz);
    return buckets.slice(0, nowHour + 1).map((value, i) => ({
      date: `${businessDateKey(new Date(), tz)}T${String(i).padStart(2, "0")}`,
      label: `${i}:00`,
      value,
    }));
  }

  const days = Number(range);
  const start = businessDayStart(tz, days - 1);

  const keys: string[] = [];
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const k = businessDateKey(businessDayStart(tz, i), tz);
    keys.push(k);
    buckets.set(k, 0);
  }

  if (metric === "refunds") {
    const { data } = await sb
      .from("refunds")
      .select("actual_amount,applied_at")
      .gte("applied_at", start.toISOString())
      .in("status", ["success", "reconciled"]);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const k = businessDateKey(String(r.applied_at), tz);
      if (buckets.has(k)) buckets.set(k, buckets.get(k)! + num(r.actual_amount));
    }
  } else {
    const rows = await fetchOrdersSince(start);
    for (const o of rows) {
      const k = businessDateKey(o.created_at, tz);
      if (!buckets.has(k)) continue;
      if (metric === "orders") buckets.set(k, buckets.get(k)! + 1);
      else if (metric === "received") buckets.set(k, buckets.get(k)! + o.amount_received);
      else if (PAID_STATUSES.has(o.pay_status)) buckets.set(k, buckets.get(k)! + o.amount);
    }
  }

  return keys.map((k) => {
    const [, m, d] = k.split("-");
    return { date: k, label: `${Number(m)}/${Number(d)}`, value: buckets.get(k) ?? 0 };
  });
}

// ---- 业务主流程 -------------------------------------------------------------

export const getPipeline = cache(async (): Promise<PipelineStage[]> => {
  const sb = await getDb();
  const settings = await loadSettings();
  if (!sb) return [];
  const monthStart = businessMonthStart(settings.analytics.tzOffsetHours, 0);
  const orders = await fetchOrdersSince(monthStart);

  const count = (fn: (o: OrderSlice) => boolean) => orders.filter(fn).length;

  return [
    { key: "in", title: "订单进入", count: orders.length, sub: "本月新单", tone: "accent", href: "/orders" },
    {
      key: "review",
      title: "支付 / 审核",
      count: count((o) => ["unpaid", "paying", "failed", "pay_exception"].includes(o.pay_status)),
      sub: "待支付 / 待审核",
      tone: "amber",
      href: "/orders?view=all",
    },
    {
      key: "assign",
      title: "匹配库存",
      count: count((o) => o.fulfill_status === "assign"),
      sub: "待分配",
      tone: "blue",
      href: "/logistics?view=pending",
    },
    {
      key: "prep",
      title: "分配发货方",
      count: count((o) => o.fulfill_status === "prep"),
      sub: "备货中",
      tone: "accent",
      href: "/logistics?view=pending",
    },
    {
      key: "ship",
      title: "填写物流",
      count: count((o) => o.fulfill_status === "wait_ship"),
      sub: "待发货",
      tone: "amber",
      href: "/logistics?view=pending",
    },
    {
      key: "exception",
      title: "签收 / 售后",
      count: count((o) => o.fulfill_status === "fulfill_exception"),
      sub: "异常待处理",
      tone: "red",
      href: "/orders?view=exception",
    },
    {
      key: "settle",
      title: "财务结算",
      count: count((o) => o.settle_status !== "settled"),
      sub: "待结算",
      tone: "blue",
      href: "/finance",
    },
  ];
});

// ---- 占比环形图 -------------------------------------------------------------

async function sliceBy(
  field: "order_channel" | "customer_source" | "order_type",
  dictGroup: string,
  monthsBack = 0,
): Promise<ChannelSlice[]> {
  const settings = await loadSettings();
  const dict = await loadDict();
  const start = businessMonthStart(settings.analytics.tzOffsetHours, monthsBack);
  const orders = await fetchOrdersSince(start);
  const totals = new Map<string, number>();
  for (const o of orders) {
    const key = (o[field] as string) ?? "unknown";
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, val]) => ({
      label: dictLabel(dict, dictGroup, code, code),
      val,
      color: dictTone(dict, dictGroup, code).color,
    }));
}

export const getSalesChannels = cache(() => sliceBy("order_channel", "order_channel"));
export const getCustomerSources = cache(() => sliceBy("customer_source", "customer_source"));
export const getOrderTypeMix = cache(() => sliceBy("order_type", "order_type"));

// ---- 排行榜 -----------------------------------------------------------------

interface ItemSlice {
  order_id: string;
  product_id: string | null;
  product_name: string;
  sku_code: string;
  qty: number;
  price: number;
}

async function fetchItemsForOrders(orderIds: string[]): Promise<ItemSlice[]> {
  const sb = await getDb();
  if (!sb || orderIds.length === 0) return [];
  const out: ItemSlice[] = [];
  // PostgREST 的 in() 有 URL 长度上限，分批查询。
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    const { data, error } = await sb
      .from("order_items")
      .select("order_id,product_id,product_name,sku_code,qty,price")
      .in("order_id", chunk);
    if (error || !data) continue;
    for (const r of data as Record<string, unknown>[]) {
      out.push({
        order_id: String(r.order_id),
        product_id: r.product_id ? String(r.product_id) : null,
        product_name: String(r.product_name),
        sku_code: String(r.sku_code),
        qty: num(r.qty),
        price: num(r.price),
      });
    }
  }
  return out;
}

export const getProductRanking = cache(async (limit = 6): Promise<ProductRank[]> => {
  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;
  const monthStart = businessMonthStart(tz, 0);
  const prevStart = businessMonthStart(tz, 1);

  const orders = (await fetchOrdersSince(prevStart)).filter((o) =>
    PAID_STATUSES.has(o.pay_status),
  );
  if (orders.length === 0) return [];

  const thisIds = new Set(
    orders.filter((o) => new Date(o.created_at) >= monthStart).map((o) => o.id),
  );
  const items = await fetchItemsForOrders(orders.map((o) => o.id));

  interface Agg {
    id: string;
    name: string;
    revenue: number;
    units: number;
    orders: Set<string>;
    prevRevenue: number;
  }
  const agg = new Map<string, Agg>();
  for (const it of items) {
    const key = it.product_id ?? it.sku_code;
    const a =
      agg.get(key) ??
      { id: key, name: it.product_name, revenue: 0, units: 0, orders: new Set<string>(), prevRevenue: 0 };
    const line = it.qty * it.price;
    if (thisIds.has(it.order_id)) {
      a.revenue += line;
      a.units += it.qty;
      a.orders.add(it.order_id);
    } else {
      a.prevRevenue += line;
    }
    agg.set(key, a);
  }

  const rows = [...agg.values()]
    .filter((a) => a.revenue > 0 || a.units > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
  const top = rows[0]?.revenue ?? 0;

  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    revenue: a.revenue,
    units: a.units,
    orders: a.orders.size,
    pct: top > 0 ? Math.round((a.revenue / top) * 100) : 0,
    growth: a.prevRevenue ? ((a.revenue - a.prevRevenue) / a.prevRevenue) * 100 : 0,
  }));
});

export const getTopSku = cache(async (limit = 5): Promise<TopSku[]> => {
  const ranking = await getProductRanking(20);
  const byUnits = [...ranking].sort((a, b) => b.units - a.units).slice(0, limit);
  const top = byUnits[0]?.units ?? 0;
  return byUnits.map((r) => ({
    id: r.id,
    name: r.name,
    units: r.units,
    pct: top > 0 ? Math.round((r.units / top) * 100) : 0,
  }));
});

export const getRegionRanking = cache(
  async (): Promise<{ domestic: RegionRank[]; overseas: RegionRank[] }> => {
    const settings = await loadSettings();
    const monthStart = businessMonthStart(settings.analytics.tzOffsetHours, 0);
    const orders = (await fetchOrdersSince(monthStart)).filter((o) =>
      PAID_STATUSES.has(o.pay_status),
    );

    const roll = (rows: OrderSlice[], key: (o: OrderSlice) => string | null) => {
      const m = new Map<string, { value: number; orders: number }>();
      for (const o of rows) {
        const k = key(o);
        if (!k) continue;
        const cur = m.get(k) ?? { value: 0, orders: 0 };
        cur.value += o.amount;
        cur.orders += 1;
        m.set(k, cur);
      }
      return [...m.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    };

    const isDomestic = (o: OrderSlice) => o.country?.includes("中国");
    return {
      domestic: roll(orders.filter(isDomestic), (o) => o.province?.split(" · ")[0] ?? null),
      overseas: roll(orders.filter((o) => !isDomestic(o)), (o) => o.country ?? null),
    };
  },
);

// ---- 多仓库存 ---------------------------------------------------------------

export const getWarehouseStock = cache(async (): Promise<WarehouseStock[]> => {
  const sb = await getDb();
  const settings = await loadSettings();
  if (!sb) return [];
  const [{ data: whs }, { data: inv }] = await Promise.all([
    sb.from("warehouses").select("id,name,code,sort,is_active").order("sort"),
    sb.from("inventory_view").select("warehouse_id,sellable,locked,transit,safety_stock"),
  ]);
  const rows = (inv ?? []) as Record<string, unknown>[];
  return ((whs ?? []) as Record<string, unknown>[])
    .filter((w) => w.is_active !== false)
    .map((w) => {
      const mine = rows.filter((r) => r.warehouse_id === w.id);
      const low = mine.filter((r) => {
        const avail = num(r.sellable) + (settings.inventory.countTransit ? num(r.transit) : 0);
        return avail < num(r.safety_stock);
      }).length;
      return {
        id: String(w.id),
        name: String(w.name),
        code: String(w.code),
        sellable: mine.reduce((s, r) => s + num(r.sellable), 0),
        locked: mine.reduce((s, r) => s + num(r.locked), 0),
        transit: mine.reduce((s, r) => s + num(r.transit), 0),
        low,
      };
    });
});

// ---- 今日待办 ---------------------------------------------------------------

export const getAlerts = cache(async (): Promise<AlertItem[]> => {
  const sb = await getDb();
  const settings = await loadSettings();
  if (!sb) return [];

  const overdueCutoff = new Date(
    Date.now() - settings.orders.overdueShipHours * 3_600_000,
  ).toISOString();
  const followCutoff = new Date(
    Date.now() - settings.crm.followUpDays * 86_400_000,
  ).toISOString();

  const [overdueShip, staleCustomers, lowStock, pendingRefunds, overdueRecv, payException] =
    await Promise.all([
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("fulfill_status", ["assign", "prep", "wait_ship"])
        .lt("created_at", overdueCutoff),
      sb
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .or(`last_contacted_at.is.null,last_contacted_at.lt.${followCutoff}`),
      sb.from("inventory_view").select("product_name,sellable,transit,safety_stock"),
      sb
        .from("refunds")
        .select("id", { count: "exact", head: true })
        .in("status", ["applying", "reviewing"]),
      sb
        .from("settlements")
        .select("party", { count: "exact" })
        .eq("type", "receivable")
        .neq("status", "paid")
        .lt("due_date", new Date().toISOString().slice(0, 10)),
      sb
        .from("payments")
        .select("id", { count: "exact", head: true })
        .in("pay_status", ["failed", "pay_exception"]),
    ]);

  const invRows = (lowStock.data ?? []) as Record<string, unknown>[];
  const low = invRows.filter((r) => {
    const avail = num(r.sellable) + (settings.inventory.countTransit ? num(r.transit) : 0);
    return avail < num(r.safety_stock);
  });
  const lowNames = [...new Set(low.map((r) => String(r.product_name)))];

  const recvParties = [
    ...new Set(((overdueRecv.data ?? []) as { party: string }[]).map((r) => r.party)),
  ];

  const all: AlertItem[] = [
    {
      key: "overdue_ship",
      title: "订单待发货",
      detail: `超 ${settings.orders.overdueShipHours} 小时未发货`,
      count: overdueShip.count ?? 0,
      tone: "amber",
      icon: "truck",
      href: "/logistics?view=pending",
    },
    {
      key: "follow_up",
      title: "客户待跟进",
      detail: `超 ${settings.crm.followUpDays} 天未跟进`,
      count: staleCustomers.count ?? 0,
      tone: "red",
      icon: "clock",
      href: "/crm",
    },
    {
      key: "low_stock",
      title: "库存不足",
      detail: lowNames.length
        ? `${lowNames[0]}${lowNames.length > 1 ? ` 等 ${lowNames.length} 个 SKU` : ""}`
        : "全部 SKU 高于安全库存",
      count: lowNames.length,
      tone: "amber",
      icon: "box",
      href: "/inventory?view=alerts",
    },
    {
      key: "refund",
      title: "售后待处理",
      detail: "退款申请待审核",
      count: pendingRefunds.count ?? 0,
      tone: "red",
      icon: "refund",
      href: "/payments?view=refunds",
    },
    {
      key: "receivable",
      title: "应收逾期",
      detail: recvParties.length
        ? `${recvParties[0]}${recvParties.length > 1 ? ` 等 ${recvParties.length} 家` : ""}`
        : "无逾期应收",
      count: overdueRecv.count ?? 0,
      tone: "red",
      icon: "cash",
      href: "/finance?view=receivable",
    },
    {
      key: "pay_exception",
      title: "支付异常",
      detail: "支付失败 / 异常流水",
      count: payException.count ?? 0,
      tone: "red",
      icon: "file",
      href: "/payments?view=exception",
    },
  ];

  return all.filter((a) => a.count > 0);
});

// ---- 侧边栏徽标（与首页同源，避免两处数字打架）------------------------------

export const getNavBadgeCounts = cache(async (): Promise<Record<string, number>> => {
  const sb = await getDb();
  if (!sb) return {};
  const [pendingShip, logisticsException] = await Promise.all([
    sb
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("fulfill_status", ["assign", "prep", "wait_ship"]),
    sb.from("shipments").select("id", { count: "exact", head: true }).eq("status", "exception"),
  ]);
  return {
    orders: pendingShip.count ?? 0,
    logistics: logisticsException.count ?? 0,
  };
});

// ---- 首页最近操作（真实审计日志，不再是写死的 5 条带真人姓名的流水）----------

export interface ActivityRow {
  id: string;
  actor_name: string | null;
  actor_level: string | null;
  action: string;
  module: string | null;
  detail: string | null;
  target_name: string | null;
  result: string;
  created_at: string;
}

export const getRecentActivity = cache(async (limit = 5): Promise<ActivityRow[]> => {
  const sb = await getDb();
  if (!sb) return [];
  const { data, error } = await sb
    .from("admin_audit_logs")
    .select("id,actor_name,actor_level,action,module,detail,target_name,result,created_at")
    .eq("category", "operation")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as ActivityRow[];
});

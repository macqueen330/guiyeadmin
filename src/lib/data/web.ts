import "server-only";

import { cache } from "react";
import { getDb, num, DataReadError, recordReadFailure } from "./db";
import { loadSettings } from "./settings";
import { businessDateKey, businessDayStart } from "./metrics";
import type {
  ChannelSlice,
  FunnelStep,
  PageStat,
  ProductAnalytics,
  SeriesPoint,
  WebCity,
  WebEventCount,
  WebOverview,
  WebViewsSummary,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// 官网数据。取代 src/lib/mock/web.ts 的 9 组写死数字。
//
// 数据来源：网站把埋点 POST 到 /api/analytics/collect → web_events，
// gy_rollup_web_day() 汇总成 web_analytics_daily / web_page_stats / …。
// 页面浏览同时上报给 Vercel Web Analytics（<Analytics /> in app/layout.tsx），
// 那是给运营看的实时看板；本模块是后台可查询、可与订单关联的一方数据。
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  wechat: "微信",
  xhs: "小红书",
  direct: "直接访问",
  search: "搜索引擎",
  douyin: "抖音",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  fair: "展会二维码",
  referral: "转介绍",
  email: "邮件",
  other: "其他外链",
};

const SOURCE_COLORS: Record<string, string> = {
  wechat: "#2f7d4f",
  xhs: "#c0392b",
  direct: "var(--accent)",
  search: "#2b6cb0",
  douyin: "#3a403c",
  instagram: "#8a6fb0",
  whatsapp: "#1f8a5b",
  fair: "#b07d18",
  referral: "#c2703d",
  email: "#5b6470",
  other: "#cdd2cb",
};

const FALLBACK_PALETTE = [
  "var(--accent)",
  "#c2703d",
  "#e0a44a",
  "#2b6cb0",
  "#8a6fb0",
  "#2a9c74",
  "#c0392b",
  "#5b6470",
];

const DEVICE_LABELS: Record<string, string> = {
  mobile: "手机",
  desktop: "电脑",
  tablet: "平板",
  unknown: "未知",
};

const DEVICE_COLORS: Record<string, string> = {
  mobile: "var(--accent)",
  desktop: "#2b6cb0",
  tablet: "#e0a44a",
  unknown: "#cdd2cb",
};

interface DailyRow {
  stat_date: string;
  pv: number;
  uv: number;
  sessions: number;
  new_visitors: number;
  product_clicks: number;
  product_views: number;
  add_cart: number;
  checkouts: number;
  orders: number;
  paid: number;
  inquiries: number;
  stay_seconds_total: number;
  bounce_sessions: number;
}

async function dateWindow(days: number): Promise<{ from: string; to: string; prevFrom: string }> {
  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;
  const from = businessDateKey(businessDayStart(tz, days - 1), tz);
  const to = businessDateKey(businessDayStart(tz, 0), tz);
  const prevFrom = businessDateKey(businessDayStart(tz, days * 2 - 1), tz);
  return { from, to, prevFrom };
}

async function fetchDaily(from: string, to: string): Promise<DailyRow[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data, error } = await sb
    .from("web_analytics_daily")
    .select("*")
    .gte("stat_date", from)
    .lte("stat_date", to)
    .order("stat_date");
  if (error) throw new DataReadError("web_analytics_daily", error.message);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    stat_date: String(r.stat_date),
    pv: num(r.pv),
    uv: num(r.uv),
    sessions: num(r.sessions),
    new_visitors: num(r.new_visitors),
    product_clicks: num(r.product_clicks),
    product_views: num(r.product_views),
    add_cart: num(r.add_cart),
    checkouts: num(r.checkouts),
    orders: num(r.orders),
    paid: num(r.paid),
    inquiries: num(r.inquiries),
    stay_seconds_total: num(r.stay_seconds_total),
    bounce_sessions: num(r.bounce_sessions),
  }));
}

function total(rows: DailyRow[], key: keyof DailyRow): number {
  return rows.reduce((s, r) => s + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * 窗口内的独立访客 / 会话：对 web_events.visitor_id 去重。
 *
 * 原来直接把每日 UV 相加，回访客会被重复计数 —— 30 天「独立访客」因此可能
 * 大于「新访客总数」，这在真实数据里不可能。明细超出保留期被清理时
 * （analytics.web_retention_days）拿不到去重值，此时回落到每日相加，
 * 并由调用方标注口径。
 */
/** YYYY-MM-DD 的前一天 */
function dayBefore(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

async function uniquesIn(
  from: string,
  to: string,
): Promise<{ visitors: number; sessions: number } | null> {
  const sb = await getDb();
  if (!sb) return null;
  const { data, error } = await sb.rpc("gy_web_uniques", { p_from: from, p_to: to });
  // 去重拿不到时回落到每日相加（调用方会用 uvExact 标注口径），所以这里不抛；
  // 但失败必须登记，否则「去重函数挂了」会被当成「本来就没有明细」。
  if (error) {
    recordReadFailure("gy_web_uniques", error.message);
    return null;
  }
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const visitors = num((row as Record<string, unknown>).visitors);
  const sessions = num((row as Record<string, unknown>).sessions);
  return visitors > 0 ? { visitors, sessions } : null;
}

export const getWebOverview = cache(async (days = 30): Promise<WebOverview> => {
  const { from, to, prevFrom } = await dateWindow(days);
  const all = await fetchDaily(prevFrom, to);
  const rows = all.filter((r) => r.stat_date >= from);
  const prev = all.filter((r) => r.stat_date < from);

  const pv = total(rows, "pv");
  const clicks = total(rows, "product_clicks");

  // 独立访客与会话优先用明细去重；拿不到才回落到每日相加。
  // 上一周期的结束日必须是 from 的前一天，否则两个窗口会重叠一天，环比失真。
  const prevTo = dayBefore(from);
  const [cur, prv] = await Promise.all([uniquesIn(from, to), uniquesIn(prevFrom, prevTo)]);
  const uv = cur?.visitors ?? total(rows, "uv");
  const sessions = cur?.sessions ?? total(rows, "sessions");
  const prevUv = prv?.visitors ?? total(prev, "uv");
  const uvExact = cur !== null;
  const paid = total(rows, "paid");
  const stay = total(rows, "stay_seconds_total");
  const bounce = total(rows, "bounce_sessions");
  const newVisitors = total(rows, "new_visitors");

  return {
    pv,
    uv,
    sessions,
    newVisitors,
    productClicks: clicks,
    addCart: total(rows, "add_cart"),
    orders: total(rows, "orders"),
    paid,
    inquiries: total(rows, "inquiries"),
    avgStaySeconds: pv ? stay / pv : 0,
    bounceRate: sessions ? (bounce / sessions) * 100 : 0,
    pvDelta: pctChange(pv, total(prev, "pv")),
    uvDelta: pctChange(uv, prevUv),
    ctr: pv ? (clicks / pv) * 100 : 0,
    convRate: uv ? (paid / uv) * 100 : 0,
    newRate: uv ? (newVisitors / uv) * 100 : 0,
    uvExact,
  };
});

export const getWebViews = cache(async (): Promise<WebViewsSummary> => {
  const sb = await getDb();
  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;
  const empty: WebViewsSummary = {
    pvToday: 0,
    uvToday: 0,
    pvTodayDelta: null,
    pvMonth: 0,
    uvMonth: 0,
    pvMonthDelta: null,
    pvTotal: 0,
    uvTotal: 0,
    since: null,
    uvExact: true,
  };
  if (!sb) return empty;

  const today = businessDateKey(businessDayStart(tz, 0), tz);
  const yesterday = businessDateKey(businessDayStart(tz, 1), tz);
  const monthFrom = businessDateKey(businessDayStart(tz, 29), tz);
  const prevMonthFrom = businessDateKey(businessDayStart(tz, 59), tz);

  const [{ data: recent }, { data: allRows }] = await Promise.all([
    sb
      .from("web_analytics_daily")
      .select("stat_date,pv,uv")
      .gte("stat_date", prevMonthFrom)
      .order("stat_date"),
    sb.from("web_analytics_daily").select("stat_date,pv,uv").order("stat_date"),
  ]);

  const rows = ((recent ?? []) as Record<string, unknown>[]).map((r) => ({
    d: String(r.stat_date),
    pv: num(r.pv),
    uv: num(r.uv),
  }));
  const every = ((allRows ?? []) as Record<string, unknown>[]).map((r) => ({
    d: String(r.stat_date),
    pv: num(r.pv),
    uv: num(r.uv),
  }));

  const pick = (from: string, toExclusive?: string) =>
    rows.filter((r) => r.d >= from && (!toExclusive || r.d < toExclusive));

  const todayRow = rows.find((r) => r.d === today);
  const yRow = rows.find((r) => r.d === yesterday);
  const month = pick(monthFrom);
  const prevMonth = pick(prevMonthFrom, monthFrom);

  // 独立访客按窗口去重，与下方「独立访客」KPI 用同一口径 ——
  // 否则同一个页面上会出现 406 和 314 两个「独立访客」。
  const [uMonth, uTotal] = await Promise.all([
    uniquesIn(monthFrom, today),
    every.length ? uniquesIn(every[0].d, today) : Promise.resolve(null),
  ]);

  return {
    pvToday: todayRow?.pv ?? 0,
    uvToday: todayRow?.uv ?? 0,
    pvTodayDelta: pctChange(todayRow?.pv ?? 0, yRow?.pv ?? 0),
    pvMonth: month.reduce((s, r) => s + r.pv, 0),
    uvMonth: uMonth?.visitors ?? month.reduce((s, r) => s + r.uv, 0),
    pvMonthDelta: pctChange(
      month.reduce((s, r) => s + r.pv, 0),
      prevMonth.reduce((s, r) => s + r.pv, 0),
    ),
    pvTotal: every.reduce((s, r) => s + r.pv, 0),
    uvTotal: uTotal?.visitors ?? every.reduce((s, r) => s + r.uv, 0),
    since: every[0]?.d ?? null,
    // 两个窗口只要有一个拿不到去重值，整张卡就得标成「每日相加」——
    // 不能让一半准一半不准还不说明。
    uvExact: uMonth !== null && (every.length === 0 || uTotal !== null),
  };
});

export async function getWebTrend(
  metric: "pv" | "uv" | "product_clicks" | "inquiries" | "paid",
  days: number,
): Promise<SeriesPoint[]> {
  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;
  const from = businessDateKey(businessDayStart(tz, days - 1), tz);
  const to = businessDateKey(businessDayStart(tz, 0), tz);
  const rows = await fetchDaily(from, to);
  const byDate = new Map(rows.map((r) => [r.stat_date, r]));

  const out: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = businessDateKey(businessDayStart(tz, i), tz);
    const [, m, d] = key.split("-");
    const row = byDate.get(key);
    out.push({
      date: key,
      label: `${Number(m)}/${Number(d)}`,
      value: row ? num(row[metric]) : 0,
    });
  }
  return out;
}

export const getProductAnalytics = cache(async (days = 30): Promise<ProductAnalytics[]> => {
  const sb = await getDb();
  if (!sb) return [];
  const { from, to } = await dateWindow(days);
  const [{ data: stats }, { data: products }] = await Promise.all([
    sb
      .from("web_product_stats")
      .select("*")
      .gte("stat_date", from)
      .lte("stat_date", to),
    sb.from("products").select("id,name"),
  ]);
  const names = new Map(
    ((products ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
  );

  const agg = new Map<string, ProductAnalytics>();
  for (const r of (stats ?? []) as Record<string, unknown>[]) {
    const id = String(r.product_id);
    const cur =
      agg.get(id) ??
      {
        id,
        name: names.get(id) ?? id,
        impressions: 0,
        clicks: 0,
        views: 0,
        add_cart: 0,
        orders: 0,
        paid: 0,
      };
    cur.impressions += num(r.impressions);
    cur.clicks += num(r.clicks);
    cur.views += num(r.views);
    cur.add_cart += num(r.add_cart);
    cur.orders += num(r.orders);
    cur.paid += num(r.paid);
    agg.set(id, cur);
  }
  return [...agg.values()].sort((a, b) => b.clicks - a.clicks);
});

export const getPageStats = cache(async (days = 30): Promise<PageStat[]> => {
  const sb = await getDb();
  if (!sb) return [];
  const { from, to } = await dateWindow(days);
  // 同样按窗口去重：原来是把每日 uv 相加，单个页面的「独立访客」
  // 因此可能大于整站的独立访客数。
  const { data, error } = await sb.rpc("gy_web_page_uniques", { p_from: from, p_to: to });
  if (error) throw new DataReadError("gy_web_page_uniques", error.message);

  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => {
      const pv = num(r.pv);
      const sessions = num(r.sessions);
      return {
        page: String(r.page_title ?? r.page_path),
        pv,
        uv: num(r.uv),
        avg_stay_seconds: pv ? num(r.stay_seconds_total) / pv : 0,
        bounce: sessions ? (num(r.bounce_sessions) / sessions) * 100 : 0,
      };
    })
    .sort((a, b) => b.pv - a.pv);
});

/**
 * 按维度的窗口去重（单归因）。取代原来「把每日 visitors 相加」的算法。
 *
 * 旧算法里回访客每天都会被数一次，于是同一个页面上会出现
 * 「独立访客 150」和「来源合计 386」这种不可能同时为真的两个数。
 * 现在每个访客按首次触点只归一个桶，各桶相加正好等于窗口内的独立访客数。
 */
async function dimensionUniques(
  from: string,
  to: string,
  dim: "source" | "device" | "city",
): Promise<{ key: string; visitors: number; sessions: number; clicks: number; orders: number }[]> {
  const sb = await getDb();
  if (!sb) return [];
  const { data, error } = await sb.rpc("gy_web_dimension_uniques", {
    p_from: from,
    p_to: to,
    p_dim: dim,
  });
  if (error) throw new DataReadError("gy_web_dimension_uniques", error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    key: String(r.key),
    visitors: num(r.visitors),
    sessions: num(r.sessions),
    clicks: num(r.clicks),
    orders: num(r.orders),
  }));
}

export const getTrafficSources = cache(async (days = 30): Promise<ChannelSlice[]> => {
  const { from, to } = await dateWindow(days);
  const rows = await dimensionUniques(from, to, "source");
  return rows
    .sort((a, b) => b.visitors - a.visitors)
    .map((r, i) => ({
      label: SOURCE_LABELS[r.key] ?? r.key,
      val: r.visitors,
      color: SOURCE_COLORS[r.key] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    }));
});

export const getDeviceSplit = cache(async (days = 30): Promise<ChannelSlice[]> => {
  const { from, to } = await dateWindow(days);
  const rows = await dimensionUniques(from, to, "device");
  return rows
    .sort((a, b) => b.visitors - a.visitors)
    .map((r, i) => ({
      label: DEVICE_LABELS[r.key] ?? r.key,
      val: r.visitors,
      color: DEVICE_COLORS[r.key] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    }));
});

export const getWebCities = cache(async (days = 30, limit = 8): Promise<WebCity[]> => {
  const { from, to } = await dateWindow(days);
  const rows = await dimensionUniques(from, to, "city");
  return rows
    .map((r) => ({ name: r.key, visitors: r.visitors, clicks: r.clicks, orders: r.orders }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, limit);
});

export const getOverallFunnel = cache(async (days = 30): Promise<FunnelStep[]> => {
  const o = await getWebOverview(days);
  const steps: FunnelStep[] = [
    { label: "访问官网", count: o.pv },
    { label: "点击产品", count: o.productClicks },
    { label: "加入购物车", count: o.addCart },
    { label: "提交订单", count: o.orders },
    { label: "支付成功", count: o.paid },
  ];
  return steps.some((s) => s.count > 0) ? steps : [];
});

export const getEventCounts = cache(async (days = 30): Promise<WebEventCount[]> => {
  const sb = await getDb();
  if (!sb) return [];
  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;
  const since = businessDayStart(tz, days - 1);
  // 上界必须给。occurred_at 由客户端生成，一台时钟走快的浏览器就能把事件
  // 写到未来 —— 只有 gte 的话「近 N 天」实际是「N 天前至永远」，
  // 这个面板会和按天汇总的概览 KPI 对不上。
  const until = businessDayStart(tz, -1);

  const [types, events] = await Promise.all([
    sb.from("web_event_types").select("event_key,name,sort").order("sort"),
    sb
      .from("web_events")
      .select("event_key")
      .gte("occurred_at", since.toISOString())
      .lt("occurred_at", until.toISOString())
      .limit(100000),
  ]);
  if (types.error) throw new DataReadError("web_event_types", types.error.message);
  if (events.error) throw new DataReadError("web_events", events.error.message);

  const counts = new Map<string, number>();
  for (const e of (events.data ?? []) as { event_key: string }[]) {
    counts.set(e.event_key, (counts.get(e.event_key) ?? 0) + 1);
  }

  const known = ((types.data ?? []) as { event_key: string; name: string }[]).map((t) => ({
    event_key: t.event_key,
    name: t.name,
    count: counts.get(t.event_key) ?? 0,
  }));
  // 字典里没登记的事件也要显示，否则新埋点会静默消失。
  for (const [key, count] of counts) {
    if (!known.some((k) => k.event_key === key)) {
      known.push({ event_key: key, name: key, count });
    }
  }
  return known.filter((k) => k.count > 0);
});

/**
 * 单品官网详情：漏斗数据 + 真实平均停留 + 真实销售额。
 *
 * 原来「平均停留 2分36秒」对 5 个产品显示同一个写死的值（ProductAnalytics 类型里
 * 根本没有这个字段），「估算销售额」= 支付数 × 写死的客单价 210。
 */
export async function getProductWebDetail(
  productId: string,
  days = 30,
): Promise<{
  analytics: ProductAnalytics | null;
  avgStaySeconds: number | null;
  revenue: number;
  units: number;
} | null> {
  const sb = await getDb();
  if (!sb) return null;

  const all = await getProductAnalytics(days);
  const analytics = all.find((p) => p.id === productId) ?? null;

  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;
  const since = businessDayStart(tz, days - 1).toISOString();
  const until = businessDayStart(tz, -1).toISOString(); // 同上：区间要有上界

  const [{ data: stayRows }, { data: itemRows }] = await Promise.all([
    sb
      .from("web_events")
      .select("value")
      .eq("product_id", productId)
      .eq("event_key", "page_leave")
      .gte("occurred_at", since)
      .lt("occurred_at", until),
    sb
      .from("order_items")
      .select("qty,price,orders!inner(created_at,pay_status)")
      .eq("product_id", productId)
      .gte("orders.created_at", since)
      .lt("orders.created_at", until),
  ]);

  const stays = ((stayRows ?? []) as { value: unknown }[])
    .map((r) => num(r.value))
    .filter((v) => v > 0);
  const avgStaySeconds = stays.length ? stays.reduce((s, v) => s + v, 0) / stays.length : null;

  let revenue = 0;
  let units = 0;
  for (const r of (itemRows ?? []) as Record<string, unknown>[]) {
    const order = r.orders as { pay_status?: string } | null;
    if (!order || !["paid", "partial_refund"].includes(String(order.pay_status))) continue;
    revenue += num(r.qty) * num(r.price);
    units += num(r.qty);
  }

  return { analytics, avgStaySeconds, revenue, units };
}


// ---------------------------------------------------------------------------
// 埋点链路健康度
//
// 审计里最要紧的一条：以前后台没有任何地方能区分「官网没流量」和「链路断了」——
// 跨域配错、汇总挂掉、表读不到，界面上全都长成同一句「暂无数据」。
// 这里把 guiyecy.com → 采集端点 → 数据库 → 汇总 这条链路的实际状态摆出来。
// ---------------------------------------------------------------------------

export interface TrackerHealth {
  /** 最后一次收到官网事件的时刻 */
  lastEventAt: string | null;
  /** 最近 24 小时的事件数 */
  events24h: number;
  /** 库里累计事件数 */
  eventsTotal: number;
  /** 最后一次日汇总 */
  lastRollup: { statDate: string; ok: boolean; error: string | null; ranAt: string } | null;
  /** 当前配置的跨域白名单（留空 = 允许所有来源） */
  allowedOrigins: string[];
  /** 是否要求上报携带 x-guiye-token */
  tokenRequired: boolean;
  /** 综合判断 */
  status: "ok" | "stale" | "never" | "rollup_failed";
}

/** 超过这么久没有上报就认为链路可能断了。 */
const STALE_HOURS = 24;

export const getTrackerHealth = cache(async (): Promise<TrackerHealth> => {
  const allowedOrigins = (process.env.ANALYTICS_ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const tokenRequired = Boolean(process.env.ANALYTICS_INGEST_TOKEN);

  const sb = await getDb();
  if (!sb) {
    return {
      lastEventAt: null, events24h: 0, eventsTotal: 0, lastRollup: null,
      allowedOrigins, tokenRequired, status: "never",
    };
  }

  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [latest, recent, totalRes, rollup] = await Promise.all([
    sb.from("web_events").select("occurred_at").order("occurred_at", { ascending: false }).limit(1),
    sb.from("web_events").select("id", { count: "exact", head: true }).gte("occurred_at", since),
    sb.from("web_events").select("id", { count: "exact", head: true }),
    sb
      .from("web_rollup_runs")
      .select("stat_date,ok,error,ran_at")
      .order("ran_at", { ascending: false })
      .limit(1),
  ]);
  if (latest.error) throw new DataReadError("web_events", latest.error.message);
  if (recent.error) throw new DataReadError("web_events", recent.error.message);
  if (totalRes.error) throw new DataReadError("web_events", totalRes.error.message);
  // 汇总日志表是 0011 才加的，旧库没有 —— 读不到不算故障，降级即可。
  if (rollup.error) recordReadFailure("web_rollup_runs", rollup.error.message);

  const lastEventAt =
    ((latest.data ?? []) as { occurred_at: string }[])[0]?.occurred_at ?? null;
  const rollupRow = ((rollup.data ?? []) as Record<string, unknown>[])[0];
  const lastRollup = rollupRow
    ? {
        statDate: String(rollupRow.stat_date),
        ok: rollupRow.ok === true,
        error: rollupRow.error ? String(rollupRow.error) : null,
        ranAt: String(rollupRow.ran_at),
      }
    : null;

  const status: TrackerHealth["status"] = !lastEventAt
    ? "never"
    : lastRollup && !lastRollup.ok
      ? "rollup_failed"
      : Date.now() - new Date(lastEventAt).getTime() > STALE_HOURS * 3_600_000
        ? "stale"
        : "ok";

  return {
    lastEventAt,
    events24h: recent.count ?? 0,
    eventsTotal: totalRes.count ?? 0,
    lastRollup,
    allowedOrigins,
    tokenRequired,
    status,
  };
});

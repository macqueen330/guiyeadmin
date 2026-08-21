import type { NextRequest } from "next/server";
import { getServiceDb } from "@/lib/data/db";

// ---------------------------------------------------------------------------
// 官网埋点采集端点（公开、只写不读）。
//
// 页面浏览由 Vercel Web Analytics 负责实时看板（<Analytics /> in app/layout.tsx）；
// 这个端点收的是**后台自己的一方数据**：它落到 web_events，再由
// gy_rollup_web_day() 汇总成 web_analytics_daily / 页面 / 来源 / 设备 / 地域 /
// 单品漏斗 —— 这样「官网数据」页可以和订单表关联，也能自定义口径。
//
// 官网侧调用示例：
//   navigator.sendBeacon("https://<后台域名>/api/analytics/collect", JSON.stringify({
//     visitor_id, session_id,
//     events: [{ event_key: "page_view", page_path: "/products", page_title: "产品" }]
//   }))
//
// 防滥用：
//   * 可选共享密钥 ANALYTICS_INGEST_TOKEN（配置后必须带 x-guiye-token）
//   * 单次最多 50 条，字段长度截断
//   * event_key 必须在 web_event_types 字典里（未知事件直接丢弃并计数）
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

const MAX_EVENTS = 50;
const MAX_LEN = 512;

function corsHeaders(): Record<string, string> {
  const origin = process.env.ANALYTICS_ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-guiye-token",
    "Access-Control-Max-Age": "86400",
  };
}

function clip(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, MAX_LEN);
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface IncomingEvent {
  event_key?: unknown;
  occurred_at?: unknown;
  page_path?: unknown;
  page_title?: unknown;
  product_id?: unknown;
  referrer?: unknown;
  source?: unknown;
  device?: unknown;
  country?: unknown;
  province?: unknown;
  city?: unknown;
  value?: unknown;
  props?: unknown;
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest): Promise<Response> {
  const json = (h: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(h), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });

  const required = process.env.ANALYTICS_INGEST_TOKEN;
  if (required && req.headers.get("x-guiye-token") !== required) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const sb = getServiceDb();
  if (!sb) return json({ ok: false, error: "database not configured" }, 503);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid json" }, 400);
  }

  const incoming = Array.isArray(body.events) ? (body.events as IncomingEvent[]) : [];
  if (incoming.length === 0) return json({ ok: true, accepted: 0, rejected: 0 });

  const { data: typeRows } = await sb.from("web_event_types").select("event_key").eq("is_active", true);
  const allowed = new Set(((typeRows ?? []) as { event_key: string }[]).map((t) => t.event_key));

  const visitorId = clip(body.visitor_id);
  const sessionId = clip(body.session_id);
  const ua = req.headers.get("user-agent") ?? "";
  const fallbackDevice = /Mobile|Android|iPhone/.test(ua)
    ? "mobile"
    : /iPad|Tablet/.test(ua)
      ? "tablet"
      : "desktop";

  const rows: Record<string, unknown>[] = [];
  let rejected = 0;

  for (const e of incoming.slice(0, MAX_EVENTS)) {
    const key = clip(e.event_key);
    if (!key || (allowed.size > 0 && !allowed.has(key))) {
      rejected += 1;
      continue;
    }
    const at = e.occurred_at ? new Date(String(e.occurred_at)) : new Date();
    rows.push({
      event_key: key,
      occurred_at: Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString(),
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: clip(e.page_path),
      page_title: clip(e.page_title),
      product_id: clip(e.product_id),
      referrer: clip(e.referrer),
      source: clip(e.source),
      device: clip(e.device) ?? fallbackDevice,
      country: clip(e.country),
      province: clip(e.province),
      city: clip(e.city),
      value: numOrNull(e.value),
      props: e.props && typeof e.props === "object" ? e.props : {},
    });
  }

  if (rows.length === 0) return json({ ok: true, accepted: 0, rejected });

  const { error } = await sb.from("web_events").insert(rows);
  if (error) return json({ ok: false, error: error.message }, 500);

  // 汇总当天（幂等，重复调用只是重算）。失败不影响采集本身。
  const today = new Date().toISOString().slice(0, 10);
  await sb.rpc("gy_rollup_web_day", { p_date: today }).then(
    () => undefined,
    () => undefined,
  );

  return json({ ok: true, accepted: rows.length, rejected });
}

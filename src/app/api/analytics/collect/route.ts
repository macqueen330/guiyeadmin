import type { NextRequest } from "next/server";
import { getServiceDb } from "@/lib/data/db";
import { loadSettingsUnauthenticated } from "@/lib/data/settings";
import { businessDateKey } from "@/lib/data/metrics";

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

/**
 * 跨域白名单。ANALYTICS_ALLOWED_ORIGIN 支持逗号分隔多个域名，
 * 命中后**原样回显**请求的 Origin —— 浏览器只认单个值，回显是唯一能同时
 * 支持 guiyecy.com 和 www.guiyecy.com 的做法。
 *
 * 以前这里直接把配置值当成响应头返回：配了 https://guiyecy.com，
 * www 子域的上报就会被浏览器全部拦下，而后台只会显示「零流量」，
 * 不会告诉你是跨域被拒。留空则放行所有来源（公网可写，靠 token 兜底）。
 */
function allowedOrigins(): string[] {
  return (process.env.ANALYTICS_ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const list = allowedOrigins();
  const origin = req.headers.get("origin");
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-guiye-token",
    "Access-Control-Max-Age": "86400",
    // 响应随 Origin 变化，不加这个头会被 CDN / 浏览器缓存串味。
    Vary: "Origin",
  };
  if (list.length === 0) return { ...base, "Access-Control-Allow-Origin": "*" };
  if (origin && list.includes(origin.replace(/\/$/, ""))) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }
  return base; // 不在白名单：不给 CORS 头，浏览器自己会拦
}

/**
 * 访问地域。埋点脚本**不采集**地域（浏览器拿不到，也不该为此要定位权限），
 * 所以只能由服务端从托管商注入的请求头推导。
 *
 * Next 15 起 NextRequest.geo / .ip 已被移除，这些值由托管商提供
 * （见 next/dist/docs/01-app/02-guides/upgrading/version-15.md）。
 * 这里同时认 Vercel 和 Cloudflare 的头；都没有就留空 ——
 * 「访问地区」面板会显示空态，而不是编一个地名出来。
 *
 * 客户端 payload 里的 country/province/city 仍然优先（自建官网可能自己带），
 * 但它是不可信输入，只作为兜底之上的补充。
 */
function geoFromHeaders(req: NextRequest): {
  country: string | null;
  province: string | null;
  city: string | null;
} {
  const h = req.headers;
  const dec = (v: string | null) => {
    if (!v) return null;
    let out = v;
    try {
      // Vercel 对非 ASCII 的城市名做 URI 编码（"Sh%C3%A0ngh%C7%8Ei" → "Shànghǎi"）
      out = decodeURIComponent(v);
    } catch {
      /* 不是合法的百分号编码，按原样处理 */
    }
    // HTTP 头在 Node 里按 latin-1 解，直接透传原始 UTF-8 字节的反向代理会让
    // 城市名变成乱码。能按 UTF-8 重解就重解，否则保持原样 ——
    // 宁可留空/留原文，也不要往库里写一串乱码当地名。
    if (/[\u0080-\u00ff]/.test(out) && !/[\u0100-\uffff]/.test(out)) {
      try {
        const repaired = new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(out, (ch) => ch.charCodeAt(0)),
        );
        out = repaired;
      } catch {
        /* 本来就是合法的 latin-1 文本，别动 */
      }
    }
    return out.trim() || null;
  };
  return {
    country: dec(h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry")),
    province: dec(h.get("x-vercel-ip-country-region")),
    city: dec(h.get("x-vercel-ip-city") ?? h.get("cf-ipcity")),
  };
}

/**
 * 事件时间钳制。occurred_at 由**客户端**生成，一台时钟走偏的浏览器
 * （或者随手一个 curl）就能把事件写进 2099 年 —— 那条记录既进不了当天汇总，
 * 又会永远出现在「近 N 天」的事件明细里。
 * 允许小幅超前（时钟误差）和几天的补报（sendBeacon 延迟送达），其余一律按服务端时间。
 */
const MAX_BACKDATE_MS = 7 * 86_400_000;
const MAX_SKEW_AHEAD_MS = 5 * 60_000;

function clampOccurredAt(raw: unknown): string {
  const now = Date.now();
  if (!raw) return new Date(now).toISOString();
  const t = new Date(String(raw)).getTime();
  if (Number.isNaN(t)) return new Date(now).toISOString();
  if (t > now + MAX_SKEW_AHEAD_MS) return new Date(now).toISOString();
  if (t < now - MAX_BACKDATE_MS) return new Date(now).toISOString();
  return new Date(t).toISOString();
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

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest): Promise<Response> {
  const json = (h: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(h), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
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

  const geo = geoFromHeaders(req);

  const rows: Record<string, unknown>[] = [];
  let rejected = 0;

  for (const e of incoming.slice(0, MAX_EVENTS)) {
    const key = clip(e.event_key);
    if (!key || (allowed.size > 0 && !allowed.has(key))) {
      rejected += 1;
      continue;
    }
    rows.push({
      event_key: key,
      occurred_at: clampOccurredAt(e.occurred_at),
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: clip(e.page_path),
      page_title: clip(e.page_title),
      product_id: clip(e.product_id),
      referrer: clip(e.referrer),
      source: clip(e.source),
      device: clip(e.device) ?? fallbackDevice,
      country: clip(e.country) ?? geo.country,
      province: clip(e.province) ?? geo.province,
      city: clip(e.city) ?? geo.city,
      value: numOrNull(e.value),
      props: e.props && typeof e.props === "object" ? e.props : {},
    });
  }

  if (rows.length === 0) return json({ ok: true, accepted: 0, rejected });

  const { error } = await sb.from("web_events").insert(rows);
  if (error) return json({ ok: false, error: error.message }, 500);

  // 汇总受影响的**业务日**（幂等，重复调用只是重算）。
  //
  // 以前这里用 new Date().toISOString().slice(0,10) —— UTC 日期，
  // 而前台按 analytics.tz_offset_hours（默认 UTC+8）读，两边差 8 小时。
  // 现在日切统一由 SQL 侧的 gy_day_bounds() 决定，这里只需要按同一时区
  // 算出「这批事件属于哪几个业务日」。
  //
  // 失败不阻塞采集（事件已经落库了），但会写进 web_rollup_runs，
  // 后台「官网数据」页顶部的链路状态能看到 —— 以前是彻底吞掉，
  // 汇总挂了数据静默停更，没人知道。
  const tz = (await loadSettingsUnauthenticated()).analytics.tzOffsetHours;
  const days = new Set(
    rows.map((r) => businessDateKey(String(r.occurred_at), tz)),
  );
  for (const day of days) {
    await sb.rpc("gy_rollup_web_day", { p_date: day }).then(
      () => undefined,
      (e: unknown) => console.error(`[analytics] ${day} 汇总失败：`, e),
    );
  }

  return json({ ok: true, accepted: rows.length, rejected });
}

import "server-only";

import crypto from "node:crypto";
import {
  LogisticsNotConfiguredError,
  normalizeStatus,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type LogisticsProvider,
  type LogisticsWebhookParseResult,
  type LogisticsWebhookRequest,
  type TrackingEvent,
  type TrackingResult,
} from "./types";
import type { Carrier } from "@/lib/types";

// ---------------------------------------------------------------------------
// 通用 REST 承运商适配器。
//
// 大部分快递公司 / 聚合平台（快递100、快递鸟、DHL、FedEx…）都是「一个 JSON 接口 +
// 一个 Bearer/签名头」。与其为每家写一个文件，不如把差异放进 carriers.api_config，
// 接一家新的只要在后台填一段配置，不用发版。
//
// carriers.api_config 结构（全部可选，缺哪个就代表哪个能力没接）：
// {
//   "auth":   { "header": "Authorization", "scheme": "Bearer" },
//   "track":  { "path": "/v1/track?no={tracking_no}", "method": "GET",
//               "eventsPath": "data.traces", "statusPath": "data.state",
//               "eventTime": "time", "eventStatus": "status",
//               "eventDesc": "context", "eventLocation": "location" },
//   "create": { "path": "/v1/orders", "method": "POST",
//               "trackingNoPath": "data.waybillNo", "labelPath": "data.labelUrl",
//               "freightPath": "data.freight" },
//   "cancel": { "path": "/v1/orders/{tracking_no}/cancel", "method": "POST" },
//   "webhook":{ "signatureHeader": "x-signature", "algorithm": "hmac-sha256",
//               "trackingNoPath": "trackingNo", "eventsPath": "traces" }
// }
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function pick(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Json)[key];
    return undefined;
  }, obj);
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function cfg(carrier: Carrier): Json {
  return (carrier.api_config ?? {}) as Json;
}

function section(carrier: Carrier, key: string): Json | null {
  const s = cfg(carrier)[key];
  return s && typeof s === "object" ? (s as Json) : null;
}

async function call(
  carrier: Carrier,
  apiKey: string,
  spec: Json,
  vars: Record<string, string>,
  body?: unknown,
): Promise<Json> {
  if (!carrier.api_base_url) {
    throw new LogisticsNotConfiguredError(carrier.name, "缺少 API 地址（api_base_url）");
  }
  const auth = section(carrier, "auth") ?? {};
  const header = String(auth.header ?? "Authorization");
  const scheme = auth.scheme ? `${auth.scheme} ` : "";
  const method = String(spec.method ?? "GET").toUpperCase();
  const url = carrier.api_base_url.replace(/\/$/, "") + fill(String(spec.path ?? "/"), vars);

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      [header]: `${scheme}${apiKey}`,
    },
    ...(method === "GET" || method === "HEAD" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  const text = await res.text();
  let json: Json;
  try {
    json = JSON.parse(text) as Json;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new LogisticsNotConfiguredError(carrier.name, `接口返回 ${res.status}：${text.slice(0, 200)}`);
  }
  return json;
}

function parseEvents(spec: Json, payload: unknown): TrackingEvent[] {
  const raw = pick(payload, String(spec.eventsPath ?? "")) ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => {
      const row = e as Json;
      const occurred = String(row[String(spec.eventTime ?? "time")] ?? "");
      const status =
        normalizeStatus(String(row[String(spec.eventStatus ?? "status")] ?? "")) ?? "in_transit";
      return {
        occurredAt: occurred ? new Date(occurred).toISOString() : new Date().toISOString(),
        status,
        location: row[String(spec.eventLocation ?? "location")] as string | undefined,
        description: row[String(spec.eventDesc ?? "description")] as string | undefined,
        raw: row,
      } satisfies TrackingEvent;
    })
    .filter((e) => !Number.isNaN(new Date(e.occurredAt).getTime()));
}

export const httpCarrierProvider: LogisticsProvider = {
  key: "http",
  name: "通用 REST 承运商",

  missingRequirements(carrier, creds) {
    const missing: string[] = [];
    if (!carrier.api_base_url) missing.push("API 地址");
    if (!carrier.api_credential_env) missing.push("凭据环境变量名");
    else if (!creds.apiKey) missing.push(`环境变量 ${carrier.api_credential_env} 未配置`);
    if (!section(carrier, "track")) missing.push("轨迹查询配置（api_config.track）");
    return missing;
  },

  isReady(carrier, creds) {
    return carrier.is_active && this.missingRequirements(carrier, creds).length === 0;
  },

  async createShipment(
    input: CreateShipmentInput,
    carrier,
    creds,
  ): Promise<CreateShipmentResult> {
    const spec = section(carrier, "create");
    if (!spec) throw new LogisticsNotConfiguredError(carrier.name, "未配置下单接口（api_config.create）");
    if (!creds.apiKey) throw new LogisticsNotConfiguredError(carrier.name, "缺少 API 凭据");

    const json = await call(carrier, creds.apiKey, spec, { order_no: input.orderNo }, {
      order_no: input.orderNo,
      service_level: input.serviceLevel,
      weight_g: input.weightG,
      declared_value: input.declaredValue,
      currency: input.currency,
      remark: input.remark,
      sender: input.from,
      receiver: input.to,
      items: input.items,
    });

    const trackingNo = pick(json, String(spec.trackingNoPath ?? "tracking_no"));
    if (!trackingNo) {
      throw new LogisticsNotConfiguredError(carrier.name, "下单成功但未返回运单号，请检查 trackingNoPath 配置");
    }
    return {
      trackingNo: String(trackingNo),
      externalNo: pick(json, String(spec.externalNoPath ?? "")) as string | undefined,
      labelUrl: pick(json, String(spec.labelPath ?? "")) as string | undefined,
      freightCost: Number(pick(json, String(spec.freightPath ?? "")) ?? 0) || undefined,
      raw: json,
    };
  },

  async queryTracking(trackingNo, carrier, creds): Promise<TrackingResult> {
    const spec = section(carrier, "track");
    if (!spec) throw new LogisticsNotConfiguredError(carrier.name, "未配置轨迹接口（api_config.track）");
    if (!creds.apiKey) throw new LogisticsNotConfiguredError(carrier.name, "缺少 API 凭据");

    const json = await call(carrier, creds.apiKey, spec, { tracking_no: trackingNo });
    const events = parseEvents(spec, json).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const status =
      normalizeStatus(String(pick(json, String(spec.statusPath ?? "")) ?? "")) ??
      events[0]?.status ??
      "in_transit";
    return {
      status,
      deliveredAt: status === "delivered" ? (events[0]?.occurredAt ?? null) : null,
      events,
      raw: json,
    };
  },

  async cancelShipment(trackingNo, carrier, creds) {
    const spec = section(carrier, "cancel");
    if (!spec) return { ok: false, message: `${carrier.name} 未配置取消接口` };
    if (!creds.apiKey) return { ok: false, message: "缺少 API 凭据" };
    try {
      await call(carrier, creds.apiKey, spec, { tracking_no: trackingNo });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  async parseWebhook(
    req: LogisticsWebhookRequest,
    carrier,
    creds,
  ): Promise<LogisticsWebhookParseResult> {
    const spec = section(carrier, "webhook") ?? {};
    let payload: unknown;
    try {
      payload = JSON.parse(req.rawBody);
    } catch {
      payload = req.rawBody;
    }

    const trackingNo =
      (pick(payload, String(spec.trackingNoPath ?? "tracking_no")) as string) ??
      req.query.tracking_no ??
      null;

    if (!creds.webhookSecret) {
      return {
        signatureOk: false,
        externalId: (pick(payload, String(spec.idPath ?? "id")) as string) ?? null,
        trackingNo,
        status: null,
        events: [],
        error: `${carrier.name} 未配置 Webhook 密钥（webhook_secret_env），通知已留存但不会自动更新轨迹`,
        raw: payload,
      };
    }

    const headerName = String(spec.signatureHeader ?? "x-signature").toLowerCase();
    const provided = req.headers[headerName] ?? "";
    const expected = crypto
      .createHmac("sha256", creds.webhookSecret)
      .update(req.rawBody, "utf8")
      .digest("hex");
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    const signatureOk = a.length === b.length && crypto.timingSafeEqual(a, b);

    return {
      signatureOk,
      externalId: (pick(payload, String(spec.idPath ?? "id")) as string) ?? null,
      trackingNo,
      status: normalizeStatus(String(pick(payload, String(spec.statusPath ?? "status")) ?? "")),
      events: signatureOk ? parseEvents(spec, payload) : [],
      error: signatureOk ? undefined : "Webhook 验签失败",
      raw: payload,
    };
  },

  ack(ok, message) {
    return new Response(JSON.stringify({ ok, message }), {
      status: ok ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  },
};

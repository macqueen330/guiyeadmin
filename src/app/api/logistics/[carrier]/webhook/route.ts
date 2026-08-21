import type { NextRequest } from "next/server";
import { getServiceDb } from "@/lib/data/db";
import {
  getCarrierByCodeForWebhook,
  persistTrackingEvents,
  providerForCarrier,
  resolveCarrierCredentials,
} from "@/lib/logistics/registry";

// 承运商轨迹回调入口：/api/logistics/{carrier_code}/webhook
//
// 接入一家物流公司时把这个地址填进对方后台即可，路由本身与承运商无关：
//   落库（幂等）→ 验签 → 写 shipment_events + 同步运单状态 → 应答。
//
// 未接入 API 的承运商（carriers.api_provider 为空）也会落库，
// 但不会自动更新轨迹 —— 界面如实显示「未接入」，不会出现假的物流时间轴。

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ carrier: string }> },
): Promise<Response> {
  const { carrier: code } = await ctx.params;
  const carrier = await getCarrierByCodeForWebhook(code);
  if (!carrier) {
    return new Response(JSON.stringify({ ok: false, message: "未知承运商" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const provider = providerForCarrier(carrier);
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (k === "authorization" || k === "cookie") return;
    headers[k] = v;
  });
  const query: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  const parsed = await provider.parseWebhook(
    { headers, rawBody, query },
    carrier,
    resolveCarrierCredentials(carrier),
  );

  const sb = getServiceDb();
  if (!sb) return provider.ack(false, "数据库未配置");

  const externalId =
    parsed.externalId ?? `${code}:${parsed.trackingNo ?? "unknown"}:${Date.now()}`;

  const { data: existing } = await sb
    .from("logistics_webhook_events")
    .select("id,processed")
    .eq("carrier_code", code)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing?.processed) return provider.ack(true);

  const eventId =
    existing?.id ??
    (
      await sb
        .from("logistics_webhook_events")
        .insert({
          carrier_code: code,
          external_id: externalId,
          tracking_no: parsed.trackingNo,
          signature_ok: parsed.signatureOk,
          payload: parsed.raw ?? {},
          processed: false,
          error: parsed.error ?? null,
        })
        .select("id")
        .single()
    ).data?.id;

  if (!eventId) return provider.ack(false, "无法记录通知");

  if (!parsed.signatureOk) {
    await sb
      .from("logistics_webhook_events")
      .update({ processed: false, error: parsed.error ?? "验签未通过" })
      .eq("id", eventId);
    return provider.ack(false, parsed.error ?? "验签未通过");
  }

  if (!parsed.trackingNo) {
    await sb
      .from("logistics_webhook_events")
      .update({ processed: false, error: "通知中缺少运单号" })
      .eq("id", eventId);
    return provider.ack(false, "缺少运单号");
  }

  const { data: shipment } = await sb
    .from("shipments")
    .select("id")
    .eq("tracking_no", parsed.trackingNo)
    .maybeSingle();

  if (!shipment) {
    await sb
      .from("logistics_webhook_events")
      .update({ processed: false, error: `未找到运单 ${parsed.trackingNo}` })
      .eq("id", eventId);
    return provider.ack(false, "未找到对应运单");
  }

  const added = await persistTrackingEvents(
    String(shipment.id),
    parsed.events,
    parsed.status,
    "webhook",
  );

  await sb
    .from("logistics_webhook_events")
    .update({ processed: true, processed_at: new Date().toISOString(), error: null })
    .eq("id", eventId);

  return provider.ack(true, `已写入 ${added} 条轨迹`);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ carrier: string }> },
): Promise<Response> {
  const { carrier } = await ctx.params;
  return new Response(JSON.stringify({ ok: true, carrier }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

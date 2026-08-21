import "server-only";

import { getDb, getServiceDb } from "@/lib/data/db";
import type { Carrier, ShipmentStatus } from "@/lib/types";
import { httpCarrierProvider } from "./httpCarrier";
import { manualLogisticsProvider } from "./manual";
import type { LogisticsCredentials, LogisticsProvider, TrackingEvent } from "./types";

// api_provider 取值 → 适配器。新接一家自建协议的物流公司时在这里注册。
// 绝大多数 REST 接口用 "http" 就够了，差异写在 carriers.api_config。
const PROVIDERS: Record<string, LogisticsProvider> = {
  http: httpCarrierProvider,
  manual: manualLogisticsProvider,
};

export function providerForCarrier(carrier: Carrier): LogisticsProvider {
  if (!carrier.api_provider) return manualLogisticsProvider;
  return PROVIDERS[carrier.api_provider] ?? httpCarrierProvider;
}

export function resolveCarrierCredentials(carrier: Carrier): LogisticsCredentials {
  return {
    apiKey: carrier.api_credential_env ? process.env[carrier.api_credential_env] : undefined,
    webhookSecret: carrier.webhook_secret_env ? process.env[carrier.webhook_secret_env] : undefined,
  };
}

export async function getCarrierByCode(code: string): Promise<Carrier | null> {
  const sb = await getDb();
  if (!sb) return null;
  const { data } = await sb.from("carriers").select("*").eq("code", code).maybeSingle();
  return (data as Carrier) ?? null;
}

export async function getCarrierByCodeForWebhook(code: string): Promise<Carrier | null> {
  const sb = getServiceDb();
  if (!sb) return null;
  const { data } = await sb.from("carriers").select("*").eq("code", code).maybeSingle();
  return (data as Carrier) ?? null;
}

export interface CarrierReadiness {
  code: string;
  name: string;
  apiConnected: boolean;
  missing: string[];
  trackingUrl: (trackingNo: string) => string | null;
}

export function carrierReadiness(carrier: Carrier): CarrierReadiness {
  const provider = providerForCarrier(carrier);
  const creds = resolveCarrierCredentials(carrier);
  return {
    code: carrier.code,
    name: carrier.name,
    apiConnected: provider.isReady(carrier, creds),
    missing: provider.missingRequirements(carrier, creds),
    trackingUrl: (no: string) =>
      carrier.tracking_url_template
        ? carrier.tracking_url_template.replace("{tracking_no}", encodeURIComponent(no))
        : null,
  };
}

/** 承运商官网查询链接（未接入 API 时至少给一个可点的入口）。 */
export function trackingUrlFor(carrier: Pick<Carrier, "tracking_url_template">, trackingNo: string): string | null {
  if (!carrier.tracking_url_template || !trackingNo) return null;
  return carrier.tracking_url_template.replace("{tracking_no}", encodeURIComponent(trackingNo));
}

/**
 * 把一批轨迹写入 shipment_events 并同步运单状态。去重键 = (shipment, 时间, 描述)。
 * Webhook 与「手动同步轨迹」共用这一条路径。
 */
export async function persistTrackingEvents(
  shipmentId: string,
  events: TrackingEvent[],
  status: ShipmentStatus | null,
  source: "carrier_api" | "webhook",
): Promise<number> {
  const sb = getServiceDb();
  if (!sb || events.length === 0) return 0;

  const { data: existing } = await sb
    .from("shipment_events")
    .select("occurred_at,description")
    .eq("shipment_id", shipmentId);
  const seen = new Set(
    ((existing ?? []) as { occurred_at: string; description: string | null }[]).map(
      (e) => `${new Date(e.occurred_at).toISOString()}|${e.description ?? ""}`,
    ),
  );

  const fresh = events.filter(
    (e) => !seen.has(`${new Date(e.occurredAt).toISOString()}|${e.description ?? ""}`),
  );
  if (fresh.length > 0) {
    await sb.from("shipment_events").insert(
      fresh.map((e) => ({
        shipment_id: shipmentId,
        occurred_at: e.occurredAt,
        status: e.status,
        location: e.location ?? null,
        description: e.description ?? null,
        source,
        raw: e.raw ?? null,
      })),
    );
  }

  const latest = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const nextStatus = status ?? latest?.status ?? null;
  if (nextStatus) {
    await sb
      .from("shipments")
      .update({
        status: nextStatus,
        last_synced_at: new Date().toISOString(),
        ...(nextStatus === "delivered" ? { delivered_at: latest?.occurredAt ?? new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipmentId);
  }
  return fresh.length;
}

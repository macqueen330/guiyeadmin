import type { Carrier, ShipmentStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// 物流承运商适配层 —— 为将来对接物流公司 API 预留。
//
// 现状：carriers.api_provider 为空的承运商走 "manual"（人工录单号 + 人工更新轨迹），
// 这是今天真实的工作方式，不会假装已经接入。
//
// 接入一家物流公司时只需要：
//   1. 在 carriers 里填 api_provider / api_base_url / api_credential_env；
//   2. 在本目录新增一个实现 LogisticsProvider 的文件并注册到 registry.ts。
// 上层（发货、轨迹展示、Webhook 落库、异常告警）无需改动。
// ---------------------------------------------------------------------------

export class LogisticsNotConfiguredError extends Error {
  constructor(carrier: string, detail: string) {
    super(`承运商「${carrier}」尚未接入 API：${detail}`);
    this.name = "LogisticsNotConfiguredError";
  }
}

export interface ShipAddress {
  name: string;
  phone: string;
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  address: string;
  postcode?: string;
}

export interface CreateShipmentInput {
  orderNo: string;
  from: ShipAddress;
  to: ShipAddress;
  items: { name: string; qty: number; weightG?: number }[];
  serviceLevel?: string;
  weightG?: number;
  remark?: string;
  /** 声明价值（跨境报关用） */
  declaredValue?: number;
  currency?: string;
}

export interface CreateShipmentResult {
  trackingNo: string;
  externalNo?: string;
  /** 面单 PDF / 图片地址，若承运商返回 */
  labelUrl?: string;
  estimatedAt?: string;
  freightCost?: number;
  raw?: unknown;
}

export interface TrackingEvent {
  occurredAt: string;
  status: ShipmentStatus;
  location?: string;
  description?: string;
  raw?: unknown;
}

export interface TrackingResult {
  status: ShipmentStatus;
  deliveredAt?: string | null;
  events: TrackingEvent[];
  raw?: unknown;
}

export interface LogisticsWebhookRequest {
  headers: Record<string, string>;
  rawBody: string;
  query: Record<string, string>;
}

export interface LogisticsWebhookParseResult {
  signatureOk: boolean;
  externalId: string | null;
  trackingNo: string | null;
  status: ShipmentStatus | null;
  events: TrackingEvent[];
  error?: string;
  raw: unknown;
}

export interface LogisticsCredentials {
  apiKey?: string;
  webhookSecret?: string;
}

export interface LogisticsProvider {
  key: string;
  name: string;

  isReady(carrier: Carrier, creds: LogisticsCredentials): boolean;
  missingRequirements(carrier: Carrier, creds: LogisticsCredentials): string[];

  createShipment(
    input: CreateShipmentInput,
    carrier: Carrier,
    creds: LogisticsCredentials,
  ): Promise<CreateShipmentResult>;

  queryTracking(
    trackingNo: string,
    carrier: Carrier,
    creds: LogisticsCredentials,
  ): Promise<TrackingResult>;

  cancelShipment(
    trackingNo: string,
    carrier: Carrier,
    creds: LogisticsCredentials,
  ): Promise<{ ok: boolean; message?: string }>;

  parseWebhook(
    req: LogisticsWebhookRequest,
    carrier: Carrier,
    creds: LogisticsCredentials,
  ): Promise<LogisticsWebhookParseResult>;

  ack(ok: boolean, message?: string): Response;
}

/** 把承运商各自的状态码映射到我们的 5 档状态。 */
export function normalizeStatus(raw: string | null | undefined): ShipmentStatus | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (/deliver|signed|签收|已送达/.test(s)) return "delivered";
  if (/custom|清关|报关/.test(s)) return "customs";
  if (/transit|transport|运输|派送|在途/.test(s)) return "in_transit";
  if (/prepar|pickup|揽收|待揽|备货/.test(s)) return "preparing";
  if (/exception|fail|退回|异常|滞留/.test(s)) return "exception";
  return null;
}

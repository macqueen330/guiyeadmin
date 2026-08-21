import "server-only";

import {
  LogisticsNotConfiguredError,
  normalizeStatus,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type LogisticsProvider,
  type LogisticsWebhookParseResult,
  type LogisticsWebhookRequest,
  type TrackingResult,
} from "./types";

// 尚未接入 API 的承运商（carriers.api_provider 为空）。
// 运单号由仓库人工填写，轨迹由人工补录 —— 界面如实显示「未接入 API」，
// 而不是画一条假的物流时间轴。
export const manualLogisticsProvider: LogisticsProvider = {
  key: "manual",
  name: "人工录单",

  missingRequirements(carrier) {
    return carrier.api_provider ? [] : ["该承运商尚未接入 API，运单号与轨迹需人工维护"];
  },

  isReady() {
    return false;
  },

  async createShipment(input: CreateShipmentInput, carrier): Promise<CreateShipmentResult> {
    throw new LogisticsNotConfiguredError(
      carrier.name,
      `请在承运商系统下单后，把运单号回填到订单 ${input.orderNo}`,
    );
  },

  async queryTracking(trackingNo, carrier): Promise<TrackingResult> {
    throw new LogisticsNotConfiguredError(
      carrier.name,
      `无法自动查询 ${trackingNo}${carrier.tracking_url_template ? "，请使用官网查询链接" : ""}`,
    );
  },

  async cancelShipment(_trackingNo, carrier) {
    return { ok: false, message: `${carrier.name} 未接入 API，请在承运商系统中取消` };
  },

  async parseWebhook(req: LogisticsWebhookRequest): Promise<LogisticsWebhookParseResult> {
    // 即使没有接入，也把回调留存下来：接入后可以回放。
    let payload: unknown = req.rawBody;
    try {
      payload = JSON.parse(req.rawBody);
    } catch {
      /* 保留原文 */
    }
    const obj = (typeof payload === "object" && payload ? payload : {}) as Record<string, unknown>;
    return {
      signatureOk: false,
      externalId: (obj.id as string) ?? null,
      trackingNo: (obj.tracking_no as string) ?? (obj.trackingNo as string) ?? null,
      status: normalizeStatus(obj.status as string),
      events: [],
      error: "该承运商未配置 Webhook 密钥，通知已留存但不会自动更新轨迹",
      raw: payload,
    };
  },

  ack(ok, message) {
    return new Response(JSON.stringify({ ok, message }), {
      status: ok ? 200 : 202,
      headers: { "Content-Type": "application/json" },
    });
  },
};

import "server-only";

import crypto from "node:crypto";
import type { PaymentGateway } from "@/lib/types";
import {
  PaymentNotConfiguredError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type QueryPaymentInput,
  type QueryPaymentResult,
  type RefundInput,
  type RefundResult,
  type WebhookParseResult,
  type WebhookRequest,
} from "./types";

// ---------------------------------------------------------------------------
// 微信支付 V3
//
// 已实现：异步通知的验签（SHA256withRSA，用微信支付平台证书公钥）与
//         resource 的 AES-256-GCM 解密（用 APIv3 密钥）。这两步是资金安全的关键，
//         没有它们回调就只是一段任何人都能伪造的 JSON。
//
// 待接入方在 Vercel 配置：
//   WECHAT_PAY_API_V3_KEY        APIv3 密钥（32 位），payment_gateways.credential_env
//   WECHAT_PAY_PLATFORM_CERT     微信支付平台证书（PEM），用于验签
//   WECHAT_PAY_PRIVATE_KEY       商户 API 私钥（PEM），用于调用下单 / 退款接口
//   WECHAT_PAY_SERIAL_NO         商户证书序列号
//
// createPayment / refund 需要真实商户资质才能联调，因此保留为「配置齐全才可用」，
// 缺配置时抛 PaymentNotConfiguredError 并在界面上说明缺什么 —— 而不是假装成功。
// ---------------------------------------------------------------------------

const API_BASE = "https://api.mch.weixin.qq.com";

function yuanToFen(amount: number): number {
  return Math.round(amount * 100);
}

function fenToYuan(fen: number): number {
  return Math.round(fen) / 100;
}

/** 微信支付 V3 请求签名串。 */
function buildSignature(
  method: string,
  urlPath: string,
  timestamp: string,
  nonce: string,
  body: string,
  privateKeyPem: string,
): string {
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  return crypto.sign("RSA-SHA256", Buffer.from(message), privateKeyPem).toString("base64");
}

function authHeader(
  gateway: PaymentGateway,
  method: string,
  urlPath: string,
  body: string,
): string {
  const privateKey = process.env.WECHAT_PAY_PRIVATE_KEY;
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
  if (!privateKey || !serialNo || !gateway.merchant_no) {
    throw new PaymentNotConfiguredError(
      "微信支付",
      "缺少 WECHAT_PAY_PRIVATE_KEY / WECHAT_PAY_SERIAL_NO 或商户号",
    );
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const signature = buildSignature(method, urlPath, timestamp, nonce, body, privateKey);
  return (
    `WECHATPAY2-SHA256-RSA2048 mchid="${gateway.merchant_no}",` +
    `nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`
  );
}

/** APIv3 回调体的 AES-256-GCM 解密。 */
function decryptResource(
  apiV3Key: string,
  resource: { ciphertext: string; nonce: string; associated_data?: string },
): unknown {
  const buf = Buffer.from(resource.ciphertext, "base64");
  const authTag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(apiV3Key, "utf8"),
    Buffer.from(resource.nonce, "utf8"),
  );
  decipher.setAuthTag(authTag);
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(plain);
}

const TRADE_STATE: Record<string, WebhookParseResult["payStatus"]> = {
  SUCCESS: "paid",
  REFUND: "refunded",
  NOTPAY: "unpaid",
  CLOSED: "failed",
  REVOKED: "failed",
  USERPAYING: "paying",
  PAYERROR: "pay_exception",
};

export const wechatPayProvider: PaymentProvider = {
  key: "wechat_pay",
  name: "微信支付",

  missingRequirements(gateway, creds) {
    const missing: string[] = [];
    if (!gateway.merchant_no) missing.push("商户号");
    if (!gateway.app_id) missing.push("AppID");
    if (!gateway.notify_url) missing.push("回调地址");
    if (!creds.secret) missing.push(`APIv3 密钥（环境变量 ${gateway.credential_env ?? "WECHAT_PAY_API_V3_KEY"}）`);
    if (!process.env.WECHAT_PAY_PRIVATE_KEY) missing.push("商户 API 私钥（WECHAT_PAY_PRIVATE_KEY）");
    if (!process.env.WECHAT_PAY_SERIAL_NO) missing.push("商户证书序列号（WECHAT_PAY_SERIAL_NO）");
    if (!process.env.WECHAT_PAY_PLATFORM_CERT) missing.push("平台证书（WECHAT_PAY_PLATFORM_CERT）");
    return missing;
  },

  isReady(gateway, creds) {
    return gateway.status === "enabled" && this.missingRequirements(gateway, creds).length === 0;
  },

  async createPayment(input: CreatePaymentInput, gateway, creds): Promise<CreatePaymentResult> {
    const missing = this.missingRequirements(gateway, creds);
    if (missing.length) throw new PaymentNotConfiguredError("微信支付", missing.join("、"));

    const scenario = (input.scenario ?? "Native").toLowerCase();
    const urlPath =
      scenario === "jsapi"
        ? "/v3/pay/transactions/jsapi"
        : scenario === "h5"
          ? "/v3/pay/transactions/h5"
          : "/v3/pay/transactions/native";

    const txnNo = `WX${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const body = JSON.stringify({
      appid: gateway.app_id,
      mchid: gateway.merchant_no,
      description: input.subject,
      out_trade_no: txnNo,
      notify_url: input.notifyUrl,
      amount: { total: yuanToFen(input.amount), currency: input.currency || "CNY" },
      ...(scenario === "jsapi" && input.openid ? { payer: { openid: input.openid } } : {}),
      ...(scenario === "h5"
        ? { scene_info: { payer_client_ip: input.clientIp ?? "127.0.0.1", h5_info: { type: "Wap" } } }
        : {}),
    });

    const res = await fetch(API_BASE + urlPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader(gateway, "POST", urlPath, body),
      },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new PaymentNotConfiguredError("微信支付", String(json.message ?? res.status));
    }
    return {
      txnNo,
      providerRef: (json.prepay_id as string) ?? undefined,
      payload: json,
      raw: json,
    };
  },

  async queryPayment(input: QueryPaymentInput, gateway, creds): Promise<QueryPaymentResult> {
    const missing = this.missingRequirements(gateway, creds);
    if (missing.length) throw new PaymentNotConfiguredError("微信支付", missing.join("、"));
    const urlPath = `/v3/pay/transactions/out-trade-no/${input.txnNo}?mchid=${gateway.merchant_no}`;
    const res = await fetch(API_BASE + urlPath, {
      headers: {
        Accept: "application/json",
        Authorization: authHeader(gateway, "GET", urlPath, ""),
      },
    });
    const json = (await res.json()) as Record<string, unknown>;
    const amount = (json.amount ?? {}) as Record<string, number>;
    return {
      payStatus: TRADE_STATE[String(json.trade_state)] ?? "unpaid",
      amountPaid: fenToYuan(amount.payer_total ?? amount.total ?? 0),
      paidAt: (json.success_time as string) ?? null,
      providerRef: (json.transaction_id as string) ?? undefined,
      raw: json,
    };
  },

  async refund(input: RefundInput, gateway, creds): Promise<RefundResult> {
    const missing = this.missingRequirements(gateway, creds);
    if (missing.length) throw new PaymentNotConfiguredError("微信支付", missing.join("、"));
    const urlPath = "/v3/refund/domestic/refunds";
    const body = JSON.stringify({
      out_trade_no: input.originTxnNo,
      out_refund_no: input.refundNo,
      reason: input.reason,
      notify_url: input.notifyUrl,
      amount: {
        refund: yuanToFen(input.amount),
        total: yuanToFen(input.totalAmount),
        currency: input.currency || "CNY",
      },
    });
    const res = await fetch(API_BASE + urlPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader(gateway, "POST", urlPath, body),
      },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) return { status: "failed", message: String(json.message ?? res.status), raw: json };
    return {
      providerRef: (json.refund_id as string) ?? undefined,
      status: json.status === "SUCCESS" ? "success" : "processing",
      raw: json,
    };
  },

  async parseWebhook(req: WebhookRequest, gateway, creds): Promise<WebhookParseResult> {
    let envelope: Record<string, unknown>;
    try {
      envelope = JSON.parse(req.rawBody) as Record<string, unknown>;
    } catch {
      return blank(req.rawBody, "回调内容不是合法 JSON");
    }

    const externalId = (envelope.id as string) ?? null;
    const eventType = (envelope.event_type as string) ?? null;
    const platformCert = process.env.WECHAT_PAY_PLATFORM_CERT;
    const apiV3Key = creds.secret;

    if (!platformCert || !apiV3Key) {
      return {
        ...blank(envelope, "缺少平台证书或 APIv3 密钥，无法验签；通知已留存待人工核对"),
        externalId,
        eventType,
      };
    }

    // 1) 验签：timestamp\nnonce\nbody\n
    const ts = req.headers["wechatpay-timestamp"] ?? "";
    const nonce = req.headers["wechatpay-nonce"] ?? "";
    const signature = req.headers["wechatpay-signature"] ?? "";
    const message = `${ts}\n${nonce}\n${req.rawBody}\n`;
    let signatureOk = false;
    try {
      signatureOk = crypto.verify(
        "RSA-SHA256",
        Buffer.from(message),
        platformCert,
        Buffer.from(signature, "base64"),
      );
    } catch {
      signatureOk = false;
    }
    // 5 分钟重放窗口
    if (signatureOk && ts) {
      const skew = Math.abs(Date.now() / 1000 - Number(ts));
      if (!Number.isFinite(skew) || skew > 300) signatureOk = false;
    }
    if (!signatureOk) {
      return { ...blank(envelope, "验签失败或时间戳超出允许范围"), externalId, eventType };
    }

    // 2) 解密 resource
    let resource: Record<string, unknown>;
    try {
      resource = decryptResource(
        apiV3Key,
        envelope.resource as { ciphertext: string; nonce: string; associated_data?: string },
      ) as Record<string, unknown>;
    } catch (e) {
      return {
        ...blank(envelope, `resource 解密失败：${(e as Error).message}`),
        externalId,
        eventType,
        signatureOk: true,
      };
    }

    const amount = (resource.amount ?? {}) as Record<string, number>;
    const isRefund = String(eventType).startsWith("REFUND.");
    return {
      signatureOk: true,
      externalId,
      eventType,
      orderNo: null,
      txnNo: (resource.out_trade_no as string) ?? null,
      providerRef: (resource.transaction_id as string) ?? null,
      amountPaid: fenToYuan(amount.payer_total ?? amount.total ?? 0),
      payStatus: isRefund
        ? resource.refund_status === "SUCCESS"
          ? "refunded"
          : null
        : (TRADE_STATE[String(resource.trade_state)] ?? null),
      paidAt: (resource.success_time as string) ?? null,
      refundNo: (resource.out_refund_no as string) ?? null,
      refundAmount: isRefund ? fenToYuan(amount.refund ?? 0) : null,
      raw: resource,
    };
  },

  ack(ok, message) {
    return new Response(
      JSON.stringify(ok ? { code: "SUCCESS" } : { code: "FAIL", message: message ?? "处理失败" }),
      { status: ok ? 200 : 500, headers: { "Content-Type": "application/json" } },
    );
  },
};

function blank(raw: unknown, error: string): WebhookParseResult {
  return {
    signatureOk: false,
    externalId: null,
    eventType: null,
    orderNo: null,
    txnNo: null,
    amountPaid: null,
    payStatus: null,
    paidAt: null,
    error,
    raw,
  };
}

import "server-only";

import crypto from "node:crypto";
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
import type { PayStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// 支付宝（开放平台网关 v1，RSA2 签名）
//
// 已实现：异步通知的 RSA2 验签（按支付宝规则排除 sign / sign_type、按 key 升序
//         拼接后用支付宝公钥验证）与状态解析；下单 / 退款的请求组装与签名。
//
// 待接入方在 Vercel 配置：
//   ALIPAY_PRIVATE_KEY     应用私钥（PEM，PKCS#8），payment_gateways.credential_env
//   ALIPAY_PUBLIC_KEY      支付宝公钥（PEM），用于验签
//   ALIPAY_GATEWAY         可选，默认正式网关；沙箱时填 openapi.alipaydev.com
// ---------------------------------------------------------------------------

const DEFAULT_GATEWAY = "https://openapi.alipay.com/gateway.do";

const TRADE_STATUS: Record<string, PayStatus> = {
  WAIT_BUYER_PAY: "unpaid",
  TRADE_CLOSED: "failed",
  TRADE_SUCCESS: "paid",
  TRADE_FINISHED: "paid",
};

function pemWrap(key: string, type: "PUBLIC" | "PRIVATE"): string {
  const trimmed = key.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed;
  const body = trimmed.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? trimmed;
  return `-----BEGIN ${type} KEY-----\n${body}\n-----END ${type} KEY-----`;
}

/** 支付宝签名串：过滤空值与 sign/sign_type，按 key 升序 k=v& 拼接（不 URL 编码）。 */
function signContent(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type" && params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

function signParams(params: Record<string, string>, privateKeyPem: string): string {
  return crypto
    .sign("RSA-SHA256", Buffer.from(signContent(params), "utf8"), privateKeyPem)
    .toString("base64");
}

async function callGateway(
  method: string,
  bizContent: Record<string, unknown>,
  appId: string,
  privateKeyPem: string,
  notifyUrl?: string,
): Promise<Record<string, unknown>> {
  const params: Record<string, string> = {
    app_id: appId,
    method,
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    version: "1.0",
    biz_content: JSON.stringify(bizContent),
    ...(notifyUrl ? { notify_url: notifyUrl } : {}),
  };
  params.sign = signParams(params, privateKeyPem);

  const gateway = process.env.ALIPAY_GATEWAY || DEFAULT_GATEWAY;
  const res = await fetch(gateway, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

export const alipayProvider: PaymentProvider = {
  key: "alipay",
  name: "支付宝",

  missingRequirements(gateway, creds) {
    const missing: string[] = [];
    if (!gateway.app_id) missing.push("应用 AppID");
    if (!gateway.notify_url) missing.push("回调地址");
    if (!creds.secret) missing.push(`应用私钥（环境变量 ${gateway.credential_env ?? "ALIPAY_PRIVATE_KEY"}）`);
    if (!process.env.ALIPAY_PUBLIC_KEY) missing.push("支付宝公钥（ALIPAY_PUBLIC_KEY）");
    return missing;
  },

  isReady(gateway, creds) {
    return gateway.status === "enabled" && this.missingRequirements(gateway, creds).length === 0;
  },

  async createPayment(input: CreatePaymentInput, gateway, creds): Promise<CreatePaymentResult> {
    const missing = this.missingRequirements(gateway, creds);
    if (missing.length) throw new PaymentNotConfiguredError("支付宝", missing.join("、"));

    const txnNo = `ALI${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const scenario = (input.scenario ?? "page").toLowerCase();
    const method =
      scenario === "wap"
        ? "alipay.trade.wap.pay"
        : scenario === "face" || scenario === "qr"
          ? "alipay.trade.precreate"
          : "alipay.trade.page.pay";

    const privateKey = pemWrap(creds.secret!, "PRIVATE");
    const biz = {
      out_trade_no: txnNo,
      total_amount: input.amount.toFixed(2),
      subject: input.subject,
      product_code: scenario === "wap" ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY",
      ...(input.expireMinutes ? { timeout_express: `${input.expireMinutes}m` } : {}),
    };

    // page/wap 支付是「拼一个带签名的跳转 URL 交给浏览器」，不是服务端调用。
    if (method !== "alipay.trade.precreate") {
      const params: Record<string, string> = {
        app_id: gateway.app_id!,
        method,
        charset: "utf-8",
        sign_type: "RSA2",
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        version: "1.0",
        notify_url: input.notifyUrl,
        ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
        biz_content: JSON.stringify(biz),
      };
      params.sign = signParams(params, privateKey);
      const url = `${process.env.ALIPAY_GATEWAY || DEFAULT_GATEWAY}?${new URLSearchParams(params)}`;
      return { txnNo, payload: { redirectUrl: url }, raw: params };
    }

    const json = await callGateway(method, biz, gateway.app_id!, privateKey, input.notifyUrl);
    const resp = (json["alipay_trade_precreate_response"] ?? {}) as Record<string, unknown>;
    return {
      txnNo,
      providerRef: (resp.out_trade_no as string) ?? undefined,
      payload: { qrCode: resp.qr_code },
      raw: json,
    };
  },

  async queryPayment(input: QueryPaymentInput, gateway, creds): Promise<QueryPaymentResult> {
    const missing = this.missingRequirements(gateway, creds);
    if (missing.length) throw new PaymentNotConfiguredError("支付宝", missing.join("、"));
    const json = await callGateway(
      "alipay.trade.query",
      { out_trade_no: input.txnNo },
      gateway.app_id!,
      pemWrap(creds.secret!, "PRIVATE"),
    );
    const resp = (json["alipay_trade_query_response"] ?? {}) as Record<string, unknown>;
    return {
      payStatus: TRADE_STATUS[String(resp.trade_status)] ?? "unpaid",
      amountPaid: Number(resp.total_amount ?? 0),
      paidAt: (resp.send_pay_date as string) ?? null,
      providerRef: (resp.trade_no as string) ?? undefined,
      raw: json,
    };
  },

  async refund(input: RefundInput, gateway, creds): Promise<RefundResult> {
    const missing = this.missingRequirements(gateway, creds);
    if (missing.length) throw new PaymentNotConfiguredError("支付宝", missing.join("、"));
    const json = await callGateway(
      "alipay.trade.refund",
      {
        out_trade_no: input.originTxnNo,
        out_request_no: input.refundNo,
        refund_amount: input.amount.toFixed(2),
        refund_reason: input.reason,
      },
      gateway.app_id!,
      pemWrap(creds.secret!, "PRIVATE"),
    );
    const resp = (json["alipay_trade_refund_response"] ?? {}) as Record<string, unknown>;
    const ok = resp.code === "10000";
    return {
      providerRef: (resp.trade_no as string) ?? undefined,
      status: ok ? "success" : "failed",
      message: ok ? undefined : String(resp.sub_msg ?? resp.msg ?? "退款失败"),
      raw: json,
    };
  },

  async parseWebhook(req: WebhookRequest): Promise<WebhookParseResult> {
    const params: Record<string, string> = {};
    new URLSearchParams(req.rawBody).forEach((v, k) => {
      params[k] = v;
    });
    if (Object.keys(params).length === 0) Object.assign(params, req.query);

    const externalId = params.notify_id ?? params.trade_no ?? null;
    const publicKeyRaw = process.env.ALIPAY_PUBLIC_KEY;
    const base = {
      externalId,
      eventType: params.notify_type ?? "trade_status_sync",
      orderNo: null as string | null,
      txnNo: params.out_trade_no ?? null,
      providerRef: params.trade_no ?? null,
      amountPaid: params.receipt_amount
        ? Number(params.receipt_amount)
        : params.total_amount
          ? Number(params.total_amount)
          : null,
      payStatus: TRADE_STATUS[params.trade_status] ?? null,
      paidAt: params.gmt_payment ?? null,
      refundNo: params.out_biz_no ?? null,
      refundAmount: params.refund_fee ? Number(params.refund_fee) : null,
      raw: params,
    };

    if (!publicKeyRaw) {
      return { ...base, signatureOk: false, error: "缺少 ALIPAY_PUBLIC_KEY，无法验签；通知已留存待人工核对" };
    }

    let signatureOk = false;
    try {
      signatureOk = crypto.verify(
        "RSA-SHA256",
        Buffer.from(signContent(params), "utf8"),
        pemWrap(publicKeyRaw, "PUBLIC"),
        Buffer.from(params.sign ?? "", "base64"),
      );
    } catch {
      signatureOk = false;
    }

    return signatureOk ? { ...base, signatureOk: true } : { ...base, signatureOk: false, error: "验签失败" };
  },

  ack(ok, message) {
    // 支付宝要求纯文本 "success"，任何其它内容都会触发重试。
    return new Response(ok ? "success" : `fail:${message ?? ""}`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};

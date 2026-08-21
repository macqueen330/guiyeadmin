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
// 银联全渠道（UnionPay AllInPay / 5.1.0 报文，SHA-256 + RSA 签名）
//
// 已实现：后台通知的验签（先对签名串做 SHA-256 摘要再按 key 升序拼接、
//         用银联公钥 RSA 验证，符合 5.1.0 规范）与状态解析；下单 / 退款报文组装。
//
// 待接入方在 Vercel 配置：
//   UNIONPAY_CERT_PASSWORD   商户私钥证书口令，payment_gateways.credential_env
//   UNIONPAY_PRIVATE_KEY     商户私钥（PEM）
//   UNIONPAY_CERT_ID         商户证书序列号
//   UNIONPAY_PUBLIC_KEY      银联公钥（PEM），用于验签
//   UNIONPAY_GATEWAY         可选，默认生产网关；测试环境填 gateway.test.95516.com
//
// 银联的对账文件下载（每日 10:00）走 /payments?view=reconcile 的导入流程，
// 由 reconciliation_batches 记录批次。
// ---------------------------------------------------------------------------

const PROD_GATEWAY = "https://gateway.95516.com";
const VERSION = "5.1.0";

const RESP_STATUS: Record<string, PayStatus> = {
  "00": "paid",
  "01": "paying",
  "03": "paying",
  "04": "paying",
  "05": "paying",
  "A6": "failed",
};

function gatewayBase(): string {
  return process.env.UNIONPAY_GATEWAY || PROD_GATEWAY;
}

function pemWrap(key: string, type: "PUBLIC" | "PRIVATE"): string {
  const trimmed = key.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed;
  const body = trimmed.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? trimmed;
  return `-----BEGIN ${type} KEY-----\n${body}\n-----END ${type} KEY-----`;
}

/** 银联签名串：过滤 signature、按 key 升序 k=v& 拼接，末尾不留 &。 */
function signContent(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== "signature" && params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function sign(params: Record<string, string>, privateKeyPem: string): string {
  // 5.1.0：先对拼接串做 SHA-256 摘要（十六进制小写），再对摘要串做 RSA-SHA256。
  const digest = sha256Hex(signContent(params));
  return crypto.sign("RSA-SHA256", Buffer.from(digest, "utf8"), privateKeyPem).toString("base64");
}

function verify(params: Record<string, string>, publicKeyPem: string): boolean {
  const digest = sha256Hex(signContent(params));
  try {
    return crypto.verify(
      "RSA-SHA256",
      Buffer.from(digest, "utf8"),
      publicKeyPem,
      Buffer.from(params.signature ?? "", "base64"),
    );
  } catch {
    return false;
  }
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function post(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, string>> {
  const res = await fetch(gatewayBase() + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  const out: Record<string, string> = {};
  new URLSearchParams(text).forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

export const unionpayProvider: PaymentProvider = {
  key: "unionpay",
  name: "银联",

  missingRequirements(gateway, creds) {
    const missing: string[] = [];
    if (!gateway.merchant_no) missing.push("商户号");
    if (!gateway.notify_url) missing.push("后台通知地址");
    if (!creds.secret) missing.push(`证书口令（环境变量 ${gateway.credential_env ?? "UNIONPAY_CERT_PASSWORD"}）`);
    if (!process.env.UNIONPAY_PRIVATE_KEY) missing.push("商户私钥（UNIONPAY_PRIVATE_KEY）");
    if (!process.env.UNIONPAY_CERT_ID) missing.push("商户证书序列号（UNIONPAY_CERT_ID）");
    if (!process.env.UNIONPAY_PUBLIC_KEY) missing.push("银联公钥（UNIONPAY_PUBLIC_KEY）");
    if (gateway.cert_expires_at && new Date(gateway.cert_expires_at) < new Date()) {
      missing.push("商户证书已过期，请更新后重新登记有效期");
    }
    return missing;
  },

  isReady(gateway, creds) {
    return gateway.status === "enabled" && this.missingRequirements(gateway, creds).length === 0;
  },

  async createPayment(input: CreatePaymentInput, gateway, creds): Promise<CreatePaymentResult> {
    const missing = this.missingRequirements(gateway, creds);
    if (missing.length) throw new PaymentNotConfiguredError("银联", missing.join("、"));

    const txnNo = `UP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const params: Record<string, string> = {
      version: VERSION,
      encoding: "UTF-8",
      signMethod: "01",
      txnType: "01",
      txnSubType: "01",
      bizType: input.scenario === "qr" ? "000000" : "000201",
      channelType: input.scenario === "app" ? "08" : "07",
      accessType: "0",
      merId: gateway.merchant_no!,
      orderId: txnNo,
      txnTime: stamp(),
      txnAmt: String(Math.round(input.amount * 100)),
      currencyCode: input.currency === "USD" ? "840" : "156",
      backUrl: input.notifyUrl,
      ...(input.returnUrl ? { frontUrl: input.returnUrl } : {}),
      certId: process.env.UNIONPAY_CERT_ID!,
    };
    params.signature = sign(params, pemWrap(process.env.UNIONPAY_PRIVATE_KEY!, "PRIVATE"));

    if (input.scenario === "qr") {
      const resp = await post("/gateway/api/backTransReq.do", params);
      return { txnNo, providerRef: resp.qrCode, payload: { qrCode: resp.qrCode }, raw: resp };
    }
    // 网关支付：把带签名的表单交给浏览器自动提交。
    return {
      txnNo,
      payload: { formAction: gatewayBase() + "/gateway/api/frontTransReq.do", formFields: params },
      raw: params,
    };
  },

  async queryPayment(input: QueryPaymentInput, gateway, creds): Promise<QueryPaymentResult> {
    const missing = this.missingRequirements(gateway, creds);
    if (missing.length) throw new PaymentNotConfiguredError("银联", missing.join("、"));
    const params: Record<string, string> = {
      version: VERSION,
      encoding: "UTF-8",
      signMethod: "01",
      txnType: "00",
      txnSubType: "00",
      bizType: "000000",
      accessType: "0",
      merId: gateway.merchant_no!,
      orderId: input.txnNo,
      txnTime: stamp(),
      certId: process.env.UNIONPAY_CERT_ID!,
    };
    params.signature = sign(params, pemWrap(process.env.UNIONPAY_PRIVATE_KEY!, "PRIVATE"));
    const resp = await post("/gateway/api/queryTrans.do", params);
    return {
      payStatus: RESP_STATUS[resp.origRespCode ?? resp.respCode] ?? "unpaid",
      amountPaid: Number(resp.txnAmt ?? 0) / 100,
      paidAt: resp.traceTime ?? null,
      providerRef: resp.queryId ?? undefined,
      raw: resp,
    };
  },

  async refund(input: RefundInput, gateway, creds): Promise<RefundResult> {
    const missing = this.missingRequirements(gateway, creds);
    if (missing.length) throw new PaymentNotConfiguredError("银联", missing.join("、"));
    const params: Record<string, string> = {
      version: VERSION,
      encoding: "UTF-8",
      signMethod: "01",
      txnType: "04",
      txnSubType: "00",
      bizType: "000201",
      accessType: "0",
      channelType: "07",
      merId: gateway.merchant_no!,
      orderId: input.refundNo,
      origQryId: input.originTxnNo,
      txnTime: stamp(),
      txnAmt: String(Math.round(input.amount * 100)),
      backUrl: input.notifyUrl ?? "",
      certId: process.env.UNIONPAY_CERT_ID!,
    };
    params.signature = sign(params, pemWrap(process.env.UNIONPAY_PRIVATE_KEY!, "PRIVATE"));
    const resp = await post("/gateway/api/backTransReq.do", params);
    const ok = resp.respCode === "00" || resp.respCode === "03";
    return {
      providerRef: resp.queryId,
      status: ok ? "processing" : "failed",
      message: ok ? undefined : resp.respMsg,
      raw: resp,
    };
  },

  async parseWebhook(req: WebhookRequest): Promise<WebhookParseResult> {
    const params: Record<string, string> = {};
    new URLSearchParams(req.rawBody).forEach((v, k) => {
      params[k] = v;
    });
    if (Object.keys(params).length === 0) Object.assign(params, req.query);

    const base = {
      externalId: params.queryId ?? params.orderId ?? null,
      eventType: params.txnType ?? null,
      orderNo: null as string | null,
      txnNo: params.orderId ?? null,
      providerRef: params.queryId ?? null,
      amountPaid: params.txnAmt ? Number(params.txnAmt) / 100 : null,
      payStatus: RESP_STATUS[params.respCode] ?? null,
      paidAt: params.traceTime ?? null,
      refundNo: params.txnType === "04" ? (params.orderId ?? null) : null,
      refundAmount: params.txnType === "04" && params.txnAmt ? Number(params.txnAmt) / 100 : null,
      raw: params,
    };

    const publicKey = process.env.UNIONPAY_PUBLIC_KEY;
    if (!publicKey) {
      return { ...base, signatureOk: false, error: "缺少 UNIONPAY_PUBLIC_KEY，无法验签；通知已留存待人工核对" };
    }
    const ok = verify(params, pemWrap(publicKey, "PUBLIC"));
    return ok ? { ...base, signatureOk: true } : { ...base, signatureOk: false, error: "验签失败" };
  },

  ack(ok) {
    // 银联要求返回纯文本 "ok"，否则会持续重推。
    return new Response(ok ? "ok" : "fail", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};

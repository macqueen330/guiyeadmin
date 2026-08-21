import type { PaymentGateway, PaymentProviderKey, PayStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// 支付渠道适配层。
//
// 设计目标：微信支付 / 支付宝 / 银联的对接**只需要实现这一个接口**，其余部分
// （配置、回调落库、幂等、订单状态推进、审计）都已经写好且与渠道无关。
//
// 配置来自 Supabase 的 payment_gateways 表（商户号 / AppID / 回调地址 / 费率…），
// 密钥永远不入库：表里存的是环境变量名（credential_env），值配置在 Vercel。
// ---------------------------------------------------------------------------

export class PaymentNotConfiguredError extends Error {
  constructor(provider: string, detail: string) {
    super(`支付渠道「${provider}」尚未完成配置：${detail}`);
    this.name = "PaymentNotConfiguredError";
  }
}

export class PaymentProviderError extends Error {
  constructor(
    provider: string,
    message: string,
    readonly raw?: unknown,
  ) {
    super(`支付渠道「${provider}」返回错误：${message}`);
    this.name = "PaymentProviderError";
  }
}

/** 渠道凭据。由 resolveCredentials() 从环境变量读出，绝不来自数据库。 */
export interface ProviderCredentials {
  /** payment_gateways.credential_env 指向的主密钥（APIv3 key / 应用私钥 / 证书口令） */
  secret?: string;
  /** 平台公钥或平台证书（验签用），环境变量名约定见各适配器 */
  publicKey?: string;
  /** 回调专用密钥（部分渠道与主密钥不同） */
  webhookSecret?: string;
}

export interface CreatePaymentInput {
  orderNo: string;
  /** 单位：元。适配器负责转成渠道要求的最小货币单位 */
  amount: number;
  currency: string;
  subject: string;
  scenario?: string;
  clientIp?: string;
  /** 微信 JSAPI 需要 */
  openid?: string;
  notifyUrl: string;
  returnUrl?: string;
  expireMinutes?: number;
}

export interface CreatePaymentResult {
  /** 我方生成的支付流水号，写入 payments.txn_no */
  txnNo: string;
  /** 渠道侧的预支付标识（prepay_id / trade_no / tn 等） */
  providerRef?: string;
  /** 前端唤起支付所需的数据：二维码链接、跳转 URL、JSAPI 参数… */
  payload: Record<string, unknown>;
  expiresAt?: string;
  raw?: unknown;
}

export interface QueryPaymentInput {
  orderNo: string;
  txnNo: string;
}

export interface QueryPaymentResult {
  payStatus: PayStatus;
  amountPaid: number;
  paidAt: string | null;
  providerRef?: string;
  raw?: unknown;
}

export interface RefundInput {
  orderNo: string;
  originTxnNo: string;
  refundNo: string;
  /** 本次退款金额（元） */
  amount: number;
  /** 原交易总金额（元），多数渠道必填 */
  totalAmount: number;
  currency: string;
  reason?: string;
  notifyUrl?: string;
}

export interface RefundResult {
  providerRef?: string;
  /** 渠道受理后的状态。未接入时由调用方降级为「需人工在商户后台操作」 */
  status: "processing" | "success" | "failed";
  message?: string;
  raw?: unknown;
}

/** 回调解析结果。signatureOk=false 时**绝不允许**据此修改任何金额或状态。 */
export interface WebhookParseResult {
  signatureOk: boolean;
  /** 渠道通知的唯一 ID，作为幂等键 */
  externalId: string | null;
  eventType: string | null;
  orderNo: string | null;
  txnNo: string | null;
  providerRef?: string | null;
  amountPaid: number | null;
  payStatus: PayStatus | null;
  paidAt: string | null;
  /** 退款回调时填写 */
  refundNo?: string | null;
  refundAmount?: number | null;
  error?: string;
  raw: unknown;
}

export interface WebhookRequest {
  headers: Record<string, string>;
  rawBody: string;
  query: Record<string, string>;
}

export interface PaymentProvider {
  key: PaymentProviderKey;
  name: string;

  /** 该渠道是否具备发起支付的条件（配置齐全 + 已启用）。 */
  isReady(gateway: PaymentGateway, creds: ProviderCredentials): boolean;

  /** 缺什么，用于在支付配置页给出可操作的提示。 */
  missingRequirements(gateway: PaymentGateway, creds: ProviderCredentials): string[];

  createPayment(
    input: CreatePaymentInput,
    gateway: PaymentGateway,
    creds: ProviderCredentials,
  ): Promise<CreatePaymentResult>;

  queryPayment(
    input: QueryPaymentInput,
    gateway: PaymentGateway,
    creds: ProviderCredentials,
  ): Promise<QueryPaymentResult>;

  refund(
    input: RefundInput,
    gateway: PaymentGateway,
    creds: ProviderCredentials,
  ): Promise<RefundResult>;

  /** 验签 + 解析异步通知。实现必须在验签失败时返回 signatureOk:false，而不是抛错。 */
  parseWebhook(
    req: WebhookRequest,
    gateway: PaymentGateway,
    creds: ProviderCredentials,
  ): Promise<WebhookParseResult>;

  /** 各平台要求的应答体（微信要 JSON、支付宝要 "success" 纯文本…）。 */
  ack(ok: boolean, message?: string): Response;
}

import "server-only";

import { getDb, getServiceDb, num } from "@/lib/data/db";
import type { PaymentGateway, PaymentProviderKey } from "@/lib/types";
import { alipayProvider } from "./alipay";
import { bankTransferProvider, creditTermProvider, offlineProvider } from "./manual";
import { unionpayProvider } from "./unionpay";
import { wechatPayProvider } from "./wechat";
import type { PaymentProvider, ProviderCredentials } from "./types";

const PROVIDERS: Record<PaymentProviderKey, PaymentProvider> = {
  wechat_pay: wechatPayProvider,
  alipay: alipayProvider,
  unionpay: unionpayProvider,
  bank_transfer: bankTransferProvider,
  offline: offlineProvider,
  credit_term: creditTermProvider,
};

export const PROVIDER_KEYS = Object.keys(PROVIDERS) as PaymentProviderKey[];

export function providerFor(key: string): PaymentProvider | null {
  return PROVIDERS[key as PaymentProviderKey] ?? null;
}

/**
 * 从环境变量读取渠道凭据。数据库里存的是变量名，值只在服务端进程内可见 ——
 * 任何时候都不要把这个对象返回给客户端。
 */
export function resolveCredentials(gateway: PaymentGateway): ProviderCredentials {
  const secret = gateway.credential_env ? process.env[gateway.credential_env] : undefined;
  return {
    secret: secret || undefined,
    publicKey:
      gateway.provider === "alipay"
        ? process.env.ALIPAY_PUBLIC_KEY
        : gateway.provider === "unionpay"
          ? process.env.UNIONPAY_PUBLIC_KEY
          : process.env.WECHAT_PAY_PLATFORM_CERT,
    webhookSecret: process.env[`${gateway.provider.toUpperCase()}_WEBHOOK_SECRET`],
  };
}

function coerce(row: Record<string, unknown>): PaymentGateway {
  return {
    ...(row as unknown as PaymentGateway),
    fee_rate: num(row.fee_rate),
    fee_fixed: num(row.fee_fixed),
  };
}

/** 已登录上下文中的渠道配置。 */
export async function getGateway(provider: string): Promise<PaymentGateway | null> {
  const sb = await getDb();
  if (!sb) return null;
  const { data } = await sb.from("payment_gateways").select("*").eq("provider", provider).maybeSingle();
  return data ? coerce(data as Record<string, unknown>) : null;
}

/** Webhook 上下文（没有管理员会话）中的渠道配置。 */
export async function getGatewayForWebhook(provider: string): Promise<PaymentGateway | null> {
  const sb = getServiceDb();
  if (!sb) return null;
  const { data } = await sb.from("payment_gateways").select("*").eq("provider", provider).maybeSingle();
  return data ? coerce(data as Record<string, unknown>) : null;
}

export interface GatewayReadiness {
  provider: PaymentProviderKey;
  name: string;
  /** 具备发起支付 / 退款的条件 */
  ready: boolean;
  /** 还缺什么（直接展示给管理员） */
  missing: string[];
  /** 密钥所在的环境变量是否已配置（只回答有没有，绝不回传值） */
  credentialPresent: boolean;
  certExpiringSoon: boolean;
  certExpired: boolean;
}

/** 支付配置页用的「到底能不能用」判断，取代原来写死的「已启用 / 测试已通过」。 */
export function readinessFor(gateway: PaymentGateway): GatewayReadiness {
  const provider = providerFor(gateway.provider);
  const creds = resolveCredentials(gateway);
  const expires = gateway.cert_expires_at ? new Date(gateway.cert_expires_at).getTime() : null;
  return {
    provider: gateway.provider,
    name: gateway.name,
    ready: provider ? provider.isReady(gateway, creds) : false,
    missing: provider ? provider.missingRequirements(gateway, creds) : ["未知支付渠道"],
    credentialPresent: Boolean(creds.secret),
    certExpired: expires !== null && expires < Date.now(),
    certExpiringSoon:
      expires !== null && expires >= Date.now() && expires - Date.now() < 30 * 86_400_000,
  };
}

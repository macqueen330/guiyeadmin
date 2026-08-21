import type { NextRequest } from "next/server";
import { getGatewayForWebhook, providerFor, resolveCredentials } from "@/lib/payments/registry";
import { applyPaymentNotification, storeWebhookEvent } from "@/lib/payments/apply";

// 支付平台异步通知入口。
//
//   /api/pay/wechat_pay/notify
//   /api/pay/alipay/notify
//   /api/pay/unionpay/notify
//
// 这些地址登记在 payment_gateways.notify_url，接入渠道时填给平台即可，
// 不需要改代码。流程对所有渠道一致：
//   落库（幂等）→ 验签 → 应用到 payments/orders → 按平台格式应答。
//
// 注意：本路由**不需要**管理员会话（平台不会带 Cookie），因此
//   * src/proxy.ts 把 /api/pay 列为 public；
//   * 一切信任都来自签名验证，验签失败只落库、不改数据。

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider: providerKey } = await ctx.params;
  const provider = providerFor(providerKey);
  if (!provider) {
    return new Response(JSON.stringify({ code: "FAIL", message: "未知支付渠道" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const gateway = await getGatewayForWebhook(providerKey);
  if (!gateway) {
    return provider.ack(false, "支付渠道未配置");
  }

  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    // 不要把可能含凭据的头写进数据库。
    if (k === "authorization" || k === "cookie") return;
    headers[k] = v;
  });
  const query: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  const parsed = await provider.parseWebhook(
    { headers, rawBody, query },
    gateway,
    resolveCredentials(gateway),
  );

  const stored = await storeWebhookEvent(providerKey, parsed, headers);
  if (!stored) return provider.ack(false, "无法记录通知");
  // 幂等：平台重推同一条通知时直接应答成功，不重复扣减 / 加款。
  if (stored.alreadyProcessed) return provider.ack(true);

  const result = await applyPaymentNotification(providerKey, parsed, stored.id);
  return provider.ack(result.ok, result.message);
}

// 部分渠道会用 GET 做联通性探测。
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider: providerKey } = await ctx.params;
  const provider = providerFor(providerKey);
  if (!provider) return new Response("unknown provider", { status: 404 });
  return new Response(
    JSON.stringify({ ok: true, provider: providerKey, name: provider.name }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

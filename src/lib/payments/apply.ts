import "server-only";

import { getServiceDb, num } from "@/lib/data/db";
import type { PayStatus } from "@/lib/types";
import type { WebhookParseResult } from "./types";

// ---------------------------------------------------------------------------
// 把一条**已验签**的支付通知落到业务数据上。
//
// 三条铁律：
//   1. signatureOk 为 false 的通知只入 payment_webhook_events，绝不改动金额或状态。
//   2. 幂等：同一个 (provider, external_id) 只处理一次；重复推送直接应答成功。
//   3. 金额以渠道通知为准写入 payments，但订单的 amount_received 只在
//      「通知金额 == 应付金额」时自动置为已收，否则标记为支付异常等待人工核对。
// ---------------------------------------------------------------------------

export interface StoredWebhook {
  id: string;
  alreadyProcessed: boolean;
}

/** 先落库（无论验签是否通过），返回是否已经处理过。 */
export async function storeWebhookEvent(
  provider: string,
  parsed: WebhookParseResult,
  headers: Record<string, string>,
): Promise<StoredWebhook | null> {
  const sb = getServiceDb();
  if (!sb) return null;

  const externalId = parsed.externalId ?? `${provider}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const { data: existing } = await sb
    .from("payment_webhook_events")
    .select("id,processed")
    .eq("provider", provider)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing) {
    return { id: String(existing.id), alreadyProcessed: Boolean(existing.processed) };
  }

  const { data, error } = await sb
    .from("payment_webhook_events")
    .insert({
      provider,
      event_type: parsed.eventType,
      external_id: externalId,
      txn_no: parsed.txnNo,
      order_no: parsed.orderNo,
      amount: parsed.amountPaid,
      signature_ok: parsed.signatureOk,
      payload: parsed.raw ?? {},
      headers,
      processed: false,
      error: parsed.error ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return { id: String(data.id), alreadyProcessed: false };
}

async function markProcessed(eventId: string, error?: string): Promise<void> {
  const sb = getServiceDb();
  if (!sb) return;
  await sb
    .from("payment_webhook_events")
    .update({
      processed: !error,
      processed_at: new Date().toISOString(),
      error: error ?? null,
    })
    .eq("id", eventId);
}

const FULFILL_AFTER_PAY: Record<string, string> = {
  assign: "prep",
};

/** 应用一条已验签的支付成功 / 退款通知。 */
export async function applyPaymentNotification(
  provider: string,
  parsed: WebhookParseResult,
  eventId: string,
): Promise<{ ok: boolean; message?: string }> {
  const sb = getServiceDb();
  if (!sb) return { ok: false, message: "数据库未配置" };

  if (!parsed.signatureOk) {
    await markProcessed(eventId, parsed.error ?? "验签未通过，已留存待人工核对");
    return { ok: false, message: "验签未通过" };
  }
  if (!parsed.txnNo) {
    await markProcessed(eventId, "通知中缺少商户订单号");
    return { ok: false, message: "缺少商户订单号" };
  }

  const { data: payment } = await sb
    .from("payments")
    .select("*")
    .eq("txn_no", parsed.txnNo)
    .maybeSingle();

  if (!payment) {
    await markProcessed(eventId, `未找到支付流水 ${parsed.txnNo}`);
    return { ok: false, message: "未找到对应支付流水" };
  }

  const orderNo = String(payment.order_no);
  const amountDue = num(payment.amount_due);
  const notified = parsed.amountPaid ?? 0;

  // ---- 退款通知 ----
  if (parsed.refundNo) {
    const refundAmount = parsed.refundAmount ?? 0;
    await sb
      .from("refunds")
      .update({
        status: "success",
        actual_amount: refundAmount,
        arrived_at: new Date().toISOString(),
        raw: parsed.raw,
        updated_at: new Date().toISOString(),
      })
      .eq("refund_no", parsed.refundNo);

    const totalRefunded = num(payment.refunded) + refundAmount;
    const nextPayStatus: PayStatus = totalRefunded >= amountDue ? "refunded" : "partial_refund";
    await sb
      .from("payments")
      .update({ refunded: totalRefunded, pay_status: nextPayStatus, updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    await sb.from("orders").update({ pay_status: nextPayStatus }).eq("order_no", orderNo);

    await markProcessed(eventId);
    return { ok: true };
  }

  // ---- 支付结果通知 ----
  const payStatus = parsed.payStatus;
  if (!payStatus) {
    await markProcessed(eventId, "通知中没有可识别的支付状态");
    return { ok: false, message: "无法识别支付状态" };
  }

  const amountMatches = Math.abs(notified - amountDue) < 0.01;
  const effectiveStatus: PayStatus =
    payStatus === "paid" && !amountMatches ? "pay_exception" : payStatus;

  await sb
    .from("payments")
    .update({
      pay_status: effectiveStatus,
      amount_paid: notified,
      paid_at: parsed.paidAt ?? new Date().toISOString(),
      arrived: effectiveStatus === "paid",
      raw: parsed.raw,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  const { data: order } = await sb
    .from("orders")
    .select("id,order_no,fulfill_status")
    .eq("order_no", orderNo)
    .maybeSingle();

  if (order) {
    const patch: Record<string, unknown> = { pay_status: effectiveStatus };
    if (effectiveStatus === "paid") {
      patch.amount_received = notified;
      const next = FULFILL_AFTER_PAY[String(order.fulfill_status)];
      if (next) patch.fulfill_status = next;
    }
    await sb.from("orders").update(patch).eq("id", order.id);
    await sb.from("order_events").insert({
      order_id: order.id,
      order_no: orderNo,
      event_type: "pay_notify",
      to_value: effectiveStatus,
      note: amountMatches
        ? `${provider} 异步通知：${effectiveStatus}`
        : `${provider} 通知金额 ${notified} 与应付 ${amountDue} 不一致，已标记支付异常`,
      operator_name: "支付回调",
    });
  }

  await markProcessed(eventId, amountMatches ? undefined : "通知金额与应付金额不一致");
  return { ok: true, message: amountMatches ? undefined : "金额不一致，已标记支付异常" };
}

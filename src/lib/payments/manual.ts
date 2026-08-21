import "server-only";

import type { PaymentProviderKey } from "@/lib/types";
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
} from "./types";

// 银行转账 / 线下收款 / 账期：没有支付平台，全靠财务人工确认到账。
// 它们同样实现 PaymentProvider，这样上层（订单收款、退款审批）只有一条代码路径。

function makeManual(key: PaymentProviderKey, name: string, prefix: string): PaymentProvider {
  return {
    key,
    name,

    missingRequirements(gateway) {
      const missing: string[] = [];
      if (key === "bank_transfer" && !gateway.bank_account_no) missing.push("收款银行账号");
      if (key === "credit_term" && !gateway.term_days) missing.push("账期天数");
      return missing;
    },

    isReady(gateway) {
      return gateway.status === "enabled";
    },

    async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
      // 生成一条待人工确认的流水，不调用任何外部接口。
      return {
        txnNo: `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`,
        payload: {
          manual: true,
          instruction: `${name}：请在收到款项后，由财务在支付中心手动确认到账。`,
          amount: input.amount,
          orderNo: input.orderNo,
        },
      };
    },

    async queryPayment(input: QueryPaymentInput): Promise<QueryPaymentResult> {
      throw new PaymentNotConfiguredError(name, `${name} 无在线查询接口，请以财务确认为准（${input.txnNo}）`);
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      return {
        status: "processing",
        message: `${name} 无在线退款接口：请财务按 ${input.refundNo} 线下退款后，在退款管理中标记为已完成。`,
      };
    },

    async parseWebhook(): Promise<WebhookParseResult> {
      return {
        signatureOk: false,
        externalId: null,
        eventType: null,
        orderNo: null,
        txnNo: null,
        amountPaid: null,
        payStatus: null,
        paidAt: null,
        error: `${name} 不支持异步通知`,
        raw: null,
      };
    },

    ack(ok) {
      return new Response(ok ? "ok" : "unsupported", { status: ok ? 200 : 404 });
    },
  };
}

export const bankTransferProvider = makeManual("bank_transfer", "银行转账", "BANK");
export const offlineProvider = makeManual("offline", "线下收款", "OFF");
export const creditTermProvider = makeManual("credit_term", "账期", "TERM");

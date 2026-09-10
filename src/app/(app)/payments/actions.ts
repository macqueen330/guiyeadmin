"use server";

import { revalidatePath } from "next/cache";
import {
  bool,
  dec,
  int,
  list,
  optStr,
  requireSuperAdmin,
  mustAffect,
  runAction,
  str,
  type ActionResult,
} from "@/lib/actions/common";
import { canActDirectly, createApprovalRequest } from "@/lib/data/approvals";
import { getCurrentAdmin } from "@/lib/auth/context";
import { logAudit, actorFrom } from "@/lib/auth/audit";
import { getGateway, providerFor, readinessFor, resolveCredentials } from "@/lib/payments/registry";
import { getDb } from "@/lib/data/db";
import { EXPORT_CAP, assertExportAllowed, assertNotTruncated, buildCsv, csvFilename, type CsvColumn } from "@/lib/csv";

// 支付中心与财务结算的写入路径。
//
// 原状：支付配置整页是「静态截图式 JSX」——22 个配置值全是字面量字符串，
// 没有 state、没有 input、没有保存按钮；「导入对账文件」「导出流水」「导出退款」
// 三个按钮没有 onClick。而 rbac 里「修改微信 / 支付宝 / 银联配置」被列为 L1 独有权限。

const MODULE = "finance";

function refresh() {
  revalidatePath("/payments");
  revalidatePath("/finance");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// 支付渠道配置（L1 独有）
// ---------------------------------------------------------------------------

export async function savePaymentGatewayAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const provider = str(fd, "provider");
  try {
    // rbac.L1_ONLY 里的「修改微信 / 支付宝 / 银联配置」现在真的被强制执行。
    await requireSuperAdmin("修改支付渠道配置");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return runAction(
    {
      module: MODULE,
      permission: "查看支付流水",
      success: "支付渠道配置已保存",
      audit: () => ({
        action: "update_payment_gateway",
        module: "支付中心",
        detail: `修改 ${provider} 渠道配置`,
        targetName: provider,
        after: {
          merchant_no: str(fd, "merchant_no"),
          app_id: str(fd, "app_id"),
          status: str(fd, "status"),
          fee_rate: dec(fd, "fee_rate"),
        },
      }),
    },
    async ({ sb, me }) => {
      const patch: Record<string, unknown> = {
        merchant_no: optStr(fd, "merchant_no"),
        app_id: optStr(fd, "app_id"),
        // 只登记环境变量名，密钥本身永远不入库。
        credential_env: optStr(fd, "credential_env"),
        cert_ref: optStr(fd, "cert_ref"),
        cert_expires_at: optStr(fd, "cert_expires_at"),
        notify_url: optStr(fd, "notify_url"),
        return_url: optStr(fd, "return_url"),
        scenarios: list(fd, "scenarios"),
        fee_rate: dec(fd, "fee_rate"),
        fee_fixed: dec(fd, "fee_fixed"),
        settle_cycle: optStr(fd, "settle_cycle"),
        bank_account_name: optStr(fd, "bank_account_name"),
        bank_account_no: optStr(fd, "bank_account_no"),
        bank_name: optStr(fd, "bank_name"),
        term_days: fd.get("term_days") ? int(fd, "term_days") : null,
        is_sandbox: bool(fd, "is_sandbox"),
        status: str(fd, "status", "disabled"),
        updated_by: me.id,
      };
      if (patch.fee_rate !== null && (Number(patch.fee_rate) < 0 || Number(patch.fee_rate) > 0.2)) {
        throw new Error("费率应为 0–0.2 之间的小数（0.006 = 0.6%）");
      }
      await mustAffect(
        sb.from("payment_gateways").update(patch).eq("provider", provider).select("id"),
        "保存支付渠道配置",
      );
      refresh();
    },
  );
}

/** 连通性自检：只检查配置齐不齐 + 环境变量在不在，不发起真实交易。 */
export async function testPaymentGatewayAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const provider = str(fd, "provider");
  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };

  const gateway = await getGateway(provider);
  if (!gateway) return { ok: false, error: "支付渠道不存在" };
  const readiness = readinessFor(gateway);

  const sb = await getDb();
  if (sb) {
    await sb
      .from("payment_gateways")
      .update({
        test_status: readiness.ready ? "passed" : "failed",
        last_test_at: new Date().toISOString(),
        last_test_message: readiness.ready ? "配置齐全，可发起支付" : readiness.missing.join("；"),
      })
      .eq("provider", provider);
  }

  await logAudit({
    category: "operation",
    action: "test_payment_gateway",
    actor: actorFrom(me),
    module: "支付中心",
    detail: `${provider} 配置自检：${readiness.ready ? "通过" : readiness.missing.join("；")}`,
    result: readiness.ready ? "success" : "fail",
  });

  refresh();
  return readiness.ready
    ? { ok: true, message: "配置齐全，可以发起支付" }
    : { ok: false, error: `还缺：${readiness.missing.join("；")}` };
}

// ---------------------------------------------------------------------------
// 退款审批（金额阈值来自 approval_rules）
// ---------------------------------------------------------------------------

export async function createRefundAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const orderNo = str(fd, "order_no");
  const amount = dec(fd, "amount");
  const reason = str(fd, "reason");

  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };

  const gate = await canActDirectly(me.level, "refund", amount);
  if (!gate.allowed) {
    await createApprovalRequest({
      actionKey: "refund",
      title: `订单 ${orderNo} 退款 ${amount}`,
      amount,
      payload: { orderNo, amount, reason },
      requiredLevel: gate.decision.level ?? "L1",
      requesterId: me.id,
      requesterName: me.name,
    });
    revalidatePath("/settings");
    return { ok: false, error: `${gate.reason}，已自动提交审批单` };
  }

  return runAction(
    {
      module: MODULE,
      permission: "审核退款",
      success: "退款单已创建",
      audit: () => ({
        action: "create_refund",
        module: "支付中心",
        detail: `订单 ${orderNo} 退款 ${amount}：${reason}`,
        targetName: orderNo,
        after: { amount, reason },
      }),
    },
    async ({ sb, me: actor }) => {
      if (amount <= 0) throw new Error("退款金额必须大于 0");
      if (!reason) throw new Error("请填写退款原因");

      const { data: payment } = await sb
        .from("payments")
        .select("id,txn_no,method,amount_paid,refunded,gateway_id")
        .eq("order_no", orderNo)
        .maybeSingle();
      if (!payment) throw new Error("该订单没有支付流水，无法发起退款");

      const alreadyRefunded = Number(payment.refunded) || 0;
      const paid = Number(payment.amount_paid) || 0;
      if (alreadyRefunded + amount > paid + 0.001) {
        throw new Error(`累计退款不能超过原交易 ${paid}（已退 ${alreadyRefunded}）`);
      }

      const { data: refundNoRow } = await sb.rpc("gy_next_refund_no");
      const refundNo = String(refundNoRow ?? `RF-${Date.now()}`);

      const { error } = await sb.from("refunds").insert({
        order_no: orderNo,
        refund_no: refundNo,
        origin_txn_no: String(payment.txn_no),
        method: String(payment.method),
        gateway_id: payment.gateway_id,
        applied_amount: amount,
        actual_amount: 0,
        reason,
        operator: actor.name,
        operator_id: actor.id,
        status: "reviewing",
        partial: alreadyRefunded + amount < paid,
      });
      if (error) throw new Error(`创建退款单失败：${error.message}`);
      refresh();
    },
  );
}

/** 审批通过退款单 → 调用渠道退款接口；渠道未接入时转人工处理并如实说明。 */
export async function approveRefundAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const refundId = str(fd, "refund_id");
  return runAction(
    {
      module: MODULE,
      permission: "审核退款",
      success: "退款已提交渠道处理",
      audit: () => ({
        action: "approve_refund",
        module: "支付中心",
        detail: `审批通过退款单 ${refundId}`,
        targetId: refundId,
      }),
    },
    async ({ sb, me }) => {
      const { data: refund } = await sb.from("refunds").select("*").eq("id", refundId).maybeSingle();
      if (!refund) throw new Error("退款单不存在");
      if (!["applying", "reviewing"].includes(String(refund.status))) {
        throw new Error("该退款单已处理");
      }

      const amount = Number(refund.applied_amount) || 0;
      const gate = await canActDirectly(me.level, "refund", amount);
      if (!gate.allowed) throw new Error(gate.reason ?? "权限不足");

      const gateway = await getGateway(String(refund.method));
      const provider = gateway ? providerFor(gateway.provider) : null;

      let note = "";
      let nextStatus = "processing";

      if (gateway && provider) {
        try {
          const { data: payment } = await sb
            .from("payments")
            .select("amount_paid")
            .eq("txn_no", String(refund.origin_txn_no))
            .maybeSingle();
          const result = await provider.refund(
            {
              orderNo: String(refund.order_no),
              originTxnNo: String(refund.origin_txn_no),
              refundNo: String(refund.refund_no),
              amount,
              totalAmount: Number(payment?.amount_paid) || amount,
              currency: String(refund.currency ?? "CNY"),
              reason: String(refund.reason ?? ""),
              notifyUrl: gateway.notify_url ?? undefined,
            },
            gateway,
            resolveCredentials(gateway),
          );
          nextStatus = result.status === "success" ? "success" : "processing";
          note = result.message ?? "";
        } catch (e) {
          // 渠道未接入 / 未配置：如实记录，转人工，不谎报成功。
          note = (e as Error).message;
          nextStatus = "processing";
        }
      } else {
        note = "该支付方式没有在线退款接口，请财务线下处理后手动标记完成";
      }

      const { error } = await sb
        .from("refunds")
        .update({
          status: nextStatus,
          approved_by: me.id,
          approved_at: new Date().toISOString(),
          reject_note: note || null,
          ...(nextStatus === "success"
            ? { actual_amount: amount, arrived_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", refundId);
      if (error) throw new Error(`更新退款单失败：${error.message}`);
      refresh();
    },
  );
}

export async function rejectRefundAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const refundId = str(fd, "refund_id");
  const note = str(fd, "note");
  return runAction(
    {
      module: MODULE,
      permission: "审核退款",
      success: "退款申请已驳回",
      audit: () => ({
        action: "reject_refund",
        module: "支付中心",
        detail: `驳回退款单 ${refundId}：${note}`,
        targetId: refundId,
      }),
    },
    async ({ sb, me }) => {
      if (!note) throw new Error("驳回必须填写原因");
      const { error } = await sb
        .from("refunds")
        .update({
          status: "rejected",
          reject_note: note,
          approved_by: me.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", refundId);
      if (error) throw new Error(`驳回失败：${error.message}`);
      refresh();
    },
  );
}

/** 财务人工确认退款到账（线下 / 无接口渠道）。 */
export async function markRefundArrivedAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const refundId = str(fd, "refund_id");
  const actual = dec(fd, "actual_amount");
  return runAction(
    {
      module: MODULE,
      permission: "确认收款",
      success: "已标记退款到账",
      audit: () => ({
        action: "mark_refund_arrived",
        module: "支付中心",
        detail: `退款单 ${refundId} 实退 ${actual}`,
        targetId: refundId,
      }),
    },
    async ({ sb }) => {
      const { data: refund } = await sb
        .from("refunds")
        .select("order_no,origin_txn_no,applied_amount")
        .eq("id", refundId)
        .maybeSingle();
      if (!refund) throw new Error("退款单不存在");
      const amount = actual || Number(refund.applied_amount) || 0;

      const { data, error } = await sb
        .from("refunds")
        .update({ status: "success", actual_amount: amount, arrived_at: new Date().toISOString() })
        .eq("id", refundId)
        .select("id");
      if (error) throw new Error(`更新失败：${error.message}`);
      if (((data ?? []) as unknown[]).length === 0) throw new Error("更新失败：退款单不存在或无权修改");

      // 同步支付流水的累计退款与订单支付状态。
      const { data: payment } = await sb
        .from("payments")
        .select("id,refunded,amount_paid")
        .eq("txn_no", String(refund.origin_txn_no))
        .maybeSingle();
      if (payment) {
        const total = (Number(payment.refunded) || 0) + amount;
        const full = total >= (Number(payment.amount_paid) || 0) - 0.001;
        await sb
          .from("payments")
          .update({ refunded: total, pay_status: full ? "refunded" : "partial_refund" })
          .eq("id", payment.id);
        await sb
          .from("orders")
          .update({ pay_status: full ? "refunded" : "partial_refund" })
          .eq("order_no", String(refund.order_no));
      }
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 渠道对账文件导入（「渠道对账」整页的设计前提）
// ---------------------------------------------------------------------------

export async function importReconciliationAction(
  _prev: ActionResult<{ matched: number; diff: number }> | null,
  fd: FormData,
): Promise<ActionResult<{ matched: number; diff: number }>> {
  const provider = str(fd, "provider");
  const statDate = str(fd, "stat_date");
  const file = fd.get("file");

  return runAction<{ matched: number; diff: number }>(
    {
      module: MODULE,
      permission: "导入对账文件",
      success: (r) => `导入完成：匹配 ${r.matched} 笔，差异 ${r.diff} 笔`,
      audit: (r) => ({
        action: "import_reconciliation",
        module: "支付中心",
        detail: `导入 ${provider} ${statDate} 对账文件：匹配 ${r.matched} / 差异 ${r.diff}`,
      }),
    },
    async ({ sb, me }) => {
      if (!(file instanceof File) || file.size === 0) throw new Error("请选择对账文件（CSV）");
      if (file.size > 5 * 1024 * 1024) throw new Error("文件过大（上限 5MB）");
      if (!statDate) throw new Error("请选择对账日期");

      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error("对账文件为空或缺少表头");

      const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
      const txnIdx = idx(["txn_no", "商户订单号", "订单号", "out_trade_no"]);
      const amtIdx = idx(["amount", "金额", "订单金额", "total_amount"]);
      const feeIdx = idx(["fee", "手续费", "服务费"]);
      if (txnIdx < 0 || amtIdx < 0) {
        throw new Error("对账文件需要包含「商户订单号」与「金额」两列");
      }

      const rows = lines.slice(1).map((l) => {
        const cells = l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return {
          txn: cells[txnIdx] ?? "",
          amount: Number(cells[amtIdx] ?? 0) || 0,
          fee: feeIdx >= 0 ? Number(cells[feeIdx] ?? 0) || 0 : 0,
        };
      });

      const { data: payments } = await sb
        .from("payments")
        .select("txn_no,amount_paid")
        .in("txn_no", rows.map((r) => r.txn).filter(Boolean));
      const byTxn = new Map(
        ((payments ?? []) as Record<string, unknown>[]).map((p) => [
          String(p.txn_no),
          Number(p.amount_paid) || 0,
        ]),
      );

      let matched = 0;
      let diff = 0;
      for (const r of rows) {
        const paid = byTxn.get(r.txn);
        if (paid !== undefined && Math.abs(paid - r.amount) < 0.01) matched += 1;
        else diff += 1;
      }

      const { error } = await sb.from("reconciliation_batches").insert({
        provider,
        stat_date: statDate,
        file_name: file.name,
        total_rows: rows.length,
        matched_rows: matched,
        diff_rows: diff,
        total_amount: rows.reduce((s, r) => s + r.amount, 0),
        total_fee: rows.reduce((s, r) => s + r.fee, 0),
        status: diff === 0 ? "reconciled" : "imported",
        note: diff === 0 ? "全部匹配" : `${diff} 笔与平台流水不一致，需人工核对`,
        operator_id: me.id,
        operator_name: me.name,
      });
      if (error) throw new Error(`保存对账批次失败：${error.message}`);

      refresh();
      return { matched, diff };
    },
  );
}

// ---------------------------------------------------------------------------
// 结算单：确认收款 / 导出
// ---------------------------------------------------------------------------

export async function markSettlementPaidAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = str(fd, "id");
  return runAction(
    {
      module: MODULE,
      permission: "确认收款",
      success: "已标记结清",
      audit: () => ({
        action: "settle_paid",
        module: "财务结算",
        detail: `结算单 ${id} 标记为已结清`,
        targetId: id,
      }),
    },
    async ({ sb }) => {
      const { data, error } = await sb
        .from("settlements")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (error) throw new Error(`更新失败：${error.message}`);
      if (((data ?? []) as unknown[]).length === 0) throw new Error("更新失败：结算单不存在或无权修改");
      refresh();
    },
  );
}

async function exportCsv(
  table: string,
  columns: CsvColumn<Record<string, unknown>>[],
  filename: string,
  permission: string,
  auditAction: string,
  moduleName: string,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  return runAction<{ csv: string; filename: string }>(
    {
      module: MODULE,
      permission,
      success: (r) => `已生成 ${r.filename}`,
      audit: (r) => ({ action: auditAction, module: moduleName, detail: `导出 ${r.filename}` }),
    },
    async ({ sb, me }) => {
      const { data, error } = await sb
        .from(table)
        .select(columns.map((c) => c.key).join(","))
        .limit(EXPORT_CAP + 1);
      if (error) throw new Error(`导出失败：${error.message}`);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      assertNotTruncated(rows.length);
      // 支付流水、退款、结算单是最敏感的三份数据，以前恰恰是这三个没判审批阈值 ——
      // 而安全策略页对「单次导出超过 N 行需审批」打的是绿色「已生效」。
      await assertExportAllowed(me.level, auditAction, rows.length);
      return { csv: buildCsv(rows, columns), filename: csvFilename(filename) };
    },
  );
}

export async function exportPaymentsAction(
  _prev: ActionResult<{ csv: string; filename: string }> | null,
  _fd: FormData,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  return exportCsv(
    "payments",
    [
      { key: "order_no", label: "订单号" },
      { key: "txn_no", label: "交易流水号" },
      { key: "method", label: "支付方式" },
      { key: "merchant_no", label: "商户单号" },
      { key: "amount_due", label: "应收金额" },
      { key: "amount_paid", label: "实收金额" },
      { key: "fee", label: "渠道手续费" },
      { key: "pay_status", label: "支付状态" },
      { key: "paid_at", label: "支付时间" },
      { key: "settle_status", label: "结算状态" },
      { key: "refunded", label: "已退金额" },
    ],
    "payments",
    "导出财务数据",
    "export_payments",
    "支付中心",
  );
}

export async function exportRefundsAction(
  _prev: ActionResult<{ csv: string; filename: string }> | null,
  _fd: FormData,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  return exportCsv(
    "refunds",
    [
      { key: "order_no", label: "订单号" },
      { key: "refund_no", label: "退款单号" },
      { key: "origin_txn_no", label: "原交易流水号" },
      { key: "method", label: "退款方式" },
      { key: "applied_amount", label: "申请金额" },
      { key: "actual_amount", label: "实退金额" },
      { key: "reason", label: "退款原因" },
      { key: "operator", label: "经办人" },
      { key: "applied_at", label: "申请时间" },
      { key: "arrived_at", label: "到账时间" },
      { key: "status", label: "退款状态" },
    ],
    "refunds",
    "导出财务数据",
    "export_refunds",
    "支付中心",
  );
}

export async function exportSettlementsAction(
  _prev: ActionResult<{ csv: string; filename: string }> | null,
  _fd: FormData,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  return exportCsv(
    "settlements",
    [
      { key: "ref_no", label: "结算单号" },
      { key: "type", label: "结算类型" },
      { key: "party", label: "结算对象" },
      { key: "amount", label: "金额" },
      { key: "currency", label: "币种" },
      { key: "status", label: "结算状态" },
      { key: "due_date", label: "应结日期" },
      { key: "paid_at", label: "结清时间" },
      { key: "created_at", label: "创建时间" },
    ],
    "settlements",
    "导出财务数据",
    "export_settlements",
    "财务结算",
  );
}

"use client";

import { useState } from "react";
import type { PaymentGateway, PaymentTxn, ReconciliationBatch, RefundRecord } from "@/lib/types";
import { fmtCurrency, fmtDate, fmtDateTime, fmtMoney } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ActionForm,
  ConfirmSubmit,
  ExportForm,
  Field,
  FieldGrid,
  Modal,
  ModalFooter,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/ui/Form";
import { useDict } from "@/components/shell/DictProvider";
import { useViewer } from "@/components/shell/AdminProvider";
import { can } from "@/lib/auth/permissions";
import {
  approveRefundAction,
  createRefundAction,
  exportPaymentsAction,
  exportRefundsAction,
  importReconciliationAction,
  markRefundArrivedAction,
  rejectRefundAction,
} from "./actions";
import { PaymentConfig } from "./PaymentConfig";
import type { GatewayReadiness } from "@/lib/payments/registry";

const EXCEPTION_TYPES = [
  "支付状态不一致",
  "重复付款",
  "金额不一致",
  "回调失败",
  "订单超时",
  "退款异常",
  "对账差异",
  "高风险订单",
];

export function PaymentsView({
  payments,
  refunds,
  gateways,
  readiness,
  batches,
  siteOrigin,
  view,
}: {
  payments: PaymentTxn[];
  refunds: RefundRecord[];
  gateways: PaymentGateway[];
  readiness: Record<string, GatewayReadiness>;
  batches: ReconciliationBatch[];
  siteOrigin: string;
  view: string;
}) {
  const dict = useDict();
  const viewer = useViewer();
  const [refundTarget, setRefundTarget] = useState<RefundRecord | null>(null);
  const [newRefundFor, setNewRefundFor] = useState<PaymentTxn | null>(null);

  const canReview = can(viewer, "finance", "审核退款");
  const canExport = can(viewer, "finance", "导出财务数据");
  const canImport = can(viewer, "finance", "导入对账文件");
  const canConfirm = can(viewer, "finance", "确认收款");

  // ---- 支付配置 ----
  if (view === "config") {
    return <PaymentConfig gateways={gateways} readiness={readiness} siteOrigin={siteOrigin} />;
  }

  // ---- 渠道对账 ----
  if (view === "reconcile") {
    return (
      <Reconcile
        payments={payments}
        batches={batches}
        gateways={gateways}
        canImport={canImport}
        methodTone={(m) => dict.tone("payment_method", m)}
      />
    );
  }

  const paymentColumns: Column<PaymentTxn>[] = [
    {
      key: "txn",
      header: "支付流水号 / 订单号",
      render: (p) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{p.txn_no}</span>
          <span style={{ fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
            {p.order_no}
          </span>
        </div>
      ),
    },
    {
      key: "method",
      header: "支付方式 / 商户号",
      render: (p) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
          <Chip tone={dict.tone("payment_method", p.method)} />
          <span style={{ fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
            {p.merchant_no || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "应付 / 实付",
      align: "right",
      render: (p) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
            {fmtMoney(p.amount_due)}
          </span>
          <span
            style={{ fontSize: 13, fontWeight: 700, color: "#16894f", fontVariantNumeric: "tabular-nums" }}
          >
            {fmtMoney(p.amount_paid)}
          </span>
        </div>
      ),
    },
    {
      key: "fee",
      header: "手续费",
      align: "right",
      // 2 位小数：整数化会让 1.13 显示成 ¥1，与合计对不上。
      render: (p) => (
        <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
          {fmtCurrency(p.fee, { decimals: 2 })}
        </span>
      ),
    },
    {
      key: "pay_status",
      header: "支付状态",
      align: "center",
      render: (p) => <StatusTag tone={dict.tone("pay_status", p.pay_status)} />,
    },
    {
      key: "arrived",
      header: "到账",
      align: "center",
      render: (p) => (
        <span style={{ fontSize: 12, fontWeight: 600, color: p.arrived ? "#16894f" : "#b45309" }}>
          {p.arrived ? "已到账" : "未到账"}
        </span>
      ),
    },
    {
      key: "settle",
      header: "对账状态",
      align: "center",
      render: (p) => <StatusTag tone={dict.tone("settle_status", p.settle_status)} />,
    },
    {
      key: "paid_at",
      header: "支付时间",
      render: (p) => (
        <span style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
          {fmtDateTime(p.paid_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (p) =>
        canReview && p.amount_paid > p.refunded ? (
          <Button
            variant="secondary"
            style={{ height: 28, padding: "0 10px", fontSize: 12 }}
            onClick={() => setNewRefundFor(p)}
          >
            发起退款
          </Button>
        ) : null,
    },
  ];

  const refundColumns: Column<RefundRecord>[] = [
    {
      key: "refund_no",
      header: "退款流水号 / 订单号",
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {r.refund_no}
            {r.partial && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: "#b45309",
                  background: "#fff7ec",
                  padding: "1px 6px",
                  borderRadius: 5,
                }}
              >
                部分
              </span>
            )}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
            {r.order_no}
          </span>
        </div>
      ),
    },
    {
      key: "origin",
      header: "原支付流水号",
      render: (r) => (
        <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
          {r.origin_txn_no}
        </span>
      ),
    },
    { key: "method", header: "方式", render: (r) => <Chip tone={dict.tone("payment_method", r.method)} /> },
    {
      key: "amount",
      header: "申请 / 实退",
      align: "right",
      render: (r) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtMoney(r.applied_amount)} / <b>{fmtMoney(r.actual_amount)}</b>
        </span>
      ),
    },
    {
      key: "reason",
      header: "原因",
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ color: "#4a514c" }}>{r.reason}</span>
          {r.reject_note && (
            <span style={{ fontSize: 10.5, color: "#b45309" }}>{r.reject_note}</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      align: "center",
      render: (r) => <StatusTag tone={dict.tone("refund_status", r.status)} />,
    },
    {
      key: "operator",
      header: "操作人 / 时间",
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontSize: 12.5, color: "#2c322e" }}>{r.operator}</span>
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{fmtDateTime(r.applied_at)}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (r) => {
        const pending = ["applying", "reviewing"].includes(r.status);
        const processing = r.status === "processing";
        if (!canReview && !canConfirm) return null;
        return (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {pending && canReview && (
              <Button
                variant="secondary"
                style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                onClick={() => setRefundTarget(r)}
              >
                审批
              </Button>
            )}
            {processing && canConfirm && (
              <ActionForm
                action={markRefundArrivedAction}
                hidden={{ refund_id: r.id, actual_amount: r.applied_amount }}
                style={{ gap: 0 }}
              >
                <SubmitButton variant="secondary" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
                  确认到账
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        );
      },
    },
  ];

  // ---- 退款管理 ----
  if (view === "refunds") {
    return (
      <>
        <FilterableTable
          rows={refunds}
          columns={refundColumns}
          filters={[
            {
              key: "method",
              label: "方式",
              options: dict.filterOptions("payment_method").slice(1),
              match: (r, v) => r.method === v,
            },
            {
              key: "status",
              label: "状态",
              options: dict.filterOptions("refund_status").slice(1),
              match: (r, v) => r.status === v,
            },
          ]}
          searchText={(r) => `${r.refund_no} ${r.order_no} ${r.origin_txn_no} ${r.reason}`}
          searchPlaceholder="搜索退款单 / 订单号 / 流水号"
          empty="暂无退款记录"
          rightAction={canExport ? <ExportForm action={exportRefundsAction} label="导出退款" /> : null}
        />
        <RefundApprovalModal refund={refundTarget} onClose={() => setRefundTarget(null)} />
      </>
    );
  }

  // ---- 支付流水 / 支付异常 ----
  const isException = view === "exception";
  const rows = isException
    ? payments.filter(
        (p) =>
          p.pay_status === "pay_exception" ||
          p.pay_status === "failed" ||
          p.settle_status === "settle_exception",
      )
    : payments;

  const filters: FilterDef<PaymentTxn>[] = isException
    ? []
    : [
        {
          key: "pay_status",
          label: "支付状态",
          options: dict.filterOptions("pay_status").slice(1),
          match: (p, v) => p.pay_status === v,
        },
        {
          key: "method",
          label: "方式",
          options: dict.filterOptions("payment_method").slice(1),
          match: (p, v) => p.method === v,
        },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isException && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderRadius: 12,
            background: "#fdf0ef",
            border: "1px solid #f6dcd8",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#c0392b", marginRight: 4 }}>
            常见异常类型
          </span>
          {EXCEPTION_TYPES.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "#a03227",
                background: "var(--card)",
                border: "1px solid #f0cfca",
                padding: "3px 9px",
                borderRadius: 6,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <FilterableTable
        rows={rows}
        columns={paymentColumns}
        filters={filters}
        searchText={(p) => `${p.txn_no} ${p.order_no} ${p.merchant_no}`}
        searchPlaceholder="搜索流水号 / 订单号 / 商户号"
        empty={isException ? "暂无支付异常" : "暂无支付流水"}
        rightAction={canExport ? <ExportForm action={exportPaymentsAction} label="导出流水" /> : null}
      />

      {/* 发起退款 */}
      <Modal
        open={Boolean(newRefundFor)}
        onClose={() => setNewRefundFor(null)}
        title="发起退款"
        subtitle={newRefundFor ? `订单 ${newRefundFor.order_no}` : undefined}
      >
        {newRefundFor && (
          <ActionForm
            action={createRefundAction}
            hidden={{ order_no: newRefundFor.order_no }}
            onSuccess={() => setNewRefundFor(null)}
          >
            <FieldGrid columns={2}>
              <Field label="退款金额" required hint={`可退上限 ${fmtMoney(newRefundFor.amount_paid - newRefundFor.refunded)}`}>
                <TextInput
                  name="amount"
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={newRefundFor.amount_paid - newRefundFor.refunded}
                  defaultValue={newRefundFor.amount_paid - newRefundFor.refunded}
                />
              </Field>
              <Field label="已退金额">
                <div style={{ height: 38, display: "flex", alignItems: "center", fontSize: 13 }}>
                  {fmtMoney(newRefundFor.refunded)}
                </div>
              </Field>
            </FieldGrid>
            <Field label="退款原因" required>
              <TextArea name="reason" rows={2} placeholder="例如：商品破损 / 客户取消" />
            </Field>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
              超过审批阈值时会自动生成审批单，由对应等级的管理员处理。
            </div>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setNewRefundFor(null)}>
                取消
              </Button>
              <SubmitButton>提交退款申请</SubmitButton>
            </ModalFooter>
          </ActionForm>
        )}
      </Modal>
    </div>
  );
}

function RefundApprovalModal({
  refund,
  onClose,
}: {
  refund: RefundRecord | null;
  onClose: () => void;
}) {
  if (!refund) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="退款审批"
      subtitle={`${refund.refund_no} · 申请 ${fmtMoney(refund.applied_amount)}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 12.5, color: "#4a514c", lineHeight: 1.8 }}>
          <div>订单：{refund.order_no}</div>
          <div>原因：{refund.reason}</div>
          <div>申请人：{refund.operator}</div>
          <div>申请时间：{fmtDateTime(refund.applied_at)}</div>
        </div>

        <ActionForm action={approveRefundAction} hidden={{ refund_id: refund.id }} onSuccess={onClose}>
          <ConfirmSubmit message={`确认通过 ${refund.refund_no} 的退款申请？`}>
            通过并提交渠道
          </ConfirmSubmit>
        </ActionForm>

        <div style={{ height: 1, background: "var(--line)" }} />

        <ActionForm action={rejectRefundAction} hidden={{ refund_id: refund.id }} onSuccess={onClose}>
          <Field label="驳回原因" required>
            <TextInput name="note" placeholder="例如：不符合退款政策" />
          </Field>
          <div>
            <SubmitButton variant="secondary">驳回申请</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </Modal>
  );
}

function Reconcile({
  payments,
  batches,
  gateways,
  canImport,
  methodTone,
}: {
  payments: PaymentTxn[];
  batches: ReconciliationBatch[];
  gateways: PaymentGateway[];
  canImport: boolean;
  methodTone: (m: string) => { text: string; color: string; bg: string };
}) {
  const [open, setOpen] = useState(false);

  const agg = new Map<string, { count: number; due: number; paid: number; fee: number; refunded: number }>();
  for (const p of payments) {
    const a = agg.get(p.method) ?? { count: 0, due: 0, paid: 0, fee: 0, refunded: 0 };
    a.count += 1;
    a.due += p.amount_due;
    a.paid += p.amount_paid;
    a.fee += p.fee;
    a.refunded += p.refunded;
    agg.set(p.method, a);
  }
  const rows = [...agg.entries()];

  const th: React.CSSProperties = {
    textAlign: "right",
    fontSize: 11,
    fontWeight: 600,
    color: "#9a9f9a",
    padding: "10px 8px",
    borderBottom: "1px solid var(--line)",
  };
  const td: React.CSSProperties = {
    textAlign: "right",
    padding: "12px 8px",
    borderBottom: "1px solid var(--line)",
    fontSize: 12.5,
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>渠道对账</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              按支付渠道汇总 · 以平台对账文件为最终依据
            </span>
          </div>
          {canImport && (
            <Button variant="secondary" icon="upload" onClick={() => setOpen(true)}>
              导入对账文件
            </Button>
          )}
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "26px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
            暂无支付流水
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>支付渠道</th>
                <th style={th}>笔数</th>
                <th style={th}>应收</th>
                <th style={th}>实收</th>
                <th style={th}>手续费</th>
                <th style={th}>累计退款</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([method, a]) => (
                <tr key={method} className="row-hover">
                  <td style={{ ...td, textAlign: "left" }}>
                    <Chip tone={methodTone(method)} />
                  </td>
                  <td style={td}>{a.count}</td>
                  <td style={td}>{fmtMoney(a.due)}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#16894f" }}>{fmtMoney(a.paid)}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{fmtCurrency(a.fee, { decimals: 2 })}</td>
                  <td style={{ ...td, color: a.refunded > 0 ? "#c0392b" : "var(--muted)" }}>
                    {fmtMoney(a.refunded)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>对账导入记录</span>
        {batches.length === 0 ? (
          <div style={{ padding: "22px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
            还没有导入过对账文件
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>渠道 / 文件</th>
                <th style={{ ...th, textAlign: "left" }}>对账日</th>
                <th style={th}>总行数</th>
                <th style={th}>匹配</th>
                <th style={th}>差异</th>
                <th style={th}>金额合计</th>
                <th style={{ ...th, textAlign: "left" }}>操作人 / 时间</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="row-hover">
                  <td style={{ ...td, textAlign: "left" }}>
                    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                      <span style={{ fontWeight: 600 }}>{b.provider}</span>
                      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{b.file_name ?? "—"}</span>
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: "left" }}>{fmtDate(b.stat_date)}</td>
                  <td style={td}>{b.total_rows}</td>
                  <td style={{ ...td, color: "#16894f", fontWeight: 700 }}>{b.matched_rows}</td>
                  <td style={{ ...td, color: b.diff_rows > 0 ? "#c0392b" : "var(--muted)", fontWeight: 700 }}>
                    {b.diff_rows}
                  </td>
                  <td style={td}>{fmtMoney(b.total_amount)}</td>
                  <td style={{ ...td, textAlign: "left", color: "var(--muted)" }}>
                    {b.operator_name ?? "—"} · {fmtDateTime(b.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="导入渠道对账文件"
        subtitle="CSV，需包含「商户订单号」与「金额」两列"
      >
        <ActionForm action={importReconciliationAction} onSuccess={() => setOpen(false)}>
          <FieldGrid columns={2}>
            <Field label="支付渠道" required>
              <Select
                name="provider"
                options={gateways.map((g) => ({ value: g.provider, label: g.name }))}
              />
            </Field>
            <Field label="对账日期" required>
              <TextInput name="stat_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
          </FieldGrid>
          <Field label="对账文件" required hint="上限 5MB">
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              style={{ fontSize: 13, fontFamily: "inherit" }}
            />
          </Field>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              取消
            </Button>
            <SubmitButton>开始对账</SubmitButton>
          </ModalFooter>
        </ActionForm>
      </Modal>
    </div>
  );
}

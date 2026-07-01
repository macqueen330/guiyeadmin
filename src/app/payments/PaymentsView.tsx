"use client";

import type { PaymentTxn, RefundRecord, PaymentMethod } from "@/lib/types";
import {
  PAYMENT_METHOD,
  PAY_STATUS,
  SETTLE_STATUS,
  REFUND_STATUS,
  fmtCurrency,
} from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const methodOptions = Object.entries(PAYMENT_METHOD).map(([value, t]) => ({ value, label: t.text }));
const payStatusOptions = Object.entries(PAY_STATUS).map(([value, t]) => ({ value, label: t.text }));

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

const paymentColumns: Column<PaymentTxn>[] = [
  {
    key: "txn",
    header: "支付流水号 / 订单号",
    render: (p) => (
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{p.txn_no}</span>
        <span style={{ fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{p.order_no}</span>
      </div>
    ),
  },
  {
    key: "method",
    header: "支付方式 / 商户号",
    render: (p) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
        <Chip tone={PAYMENT_METHOD[p.method]} />
        <span style={{ fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{p.merchant_no}</span>
      </div>
    ),
  },
  {
    key: "amount",
    header: "应付 / 实付",
    align: "right",
    render: (p) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
        <span style={{ fontSize: 11.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(p.amount_due)}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#16894f", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(p.amount_paid)}</span>
      </div>
    ),
  },
  {
    key: "fee",
    header: "手续费",
    align: "right",
    render: (p) => <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(p.fee)}</span>,
  },
  { key: "pay_status", header: "支付状态", align: "center", render: (p) => <StatusTag tone={PAY_STATUS[p.pay_status]} /> },
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
  { key: "settle", header: "对账状态", align: "center", render: (p) => <StatusTag tone={SETTLE_STATUS[p.settle_status]} /> },
  {
    key: "paid_at",
    header: "支付时间",
    render: (p) => <span style={{ color: "var(--muted)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{p.paid_at ?? "—"}</span>,
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
          {r.partial && <span style={{ marginLeft: 6, fontSize: 10, color: "#b45309", background: "#fff7ec", padding: "1px 6px", borderRadius: 5 }}>部分</span>}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{r.order_no}</span>
      </div>
    ),
  },
  {
    key: "origin",
    header: "原支付流水号",
    render: (r) => <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{r.origin_txn_no}</span>,
  },
  { key: "method", header: "方式", render: (r) => <Chip tone={PAYMENT_METHOD[r.method]} /> },
  {
    key: "amount",
    header: "申请 / 实退",
    align: "right",
    render: (r) => (
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {fmtCurrency(r.applied_amount)} / <b>{fmtCurrency(r.actual_amount)}</b>
      </span>
    ),
  },
  { key: "reason", header: "原因", render: (r) => <span style={{ color: "#4a514c" }}>{r.reason}</span> },
  { key: "status", header: "状态", align: "center", render: (r) => <StatusTag tone={REFUND_STATUS[r.status]} /> },
  {
    key: "operator",
    header: "操作人 / 时间",
    render: (r) => (
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
        <span style={{ fontSize: 12.5, color: "#2c322e" }}>{r.operator}</span>
        <span style={{ fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{r.applied_at}</span>
      </div>
    ),
  },
];

function Reconcile({ payments }: { payments: PaymentTxn[] }) {
  const agg = new Map<PaymentMethod, { count: number; due: number; paid: number; fee: number; refunded: number }>();
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

  const th: React.CSSProperties = { textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9a9f9a", padding: "10px 8px", borderBottom: "1px solid var(--line)" };
  const td: React.CSSProperties = { textAlign: "right", padding: "12px 8px", borderBottom: "1px solid var(--line)", fontSize: 12.5, fontVariantNumeric: "tabular-nums" };

  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>渠道对账</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>按支付渠道汇总 · 以平台对账文件为最终依据</span>
        </div>
        <Button variant="secondary" icon="download">
          导入对账文件
        </Button>
      </div>
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
                <Chip tone={PAYMENT_METHOD[method]} />
              </td>
              <td style={td}>{a.count}</td>
              <td style={td}>{fmtCurrency(a.due)}</td>
              <td style={{ ...td, fontWeight: 700, color: "#16894f" }}>{fmtCurrency(a.paid)}</td>
              <td style={{ ...td, color: "var(--muted)" }}>{fmtCurrency(a.fee)}</td>
              <td style={{ ...td, color: a.refunded > 0 ? "#c0392b" : "var(--muted)" }}>{fmtCurrency(a.refunded)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const CONFIG_STATUS: Record<string, { color: string; bg: string }> = {
  已配置: { color: "#16894f", bg: "#e9f5ef" },
  已启用: { color: "#16894f", bg: "#e9f5ef" },
  已通过: { color: "#16894f", bg: "#e9f5ef" },
  即将过期: { color: "#b45309", bg: "#fff7ec" },
  待启用: { color: "#6b716d", bg: "#f1f2f0" },
  待验证: { color: "#b45309", bg: "#fff7ec" },
  配置异常: { color: "#c0392b", bg: "#fdf0ef" },
};

function StatusPill({ text }: { text: string }) {
  const t = CONFIG_STATUS[text] ?? CONFIG_STATUS.待启用;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: t.color, background: t.bg, padding: "3px 10px", borderRadius: 20 }}>
      {text}
    </span>
  );
}

function ConfigCard({ title, rows }: { title: string; rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{title}</span>
      <div>
        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 0",
              borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line)",
            }}
          >
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{r.label}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PaymentConfig() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      <ConfigCard
        title="微信支付"
        rows={[
          { label: "商户号", value: "16018****01" },
          { label: "AppID", value: "wx****a1b2" },
          { label: "支付场景", value: "JSAPI · H5 · Native" },
          { label: "API 证书", value: <StatusPill text="已配置" /> },
          { label: "回调地址", value: "/api/pay/wx/notify" },
          { label: "状态", value: <StatusPill text="已启用" /> },
          { label: "测试", value: <StatusPill text="已通过" /> },
        ]}
      />
      <ConfigCard
        title="支付宝"
        rows={[
          { label: "应用 ID", value: "2021****8899" },
          { label: "商户账号", value: "pay@guiye.com" },
          { label: "支付产品", value: "电脑 / 手机 / 当面付" },
          { label: "密钥", value: <StatusPill text="已配置" /> },
          { label: "回调地址", value: "/api/pay/ali/notify" },
          { label: "状态", value: <StatusPill text="已启用" /> },
          { label: "测试", value: <StatusPill text="已通过" /> },
        ]}
      />
      <ConfigCard
        title="银联"
        rows={[
          { label: "商户号", value: "8985****0071" },
          { label: "产品类型", value: "在线 / 二维码 / 云闪付" },
          { label: "证书", value: <StatusPill text="即将过期" /> },
          { label: "前台通知", value: "/api/pay/up/front" },
          { label: "后台通知", value: "/api/pay/up/back" },
          { label: "对账文件", value: "每日 10:00" },
          { label: "状态", value: <StatusPill text="待启用" /> },
          { label: "测试", value: <StatusPill text="待验证" /> },
        ]}
      />
    </div>
  );
}

export function PaymentsView({
  payments,
  refunds,
  view,
}: {
  payments: PaymentTxn[];
  refunds: RefundRecord[];
  view: string;
}) {
  if (view === "config") return <PaymentConfig />;
  if (view === "reconcile") return <Reconcile payments={payments} />;

  if (view === "refunds") {
    return (
      <FilterableTable
        rows={refunds}
        columns={refundColumns}
        filters={[{ key: "method", label: "方式", options: methodOptions, match: (r, v) => r.method === v }]}
        searchText={(r) => `${r.refund_no} ${r.order_no} ${r.origin_txn_no} ${r.reason}`}
        searchPlaceholder="搜索退款单 / 订单号 / 流水号"
        empty="暂无退款记录"
        rightAction={<Button variant="secondary" icon="download">导出退款</Button>}
      />
    );
  }

  // flow / exception
  const isException = view === "exception";
  const rows = isException
    ? payments.filter(
        (p) => p.pay_status === "pay_exception" || p.pay_status === "failed" || p.settle_status === "settle_exception",
      )
    : payments;

  const filters: FilterDef<PaymentTxn>[] = isException
    ? []
    : [
        { key: "pay_status", label: "支付状态", options: payStatusOptions, match: (p, v) => p.pay_status === v },
        { key: "method", label: "方式", options: methodOptions, match: (p, v) => p.method === v },
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
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#c0392b", marginRight: 4 }}>常见异常类型</span>
          {EXCEPTION_TYPES.map((t) => (
            <span key={t} style={{ fontSize: 11.5, fontWeight: 600, color: "#a03227", background: "var(--card)", border: "1px solid #f0cfca", padding: "3px 9px", borderRadius: 6 }}>
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
        rightAction={<Button variant="secondary" icon="download">导出流水</Button>}
      />
    </div>
  );
}

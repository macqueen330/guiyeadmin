import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNo, getOrderItems, getPayments, getRefunds } from "@/lib/data/queries";
import {
  ORDER_TYPE,
  ORDER_CHANNEL,
  CUSTOMER_SOURCE,
  PAYMENT_METHOD,
  PAY_STATUS,
  FULFILL_STATUS,
  SETTLE_STATUS,
  REFUND_STATUS,
  fmtCurrency,
  fmtNumber,
} from "@/lib/tokens";
import { Card } from "@/components/ui/Card";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import type { FulfillStatus } from "@/lib/types";

// 履约流转（与支付、结算相互独立）。
const FULFILL_FLOW: { key: FulfillStatus; label: string }[] = [
  { key: "assign", label: "待分配仓库" },
  { key: "prep", label: "备货中" },
  { key: "wait_ship", label: "待发货" },
  { key: "shipped", label: "已发货" },
  { key: "signed", label: "已签收" },
];

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  color: "#9a9f9a",
  padding: "10px 8px",
  borderBottom: "1px solid var(--line)",
};
const td: React.CSSProperties = {
  padding: "11px 8px",
  borderBottom: "1px solid var(--line)",
  fontSize: 12.5,
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 0" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ no: string }>;
}) {
  const { no } = await params;
  const order = await getOrderByNo("#" + no);
  if (!order) notFound();

  const [items, payments, refunds] = await Promise.all([
    getOrderItems(order.id),
    getPayments(),
    getRefunds(),
  ]);
  const txn = payments.find((p) => p.order_no === order.order_no) ?? null;
  const orderRefunds = refunds.filter((r) => r.order_no === order.order_no);
  const refundedTotal = txn?.refunded ?? orderRefunds.reduce((s, r) => s + r.actual_amount, 0);

  const itemsTotal = items.reduce((s, i) => s + i.qty * i.price, 0) || order.amount;
  const netReceived = order.amount_received - refundedTotal;

  const flowIdx = FULFILL_FLOW.findIndex((f) => f.key === order.fulfill_status);
  const isFulfillException = order.fulfill_status === "fulfill_exception";

  return (
    <>
      <Link
        href="/orders"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", marginBottom: 14 }}
      >
        <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
        返回订单列表
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", fontVariantNumeric: "tabular-nums" }}>
          {order.order_no}
        </h2>
        <Chip tone={ORDER_TYPE[order.order_type]} />
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 4 }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>支付</span>
          <StatusTag tone={PAY_STATUS[order.pay_status]} />
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>履约</span>
          <StatusTag tone={FULFILL_STATUS[order.fulfill_status]} />
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>结算</span>
          <StatusTag tone={SETTLE_STATUS[order.settle_status]} />
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>
          下单时间 {order.created_at.slice(0, 10)} {order.created_at.slice(11, 16)}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card padding="18px 22px">
            <span style={{ fontSize: 15, fontWeight: 700 }}>商品明细</span>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
              <thead>
                <tr>
                  <th style={th}>商品</th>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign: "center" }}>数量</th>
                  <th style={{ ...th, textAlign: "right" }}>单价</th>
                  <th style={{ ...th, textAlign: "right" }}>小计</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "24px 8px" }}>
                      该订单明细未同步（示例数据）
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id}>
                      <td style={{ ...td, fontWeight: 600, color: "#2c322e" }}>{it.product_name}</td>
                      <td style={{ ...td, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{it.sku_code}</td>
                      <td style={{ ...td, textAlign: "center" }}>{it.qty}</td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(it.price)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {fmtCurrency(it.qty * it.price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>

          <Card padding="18px 22px">
            <span style={{ fontSize: 15, fontWeight: 700 }}>金额</span>
            <div style={{ marginTop: 8 }}>
              <InfoRow label="商品合计" value={fmtCurrency(itemsTotal)} />
              <InfoRow label="应付金额" value={fmtCurrency(order.amount)} />
              <InfoRow label="实付金额" value={<span style={{ color: "#16894f" }}>{fmtCurrency(order.amount_received)}</span>} />
              <InfoRow
                label="已退款"
                value={<span style={{ color: refundedTotal > 0 ? "#c0392b" : "var(--muted)" }}>{refundedTotal > 0 ? "-" : ""}{fmtCurrency(refundedTotal)}</span>}
              />
              <div style={{ height: 1, background: "var(--line)", margin: "6px 0" }} />
              <InfoRow
                label="净实收"
                value={
                  <span style={{ color: netReceived < order.amount ? "#c0392b" : "#16894f", fontWeight: 800, fontSize: 15 }}>
                    {fmtCurrency(netReceived)}
                  </span>
                }
              />
            </div>
          </Card>

          {orderRefunds.length > 0 && (
            <Card padding="18px 22px">
              <span style={{ fontSize: 15, fontWeight: 700 }}>退款记录</span>
              <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                共 {orderRefunds.length} 笔 · 累计 {fmtCurrency(refundedTotal)}（不超过原交易）
              </span>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
                <thead>
                  <tr>
                    <th style={th}>退款流水号</th>
                    <th style={{ ...th, textAlign: "right" }}>申请 / 实退</th>
                    <th style={th}>原因</th>
                    <th style={{ ...th, textAlign: "center" }}>状态</th>
                    <th style={th}>操作人</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRefunds.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>
                        {r.refund_no}
                        {r.partial && <span style={{ marginLeft: 6, fontSize: 10, color: "#b45309", background: "#fff7ec", padding: "1px 6px", borderRadius: 5 }}>部分</span>}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {fmtCurrency(r.applied_amount)} / <b>{fmtCurrency(r.actual_amount)}</b>
                      </td>
                      <td style={{ ...td, color: "#4a514c" }}>{r.reason}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <StatusTag tone={REFUND_STATUS[r.status]} />
                      </td>
                      <td style={{ ...td, color: "var(--muted)" }}>{r.operator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card padding="18px 22px">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>支付信息</span>
              <StatusTag tone={PAY_STATUS[order.pay_status]} />
            </div>
            <div style={{ marginTop: 8 }}>
              <InfoRow label="支付方式" value={PAYMENT_METHOD[order.payment_method].text} />
              {txn ? (
                <>
                  <InfoRow label="应付金额" value={fmtCurrency(txn.amount_due)} />
                  <InfoRow label="实付金额" value={<span style={{ color: "#16894f" }}>{fmtCurrency(txn.amount_paid)}</span>} />
                  <InfoRow label="手续费" value={fmtCurrency(txn.fee)} />
                  <InfoRow label="支付时间" value={txn.paid_at ?? "—"} />
                  <InfoRow label="支付流水号" value={<span style={{ fontVariantNumeric: "tabular-nums" }}>{txn.txn_no}</span>} />
                  <InfoRow label="商户订单号" value={<span style={{ fontVariantNumeric: "tabular-nums" }}>{order.order_no.replace("#", "")}</span>} />
                  <InfoRow
                    label="到账状态"
                    value={<span style={{ color: txn.arrived ? "#16894f" : "#b45309" }}>{txn.arrived ? "已到账" : "未到账"}</span>}
                  />
                  <InfoRow label="对账状态" value={<StatusTag tone={SETTLE_STATUS[txn.settle_status]} />} />
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 0", lineHeight: 1.6 }}>
                  {order.payment_method === "credit_term"
                    ? "账期结算，无即时支付流水；回款以银行到账为准。"
                    : "线下 / 内部单据，无平台支付流水。"}
                </div>
              )}
            </div>
          </Card>

          <Card padding="18px 22px">
            <span style={{ fontSize: 15, fontWeight: 700 }}>订单信息</span>
            <div style={{ marginTop: 8 }}>
              <InfoRow label="客户" value={order.customer_name} />
              <InfoRow label="国家 / 地区" value={order.country} />
              <InfoRow label="订单类型" value={ORDER_TYPE[order.order_type].text} />
              <InfoRow label="下单渠道" value={ORDER_CHANNEL[order.order_channel].text} />
              <InfoRow label="客户来源" value={CUSTOMER_SOURCE[order.customer_source].text} />
              <InfoRow label="发货方" value={order.ship_from} />
            </div>
          </Card>

          <Card padding="18px 22px">
            <span style={{ fontSize: 15, fontWeight: 700 }}>履约流转</span>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
              {isFulfillException ? (
                <div style={{ fontSize: 12.5, color: "#c0392b", fontWeight: 600 }}>
                  包裹异常 · 已进入异常处理流程
                </div>
              ) : (
                FULFILL_FLOW.map((f, i) => {
                  const done = flowIdx >= 0 && i <= flowIdx;
                  const current = i === flowIdx;
                  return (
                    <div key={f.key} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: done ? "var(--accent)" : "var(--bg)",
                            border: done ? "none" : "1px solid var(--line)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: "none",
                          }}
                        >
                          {done && <Icon name="check" size={11} color="#fff" strokeWidth={3} />}
                        </span>
                        {i < FULFILL_FLOW.length - 1 && (
                          <span style={{ width: 2, height: 22, background: done ? "var(--accent)" : "var(--line)" }} />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: current ? 700 : 500,
                          color: current ? "var(--ink)" : done ? "#4a514c" : "var(--muted)",
                          paddingTop: 1,
                        }}
                      >
                        {f.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card padding="16px 20px" style={{ background: "var(--accent-soft)", border: "none" }}>
            <span style={{ fontSize: 12.5, color: "var(--accent-strong)", fontWeight: 600 }}>
              本订单含 {fmtNumber(items.reduce((s, i) => s + i.qty, 0) || 1)} 件商品，发自「{order.ship_from}」
            </span>
          </Card>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNo, getOrderItems } from "@/lib/data/queries";
import { ORDER_SOURCE, ORDER_STATUS, fmtCurrency, fmtNumber } from "@/lib/tokens";
import { Card } from "@/components/ui/Card";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import type { OrderStatus } from "@/lib/types";

const FLOW: { key: OrderStatus; label: string }[] = [
  { key: "review", label: "支付 / 审核" },
  { key: "assign", label: "匹配库存" },
  { key: "prep", label: "备货中" },
  { key: "shipped", label: "已发货" },
  { key: "signed", label: "已签收" },
  { key: "settled", label: "已结算" },
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e" }}>{value}</span>
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

  const items = await getOrderItems(order.id);
  const itemsTotal = items.reduce((s, i) => s + i.qty * i.price, 0) || order.amount;
  const due = order.amount - order.amount_received;

  const flowIdx = FLOW.findIndex((f) => f.key === order.status);
  const isRefund = order.status === "refund";

  return (
    <>
      <Link
        href="/orders"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", marginBottom: 14 }}
      >
        <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
        返回订单列表
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", fontVariantNumeric: "tabular-nums" }}>
          {order.order_no}
        </h2>
        <StatusTag tone={ORDER_STATUS[order.status]} />
        <Chip tone={ORDER_SOURCE[order.source]} />
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
              <InfoRow label="应收金额" value={fmtCurrency(order.amount)} />
              <InfoRow
                label="实收金额"
                value={<span style={{ color: "#16894f" }}>{fmtCurrency(order.amount_received)}</span>}
              />
              <div style={{ height: 1, background: "var(--line)", margin: "6px 0" }} />
              <InfoRow
                label={isRefund ? "已退款" : "待收余额"}
                value={
                  <span style={{ color: due > 0 || isRefund ? "#c0392b" : "var(--muted)", fontWeight: 800, fontSize: 15 }}>
                    {fmtCurrency(isRefund ? order.amount : due)}
                  </span>
                }
              />
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card padding="18px 22px">
            <span style={{ fontSize: 15, fontWeight: 700 }}>客户信息</span>
            <div style={{ marginTop: 8 }}>
              <InfoRow label="客户" value={order.customer_name} />
              <InfoRow label="国家 / 地区" value={order.country} />
              <InfoRow label="下单渠道" value={ORDER_SOURCE[order.source].text} />
              <InfoRow label="发货方" value={order.ship_from} />
            </div>
          </Card>

          <Card padding="18px 22px">
            <span style={{ fontSize: 15, fontWeight: 700 }}>状态流转</span>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
              {isRefund ? (
                <div style={{ fontSize: 12.5, color: "#c0392b", fontWeight: 600 }}>
                  订单已退款 · 进入售后流程
                </div>
              ) : (
                FLOW.map((f, i) => {
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
                        {i < FLOW.length - 1 && (
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

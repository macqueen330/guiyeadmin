import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOrderByNo,
  getOrderEvents,
  getOrderItems,
  getPayments,
  getRefunds,
  getWarehouses,
} from "@/lib/data/queries";
import { loadDict } from "@/lib/data/dict";
import { dictLabel, dictTone } from "@/lib/dict";
import { fmtCurrency, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/tokens";
import { Card } from "@/components/ui/Card";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import { requireModule } from "@/lib/auth/context";
import { OrderActions } from "./OrderActions";
import type { FulfillStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// 履约流转（与支付、结算相互独立）。标签取自字典，与列表页的「待分配」保持一致
// —— 原来这里叫「待分配仓库」，tokens.ts 里叫「待分配」，同一状态两个名字。
const FULFILL_FLOW: FulfillStatus[] = ["assign", "prep", "wait_ship", "shipped", "signed"];

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "7px 0",
      }}
    >
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ no: string }> }) {
  await requireModule("orders");

  const { no } = await params;
  // 订单号不再带 "#" 前缀（由数据库序列生成，形如 GY-260821-00001）。
  const order = await getOrderByNo(decodeURIComponent(no));
  if (!order) notFound();

  const [items, payments, refunds, events, warehouses, dict] = await Promise.all([
    getOrderItems(order.id),
    getPayments(),
    getRefunds(),
    getOrderEvents(order.id),
    getWarehouses(),
    loadDict(),
  ]);

  const txn = payments.find((p) => p.order_no === order.order_no) ?? null;
  const orderRefunds = refunds.filter((r) => r.order_no === order.order_no);
  const refundedTotal =
    txn?.refunded ??
    orderRefunds
      .filter((r) => ["success", "reconciled"].includes(r.status))
      .reduce((s, r) => s + r.actual_amount, 0);

  const itemsTotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const netReceived = order.amount_received - refundedTotal;

  const flowIdx = FULFILL_FLOW.indexOf(order.fulfill_status);
  const isFulfillException = order.fulfill_status === "fulfill_exception";

  return (
    <>
      <Link
        href="/orders"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--muted)",
          marginBottom: 14,
        }}
      >
        <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
        返回订单列表
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-.5px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {order.order_no}
        </h2>
        <Chip tone={dictTone(dict, "order_type", order.order_type)} />
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>支付</span>
          <StatusTag tone={dictTone(dict, "pay_status", order.pay_status)} />
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>履约</span>
          <StatusTag tone={dictTone(dict, "fulfill_status", order.fulfill_status)} />
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>结算</span>
          <StatusTag tone={dictTone(dict, "settle_status", order.settle_status)} />
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>
          下单时间 {fmtDateTime(order.created_at)}
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
                    <td
                      colSpan={5}
                      style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "24px 8px" }}
                    >
                      该订单还没有明细行
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id}>
                      <td style={{ ...td, fontWeight: 600, color: "#2c322e" }}>{it.product_name}</td>
                      <td style={{ ...td, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                        {it.sku_code}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{it.qty}</td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(it.price)}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmtMoney(it.qty * it.price)}
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
              <InfoRow label="商品合计" value={fmtMoney(itemsTotal)} />
              {order.freight_fee > 0 && <InfoRow label="运费" value={fmtMoney(order.freight_fee)} />}
              {order.discount > 0 && (
                <InfoRow label="优惠" value={<span style={{ color: "#c0392b" }}>-{fmtMoney(order.discount)}</span>} />
              )}
              <InfoRow label="应付金额" value={fmtMoney(order.amount)} />
              <InfoRow
                label="实付金额"
                value={<span style={{ color: "#16894f" }}>{fmtMoney(order.amount_received)}</span>}
              />
              <InfoRow
                label="已退款"
                value={
                  <span style={{ color: refundedTotal > 0 ? "#c0392b" : "var(--muted)" }}>
                    {refundedTotal > 0 ? "-" : ""}
                    {fmtMoney(refundedTotal)}
                  </span>
                }
              />
              <div style={{ height: 1, background: "var(--line)", margin: "6px 0" }} />
              <InfoRow
                label="净实收"
                value={
                  <span
                    style={{
                      color: netReceived < order.amount ? "#c0392b" : "#16894f",
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    {fmtMoney(netReceived)}
                  </span>
                }
              />
              {items.length > 0 && Math.abs(itemsTotal + order.freight_fee - order.discount - order.amount) > 0.01 && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11.5,
                    color: "#b45309",
                    background: "#fff7ec",
                    padding: "7px 10px",
                    borderRadius: 8,
                  }}
                >
                  明细合计与应付金额不一致，请核对是否有人工调价。
                </div>
              )}
            </div>
          </Card>

          {orderRefunds.length > 0 && (
            <Card padding="18px 22px">
              <span style={{ fontSize: 15, fontWeight: 700 }}>退款记录</span>
              <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                共 {orderRefunds.length} 笔 · 累计 {fmtMoney(refundedTotal)}（不超过原交易）
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
                      </td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(r.applied_amount)} / <b>{fmtMoney(r.actual_amount)}</b>
                      </td>
                      <td style={{ ...td, color: "#4a514c" }}>{r.reason}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <StatusTag tone={dictTone(dict, "refund_status", r.status)} />
                      </td>
                      <td style={{ ...td, color: "var(--muted)" }}>{r.operator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* 操作时间轴：真实的 order_events，含状态变更与人工备注 */}
          <Card padding="18px 22px">
            <span style={{ fontSize: 15, fontWeight: 700 }}>操作记录</span>
            {events.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "14px 0" }}>暂无操作记录</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 10 }}>
                {events
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <div
                      key={e.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: "9px 0",
                        borderBottom: i < events.length - 1 ? "1px solid var(--line)" : "none",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          marginTop: 6,
                          flex: "none",
                        }}
                      />
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 12.5, color: "#2c322e" }}>
                          {e.field
                            ? `${dictLabel(dict, e.field, e.from_value, e.from_value ?? "—")} → ${dictLabel(
                                dict,
                                e.field,
                                e.to_value,
                                e.to_value ?? "—",
                              )}`
                            : (e.note ?? e.event_type)}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {e.operator_name ?? "系统"} · {fmtDateTime(e.created_at)}
                          {e.field && e.note ? ` · ${e.note}` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <OrderActions
            order={order}
            items={items}
            warehouses={warehouses.filter((w) => w.is_active).map((w) => ({ id: w.id, name: w.name }))}
          />

          <Card padding="18px 22px">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>支付信息</span>
              <StatusTag tone={dictTone(dict, "pay_status", order.pay_status)} />
            </div>
            <div style={{ marginTop: 8 }}>
              <InfoRow label="支付方式" value={dictLabel(dict, "payment_method", order.payment_method)} />
              {txn ? (
                <>
                  <InfoRow label="应付金额" value={fmtMoney(txn.amount_due)} />
                  <InfoRow
                    label="实付金额"
                    value={<span style={{ color: "#16894f" }}>{fmtMoney(txn.amount_paid)}</span>}
                  />
                  {/* 手续费用 2 位小数：整数化会让 1.13 显示成 ¥1，明细与合计对不上 */}
                  <InfoRow label="手续费" value={fmtCurrency(txn.fee, { decimals: 2 })} />
                  <InfoRow label="支付时间" value={fmtDateTime(txn.paid_at)} />
                  <InfoRow
                    label="支付流水号"
                    value={<span style={{ fontVariantNumeric: "tabular-nums" }}>{txn.txn_no}</span>}
                  />
                  <InfoRow
                    label="商户订单号"
                    value={<span style={{ fontVariantNumeric: "tabular-nums" }}>{order.order_no}</span>}
                  />
                  <InfoRow
                    label="到账状态"
                    value={
                      <span style={{ color: txn.arrived ? "#16894f" : "#b45309" }}>
                        {txn.arrived ? "已到账" : "未到账"}
                      </span>
                    }
                  />
                  <InfoRow
                    label="对账状态"
                    value={<StatusTag tone={dictTone(dict, "settle_status", txn.settle_status)} />}
                  />
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 0", lineHeight: 1.6 }}>
                  {order.payment_method === "credit_term"
                    ? "账期结算，无即时支付流水；回款以银行到账为准。"
                    : "尚无平台支付流水。线下 / 内部单据由财务人工确认。"}
                </div>
              )}
            </div>
          </Card>

          <Card padding="18px 22px">
            <span style={{ fontSize: 15, fontWeight: 700 }}>订单信息</span>
            <div style={{ marginTop: 8 }}>
              <InfoRow label="客户" value={order.customer_name} />
              <InfoRow
                label="国家 / 地区"
                value={order.province ? `${order.country} · ${order.province}` : order.country}
              />
              {order.address && <InfoRow label="收货地址" value={order.address} />}
              {order.contact_phone && <InfoRow label="联系电话" value={order.contact_phone} />}
              <InfoRow label="订单类型" value={dictLabel(dict, "order_type", order.order_type)} />
              <InfoRow label="下单渠道" value={dictLabel(dict, "order_channel", order.order_channel)} />
              <InfoRow label="客户来源" value={dictLabel(dict, "customer_source", order.customer_source)} />
              <InfoRow label="发货方" value={order.ship_from || "未分配"} />
              {order.remark && <InfoRow label="备注" value={order.remark} />}
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
                FULFILL_FLOW.map((key, i) => {
                  const done = flowIdx >= 0 && i <= flowIdx;
                  const current = i === flowIdx;
                  return (
                    <div key={key} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
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
                          <span
                            style={{ width: 2, height: 22, background: done ? "var(--accent)" : "var(--line)" }}
                          />
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
                        {dictLabel(dict, "fulfill_status", key)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {itemCount > 0 && (
            <Card padding="16px 20px" style={{ background: "var(--accent-soft)", border: "none" }}>
              <span style={{ fontSize: 12.5, color: "var(--accent-strong)", fontWeight: 600 }}>
                本订单含 {fmtNumber(itemCount)} 件商品
                {order.ship_from ? `，发自「${order.ship_from}」` : "，尚未分配发货仓"}
              </span>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

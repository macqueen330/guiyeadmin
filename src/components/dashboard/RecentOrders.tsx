import Link from "next/link";
import type { Order } from "@/lib/types";
import { ORDER_SOURCE, ORDER_STATUS, avatarTone, fmtCurrency } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";

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

export function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 22px 8px",
        marginTop: 16,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>最近订单</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>来自全部渠道的最新交易</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/orders"
            className="hoverable"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
              color: "#3a403c",
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            <Icon name="filter" size={13} />
            筛选
          </Link>
          <Link
            href="/orders"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--accent)",
              background: "var(--accent-soft)",
              border: "none",
              borderRadius: 8,
              padding: "7px 14px",
              cursor: "pointer",
            }}
          >
            查看全部
          </Link>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>订单号</th>
            <th style={th}>客户 / 国家</th>
            <th style={th}>来源</th>
            <th style={th}>发货方</th>
            <th style={{ ...th, textAlign: "right" }}>金额</th>
            <th style={{ ...th, textAlign: "center" }}>状态</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const av = avatarTone(i);
            return (
              <tr key={o.id} className="row-hover">
                <td style={{ ...td, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  <Link href={`/orders/${o.order_no.replace("#", "")}`} style={{ color: "inherit" }}>
                    {o.order_no}
                  </Link>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: av.bg,
                        color: av.color,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        flex: "none",
                      }}
                    >
                      {o.customer_name[0]}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
                      <span style={{ fontWeight: 600, color: "#2c322e" }}>{o.customer_name}</span>
                      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{o.country}</span>
                    </div>
                  </div>
                </td>
                <td style={td}>
                  <Chip tone={ORDER_SOURCE[o.source]} />
                </td>
                <td style={{ ...td, color: "#4a514c" }}>{o.ship_from}</td>
                <td style={{ ...td, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {fmtCurrency(o.amount)}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <StatusTag tone={ORDER_STATUS[o.status]} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

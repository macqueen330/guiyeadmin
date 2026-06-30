import { productRanking } from "@/lib/mock/data";
import { fmtCurrency, fmtNumber } from "@/lib/tokens";

const rankC = [
  { bg: "var(--accent-soft)", color: "var(--accent)" },
  { bg: "#fff5ec", color: "#c2703d" },
  { bg: "#fdf6e8", color: "#b07d18" },
  { bg: "#f1f2f0", color: "#6b716d" },
  { bg: "#f1f2f0", color: "#6b716d" },
  { bg: "#f1f2f0", color: "#6b716d" },
];

function barColor(i: number) {
  return i === 0 ? "var(--accent)" : i === 1 ? "#c2703d" : i === 2 ? "#e0a44a" : "#cdd2cb";
}

// 产品销售排行 — replaces the old "销售额·渠道" panel, which duplicated the donut.
// More useful for product direction: 销售额 / 销量 / 订单数 / 占比 / 环比.
export function ProductRanking({ limit }: { limit?: number }) {
  const rows = limit ? productRanking.slice(0, limit) : productRanking;
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>产品销售排行</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>按销售额排序 · 含销量 / 订单 / 环比</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        {rows.map((p, i) => (
          <div key={p.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: rankC[i]?.bg ?? "#f1f2f0",
                  color: rankC[i]?.color ?? "#6b716d",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10.5,
                  fontWeight: 800,
                  flex: "none",
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#2c322e",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.name}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, flex: "none", fontVariantNumeric: "tabular-nums" }}>
                {fmtCurrency(p.revenue)}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 5, background: "var(--bg)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 5, background: barColor(i), width: p.pct + "%" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--muted)" }}>
              <span>销量 {fmtNumber(p.units)}</span>
              <span>·</span>
              <span>订单 {fmtNumber(p.orders)}</span>
              <span style={{ marginLeft: "auto", fontWeight: 600, color: p.growth >= 0 ? "#16894f" : "#c0392b" }}>
                环比 {p.growth >= 0 ? "+" : ""}
                {p.growth}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { fmtNumber } from "@/lib/tokens";
import type { TopSku as TopSkuRow } from "@/lib/types";

// 热销 SKU。销量与条宽都由当月订单明细实时汇总（pct 相对榜首派生，不入库）。

const RANK_TONES = [
  { bg: "var(--accent-soft)", color: "var(--accent)" },
  { bg: "#fff5ec", color: "#c2703d" },
  { bg: "#fdf6e8", color: "#b07d18" },
  { bg: "#f1f2f0", color: "#6b716d" },
];

// 第 6 行以后回落到灰色，不再越界读 rankC[i]（原来会直接抛错）。
function rankTone(i: number) {
  return RANK_TONES[i] ?? RANK_TONES[RANK_TONES.length - 1];
}

function barColor(i: number) {
  return i === 0 ? "var(--accent)" : i === 1 ? "#c2703d" : i === 2 ? "#e0a44a" : "#cdd2cb";
}

export function TopSku({ rows }: { rows: TopSkuRow[] }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700 }}>热销 SKU</span>
        <Link
          href="/analytics?view=product"
          className="link-underline"
          style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600 }}
        >
          全部 →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "26px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
          本月还没有成交明细
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 12 }}>
          {rows.map((p, i) => {
            const tone = rankTone(i);
            return (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: tone.bg,
                      color: tone.color,
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
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, flex: "none" }}>
                    {fmtNumber(p.units)}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 5, background: "var(--bg)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 5,
                      background: barColor(i),
                      width: `${Math.max(0, Math.min(100, p.pct))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

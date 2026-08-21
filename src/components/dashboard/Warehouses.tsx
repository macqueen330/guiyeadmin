import Link from "next/link";
import { fmtNumber } from "@/lib/tokens";
import type { WarehouseStock } from "@/lib/types";

// 多仓库存。数据来自 inventory_view 按仓库聚合（src/lib/data/metrics.ts），
// 与库存页同源 —— 原来物流页读纯 mock、库存页读数据库，同一个「苏州仓」两页数字不同。

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

export function Warehouses({ rows }: { rows: WarehouseStock[] }) {
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
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700 }}>多仓库存</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--muted)" }}>
          <LegendDot color="var(--accent)" label="可售" />
          <LegendDot color="#e0a44a" label="锁定" />
          <LegendDot color="#cdd2cb" label="在途" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "26px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
          还没有仓库或库存数据
          <div style={{ marginTop: 6 }}>
            <Link href="/inventory?view=stock" style={{ color: "var(--accent)", fontWeight: 600 }}>
              去库存管理 →
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 14 }}>
          {rows.map((w) => {
            const total = w.sellable + w.locked + w.transit;
            // 总量为 0 时不再输出 "NaN%"。
            const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) + "%" : "0%");
            return (
              <div key={w.id} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{w.name}</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      color: "var(--muted)",
                      background: "var(--bg)",
                      padding: "1px 7px",
                      borderRadius: 5,
                    }}
                  >
                    {w.code}
                  </span>
                  {w.low > 0 && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "#c0392b",
                        background: "#fdf0ef",
                        padding: "1px 7px",
                        borderRadius: 5,
                      }}
                    >
                      {w.low} 个低库存
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700 }}>
                    {fmtNumber(w.sellable)}
                  </span>
                </div>
                <div
                  style={{
                    height: 7,
                    borderRadius: 6,
                    background: "var(--bg)",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <span style={{ background: "var(--accent)", width: pct(w.sellable) }} />
                  <span style={{ background: "#e0a44a", width: pct(w.locked) }} />
                  <span style={{ background: "#cdd2cb", width: pct(w.transit) }} />
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: "var(--muted)" }}>
                  <span>可售 {fmtNumber(w.sellable)}</span>
                  <span>锁定 {fmtNumber(w.locked)}</span>
                  <span>在途 {fmtNumber(w.transit)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

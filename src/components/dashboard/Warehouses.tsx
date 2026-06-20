import { warehouseStock } from "@/lib/mock/data";

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

export function Warehouses() {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>多仓库存</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--muted)" }}>
          <LegendDot color="var(--accent)" label="可售" />
          <LegendDot color="#e0a44a" label="锁定" />
          <LegendDot color="#cdd2cb" label="在途" />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 14 }}>
        {warehouseStock.map((w) => {
          const total = w.sellable + w.locked + w.transit;
          const pct = (n: number) => ((n / total) * 100).toFixed(1) + "%";
          return (
            <div key={w.name} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{w.name}</span>
                <span style={{ fontSize: 10.5, color: "var(--muted)", background: "var(--bg)", padding: "1px 7px", borderRadius: 5 }}>
                  {w.code}
                </span>
                {w.low > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "#c0392b", background: "#fdf0ef", padding: "1px 7px", borderRadius: 5 }}>
                    {w.low} SKU预警
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {total.toLocaleString("en-US")}
                </span>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "var(--bg)" }}>
                <div style={{ background: "var(--accent)", width: pct(w.sellable) }} />
                <div style={{ background: "#e0a44a", width: pct(w.locked) }} />
                <div style={{ background: "#cdd2cb", width: pct(w.transit) }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

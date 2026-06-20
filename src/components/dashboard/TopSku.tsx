import { topSku } from "@/lib/mock/data";

const rankC = [
  { bg: "var(--accent-soft)", color: "var(--accent)" },
  { bg: "#fff5ec", color: "#c2703d" },
  { bg: "#fdf6e8", color: "#b07d18" },
  { bg: "#f1f2f0", color: "#6b716d" },
  { bg: "#f1f2f0", color: "#6b716d" },
];

function barColor(i: number) {
  return i === 0 ? "var(--accent)" : i === 1 ? "#c2703d" : i === 2 ? "#e0a44a" : "#cdd2cb";
}

export function TopSku() {
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
        <span style={{ fontSize: 15, fontWeight: 700 }}>热销 SKU</span>
        <span className="link-underline" style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}>
          全部 →
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 12 }}>
        {topSku.map((p, i) => (
          <div key={p.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: rankC[i].bg,
                  color: rankC[i].color,
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
                {p.units.toLocaleString("en-US")}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 5, background: "var(--bg)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 5, background: barColor(i), width: p.pct + "%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

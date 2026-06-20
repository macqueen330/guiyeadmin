import { buildSpark, genSeries } from "@/lib/charts";
import { Icon, type IconName } from "@/components/ui/Icon";
import { kpis } from "@/lib/mock/data";

const sparks = [
  buildSpark(genSeries("sales", 16)),
  buildSpark(genSeries("orders", 16)),
  buildSpark([9, 7, 11, 6, 8, 5, 7, 4, 6, 5, 7, 4, 5, 3, 4, 3]),
  buildSpark(genSeries("received", 16)),
];
const icons: IconName[] = ["dollar", "bag", "refund", "barChart"];
const iconColor = ["var(--accent)", "#c2703d", "#c0392b", "#2b6cb0"];
const iconBg = ["var(--accent-soft)", "#fff5ec", "#fdf0ef", "#eef4ff"];

export function KpiRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
      {kpis.map((k, i) => (
        <div
          key={k.label}
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "17px 18px 13px",
            display: "flex",
            flexDirection: "column",
            gap: 11,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>{k.label}</span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: iconBg[i],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={icons[i]} size={14} color={iconColor[i]} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1 }}>
                {k.value}
              </span>
              <span
                className="kpi-sub"
                style={{ fontSize: 11.5, color: "var(--muted)" }}
                dangerouslySetInnerHTML={{ __html: k.sub }}
              />
            </div>
            <svg width="74" height="34" viewBox="0 0 74 34" preserveAspectRatio="none" style={{ flex: "none" }}>
              <path d={sparks[i]} fill="none" stroke={iconColor[i]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 11.5,
              fontWeight: 600,
              color: "#16894f",
            }}
          >
            <Icon name={k.deltaDir === "up" ? "chevronUp" : "caretDown"} size={12} strokeWidth={2.6} />
            {k.delta} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{k.deltaLabel}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

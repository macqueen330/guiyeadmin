import { buildSpark } from "@/lib/charts";
import { Icon, type IconName } from "@/components/ui/Icon";
import { fmtCurrency, fmtNumber, fmtPercent } from "@/lib/tokens";
import type { Kpi } from "@/lib/types";

// 经营 KPI。数据来自 src/lib/data/metrics.ts getKpis()（真实聚合），
// 迷你趋势线来自同一次查询的日序列 —— 不再是 genSeries() 的伪随机数，
// 也不再用 dangerouslySetInnerHTML 渲染带 <b> 的预格式化字符串。

const ICONS: Record<string, IconName> = {
  gmv: "dollar",
  orders: "bag",
  refund: "refund",
  aov: "barChart",
};

const TONE: Record<Kpi["tone"], { color: string; bg: string }> = {
  accent: { color: "var(--accent)", bg: "var(--accent-soft)" },
  clay: { color: "#c2703d", bg: "#fff5ec" },
  red: { color: "#c0392b", bg: "#fdf0ef" },
  blue: { color: "#2b6cb0", bg: "#eef4ff" },
};

function format(value: number, kind: Kpi["format"]): string {
  if (kind === "currency") return fmtCurrency(value);
  if (kind === "percent") return fmtPercent(value);
  return fmtNumber(value);
}

export function KpiRow({ kpis }: { kpis: Kpi[] }) {
  if (kpis.length === 0) {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "26px 20px",
          textAlign: "center",
          fontSize: 12.5,
          color: "var(--muted)",
        }}
      >
        本月还没有订单数据，指标将在第一笔订单产生后自动计算。
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(4, kpis.length)},minmax(0,1fr))`,
        gap: 16,
      }}
    >
      {kpis.map((k) => {
        const tone = TONE[k.tone];
        const spark = buildSpark(k.spark ?? []);
        // 「涨了是好事还是坏事」由指标自己声明：退款额上升不该是绿色。
        const good = k.delta === null ? null : k.delta >= 0 === k.positiveWhenUp;
        return (
          <div
            key={k.key}
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "17px 18px 13px",
              display: "flex",
              flexDirection: "column",
              gap: 11,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>{k.label}</span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: tone.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <Icon name={ICONS[k.key] ?? "barChart"} size={14} color={tone.color} />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1 }}>
                  {format(k.value, k.format)}
                </span>
                {k.subLabel && (
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {k.subLabel}{" "}
                    <b style={{ fontWeight: 700, color: "#3a403c" }}>
                      {format(k.subValue ?? 0, k.subFormat ?? "number")}
                    </b>
                  </span>
                )}
              </div>
              {spark && (
                <svg
                  width="74"
                  height="34"
                  viewBox="0 0 74 34"
                  preserveAspectRatio="none"
                  style={{ flex: "none" }}
                >
                  <path
                    d={spark}
                    fill="none"
                    stroke={tone.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 11.5,
                fontWeight: 600,
                color: good === null ? "var(--muted)" : good ? "#16894f" : "#c0392b",
              }}
            >
              {k.delta === null ? (
                <span style={{ fontWeight: 500 }}>上一周期无数据，暂无对比</span>
              ) : (
                <>
                  <Icon
                    name={k.delta >= 0 ? "chevronUp" : "caretDown"}
                    size={12}
                    strokeWidth={2.6}
                  />
                  {Math.abs(k.delta).toFixed(1)}%{" "}
                  <span style={{ color: "var(--muted)", fontWeight: 500 }}>{k.deltaLabel}</span>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

import { fmtNumber } from "@/lib/tokens";
import type { FunnelStep } from "@/lib/types";

const COLORS = ["var(--accent)", "#2a9c74", "#4a8fb8", "#e0a44a", "#c2703d", "#8a6fb0"];

// Conversion funnel: bar width ∝ count, with step-to-step drop-off %. Shared by
// the site-wide funnel and the per-product drill-down.
//
// 健康度色阶（good / warn）来自 app_settings 的 analytics.funnel_good /
// funnel_warn，由调用方传入 —— 原来是组件里写死的 50 / 25。
export function Funnel({
  steps,
  good = 50,
  warn = 25,
}: {
  steps: FunnelStep[];
  good?: number;
  warn?: number;
}) {
  if (steps.length === 0) {
    return (
      <div style={{ padding: "26px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
        暂无漏斗数据
      </div>
    );
  }
  const max = steps[0].count || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const ratio = prev && prev > 0 ? (s.count / prev) * 100 : null;
        const width = max > 0 ? (s.count / max) * 100 : 0;
        return (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {ratio !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 2 }}>
                <span style={{ fontSize: 10, color: "#c9cdc6" }}>↓</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: ratio >= good ? "#16894f" : ratio >= warn ? "#b45309" : "#c0392b",
                  }}
                >
                  {ratio.toFixed(1)}%
                </span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 92, flex: "none", fontSize: 12.5, fontWeight: 600, color: "#2c322e" }}>{s.label}</span>
              <div style={{ flex: 1, height: 30, background: "var(--bg)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(width, 6)}%`,
                    background: COLORS[i % COLORS.length],
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: 10,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                    {fmtNumber(s.count)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

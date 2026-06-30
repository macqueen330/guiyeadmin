import { buildDonut } from "@/lib/charts";
import type { ChannelSlice } from "@/lib/types";

// A single labelled donut. Used twice on the dashboard/analytics to keep the
// two口径 (销售渠道 vs 客户来源) visually separate — they must never be merged
// into one chart, since they answer different questions.
export function RatioDonut({
  title,
  subtitle,
  centerValue,
  centerLabel,
  slices,
}: {
  title: string;
  subtitle: string;
  centerValue: string;
  centerLabel: string;
  slices: ChannelSlice[];
}) {
  const segs = buildDonut(slices);
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
      <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{subtitle}</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "10px 0 4px" }}>
        <svg width="158" height="158" viewBox="0 0 172 172">
          <g transform="rotate(-90 86 86)">
            <circle cx="86" cy="86" r="58" fill="none" stroke="var(--bg)" strokeWidth="17" />
            {segs.map((s, i) => (
              <circle
                key={i}
                cx="86"
                cy="86"
                r="58"
                fill="none"
                stroke={s.color}
                strokeWidth="17"
                strokeDasharray={s.dasharray}
                strokeDashoffset={s.dashoffset}
                strokeLinecap="butt"
              />
            ))}
          </g>
          <text x="86" y="80" textAnchor="middle" fontSize="23" fontWeight="800" fontFamily="Manrope" fill="#1a1d1b">
            {centerValue}
          </text>
          <text x="86" y="99" textAnchor="middle" fontSize="11" fontFamily="Manrope" fill="#6b716d">
            {centerLabel}
          </text>
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 6 }}>
        {slices.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: c.color, flex: "none" }} />
            <span style={{ fontSize: 12.5, color: "#3a403c", fontWeight: 500 }}>{c.label}</span>
            <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700 }}>{c.val}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

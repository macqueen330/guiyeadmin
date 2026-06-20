import { buildDonut } from "@/lib/charts";
import { channels } from "@/lib/mock/data";

export function ChannelDonut() {
  const segs = buildDonut(channels);
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
      <span style={{ fontSize: 15, fontWeight: 700 }}>渠道占比</span>
      <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>本月订单来源分布</span>
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
          <text x="86" y="80" textAnchor="middle" fontSize="25" fontWeight="800" fontFamily="Manrope" fill="#1a1d1b">
            3,642
          </text>
          <text x="86" y="99" textAnchor="middle" fontSize="11" fontFamily="Manrope" fill="#6b716d">
            总订单
          </text>
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 6 }}>
        {channels.map((c) => (
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

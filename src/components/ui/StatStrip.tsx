import { Icon, type IconName } from "./Icon";

export interface Stat {
  label: string;
  value: string;
  sub?: string;
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  valueColor?: string;
}

export function StatStrip({ stats, columns }: { stats: Stat[]; columns?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns ?? stats.length},1fr)`,
        gap: 16,
        marginBottom: 16,
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 9,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>{s.label}</span>
            {s.icon && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: s.iconBg ?? "var(--accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={s.icon} size={14} color={s.iconColor ?? "var(--accent)"} />
              </div>
            )}
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1, color: s.valueColor }}>
            {s.value}
          </span>
          {s.sub && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.sub}</span>}
        </div>
      ))}
    </div>
  );
}

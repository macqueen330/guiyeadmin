import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export interface Stat {
  label: string;
  /** 已格式化的展示值（调用方用 fmtCurrency / fmtNumber 处理） */
  value: string;
  sub?: string;
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  valueColor?: string;
  /** 有值时整张卡可点，跳到对应的明细页 */
  href?: string;
}

export function StatStrip({
  stats,
  columns,
  empty = "暂无数据",
}: {
  stats: Stat[];
  columns?: number;
  empty?: string;
}) {
  // 空数组曾经会生成 `repeat(0,1fr)` —— 一个看不见的网格加一段莫名的外边距。
  if (stats.length === 0) {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "22px 18px",
          marginBottom: 16,
          textAlign: "center",
          fontSize: 12.5,
          color: "var(--muted)",
        }}
      >
        {empty}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns ?? stats.length},minmax(0,1fr))`,
        gap: 16,
        marginBottom: 16,
      }}
    >
      {stats.map((s, i) => {
        const body = (
          <>
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
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-.5px",
                lineHeight: 1,
                color: s.valueColor,
              }}
            >
              {s.value}
            </span>
            {s.sub && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.sub}</span>}
          </>
        );

        const cardStyle: React.CSSProperties = {
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 9,
          textDecoration: "none",
          color: "inherit",
          minWidth: 0,
        };

        // key 用 label + index：同名标签不会互相覆盖。
        return s.href ? (
          <Link key={`${s.label}-${i}`} href={s.href} style={cardStyle} className="row-hover">
            {body}
          </Link>
        ) : (
          <div key={`${s.label}-${i}`} style={cardStyle}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

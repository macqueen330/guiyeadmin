import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { fmtNumber } from "@/lib/tokens";
import type { PipelineStage } from "@/lib/types";

// 业务主流程。每一格的数字都是当月订单的真实分组计数，
// 且与首页速览、侧边栏徽标同源（src/lib/data/metrics.ts）。

const tones = {
  accent: { color: "var(--accent)", bg: "var(--accent-soft)" },
  amber: { color: "#b45309", bg: "#fff7ec" },
  blue: { color: "#1d4ed8", bg: "#eef4ff" },
  red: { color: "#c0392b", bg: "#fdf0ef" },
} as const;

export function Pipeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 22px",
        marginTop: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>业务主流程</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          订单进入 → 财务结算 · 本月各环节当前待处理量
        </span>
      </div>

      {stages.length === 0 ? (
        <div style={{ padding: "18px 0", fontSize: 12.5, color: "var(--muted)" }}>
          本月还没有订单，各环节暂无待处理量。
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, flexWrap: "wrap" }}>
          {stages.map((p, i) => {
            const tone = tones[p.tone];
            const body = (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: tone.bg,
                      color: tone.color,
                      fontSize: 10.5,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#3a403c",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.title}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 1 }}>
                  <span
                    style={{
                      fontSize: 21,
                      fontWeight: 800,
                      letterSpacing: "-.5px",
                      lineHeight: 1,
                      color: tone.color,
                    }}
                  >
                    {fmtNumber(p.count)}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.sub}</span>
                </div>
                <div style={{ height: 3, borderRadius: 3, background: tone.bg }} />
              </>
            );

            const cellStyle: React.CSSProperties = {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 7,
              padding: "0 4px",
              minWidth: 0,
              textDecoration: "none",
              color: "inherit",
            };

            return (
              <div
                key={p.key}
                style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 96 }}
              >
                {p.href ? (
                  <Link href={p.href} style={cellStyle}>
                    {body}
                  </Link>
                ) : (
                  <div style={cellStyle}>{body}</div>
                )}
                {i < stages.length - 1 && (
                  <Icon
                    name="chevronRight"
                    size={16}
                    color="#c9cdc6"
                    strokeWidth={2.4}
                    style={{ flex: "none", margin: "0 2px" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

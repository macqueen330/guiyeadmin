import { Icon } from "@/components/ui/Icon";
import { pipeline } from "@/lib/mock/data";

const tones = {
  accent: { color: "var(--accent)", bg: "var(--accent-soft)" },
  amber: { color: "#b45309", bg: "#fff7ec" },
  blue: { color: "#1d4ed8", bg: "#eef4ff" },
  red: { color: "#c0392b", bg: "#fdf0ef" },
} as const;

export function Pipeline() {
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
          订单进入 → 财务结算 · 各环节当前待处理量
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
        {pipeline.map((p, i) => {
          const tone = tones[p.tone];
          return (
            <div key={p.title} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  padding: "0 4px",
                  minWidth: 0,
                }}
              >
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
                  <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1, color: tone.color }}>
                    {p.count}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.sub}</span>
                </div>
                <div style={{ height: 3, borderRadius: 3, background: tone.bg }} />
              </div>
              {i < pipeline.length - 1 && (
                <Icon name="chevronRight" size={16} color="#c9cdc6" strokeWidth={2.4} style={{ flex: "none", margin: "0 2px" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

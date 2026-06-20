import { Icon } from "@/components/ui/Icon";
import { alerts } from "@/lib/mock/data";

const toneBox = {
  red: { bg: "#fdf0ef", color: "#c0392b" },
  amber: { bg: "#fff7ec", color: "#b45309" },
  blue: { bg: "#eef4ff", color: "#2b6cb0" },
} as const;

export function Alerts() {
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
        <span style={{ fontSize: 15, fontWeight: 700 }}>待办与异常</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#c0392b",
            background: "#fdf0ef",
            padding: "2px 9px",
            borderRadius: 20,
          }}
        >
          11 项待处理
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
        {alerts.map((a, i) => {
          const t = toneBox[a.tone];
          return (
            <div
              key={a.title}
              className="row-hover"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "11px 0",
                borderBottom: i < alerts.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: t.bg,
                  color: t.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <Icon name={a.icon} size={15} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{a.title}</span>
                <span
                  style={{
                    fontSize: 11.5,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {a.detail}
                </span>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: t.color, flex: "none" }}>
                {a.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

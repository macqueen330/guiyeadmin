import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { AlertItem } from "@/lib/types";

// 今日待办。每一条都是真实查询出来的数量，且都可点击跳到对应的筛选页
// （原来是 6 条写死的条目，class 上挂着 row-hover 却不是链接）。

const toneBox = {
  red: { bg: "#fdf0ef", color: "#c0392b" },
  amber: { bg: "#fff7ec", color: "#b45309" },
  blue: { bg: "#eef4ff", color: "#2b6cb0" },
} as const;

export function Alerts({ alerts }: { alerts: AlertItem[] }) {
  const total = alerts.reduce((sum, a) => sum + a.count, 0);

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>今日待办</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>需要今天处理的事项</span>
        </div>
        {total > 0 && (
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
            {total} 项待处理
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "30px 12px",
          }}
        >
          <Icon name="check" size={22} color="#16894f" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#16894f" }}>暂无待办</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
            没有超时订单、缺货 SKU、逾期应收或待审退款。
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
          {alerts.map((a, i) => {
            const t = toneBox[a.tone];
            return (
              <Link
                key={a.key}
                href={a.href ?? "/"}
                className="row-hover"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "11px 0",
                  borderBottom: i < alerts.length - 1 ? "1px solid var(--line)" : "none",
                  textDecoration: "none",
                  color: "inherit",
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
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 16,
                    fontWeight: 800,
                    color: t.color,
                    flex: "none",
                  }}
                >
                  {a.count}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

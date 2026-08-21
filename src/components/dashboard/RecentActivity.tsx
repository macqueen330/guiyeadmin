import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { fmtRelative, initial } from "@/lib/tokens";
import type { ActivityRow } from "@/lib/data/metrics";

// 最近操作记录。读的是 admin_audit_logs 的真实操作日志。
//
// 原来这里是 5 条写死的、带真人姓名的伪造流水（"李娜 审核通过订单 #GY-28469"…），
// 在界面上与真实审计记录完全同构 —— 一旦被用于责任认定就是直接的合规问题。

const ACTION_ICON: { match: RegExp; icon: IconName; color: string; bg: string }[] = [
  { match: /order|订单/, icon: "bag", color: "#c2703d", bg: "#fff5ec" },
  { match: /pay|refund|收款|退款/, icon: "cash", color: "var(--accent)", bg: "var(--accent-soft)" },
  { match: /ship|logistic|物流|发货/, icon: "truck", color: "#2b6cb0", bg: "#eef4ff" },
  { match: /customer|crm|客户|points|积分/, icon: "users", color: "#8a6fb0", bg: "#f4f0fa" },
  { match: /inventory|stock|库存|商品/, icon: "box", color: "#b07d18", bg: "#fbf4e3" },
  { match: /setting|dict|approval|配置|设置/, icon: "settings", color: "#5b6470", bg: "#eef0f2" },
];

function iconFor(action: string) {
  return (
    ACTION_ICON.find((a) => a.match.test(action)) ?? {
      icon: "file" as IconName,
      color: "#2b6cb0",
      bg: "#eef4ff",
    }
  );
}

export function RecentActivity({ rows }: { rows: ActivityRow[] }) {
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>最近操作记录</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>来自操作日志的真实动作</span>
        </div>
        <Link
          href="/settings?view=logs"
          className="link-underline"
          style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600 }}
        >
          全部 →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: "30px 12px",
            fontSize: 12.5,
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          还没有操作记录。所有管理员的写操作都会自动留痕在这里。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
          {rows.map((it, i) => {
            const style = iconFor(it.action);
            const who = it.actor_name ?? "系统";
            const what = it.detail ?? it.action;
            return (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "10px 0",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: it.result === "success" ? style.bg : "#fdf0ef",
                    color: it.result === "success" ? style.color : "#c0392b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <Icon name={it.result === "success" ? style.icon : "alert"} size={14} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 12.5,
                      color: "#2c322e",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={what}
                  >
                    <b style={{ fontWeight: 700 }}>{who}</b> {what}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {it.module ? `${it.module} · ` : ""}
                    {fmtRelative(it.created_at)}
                  </span>
                </div>
                <span
                  aria-hidden
                  style={{
                    marginLeft: "auto",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--bg)",
                    color: "var(--muted)",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  {initial(who)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

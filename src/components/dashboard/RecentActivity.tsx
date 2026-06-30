import { Icon, type IconName } from "@/components/ui/Icon";

const ITEMS: { who: string; action: string; time: string; icon: IconName; color: string; bg: string }[] = [
  { who: "李娜", action: "审核通过订单 #GY-28469", time: "12 分钟前", icon: "check", color: "#16894f", bg: "#e9f5ef" },
  { who: "王浩然", action: "确认回款 RCV-2026-0588", time: "1 小时前", icon: "cash", color: "var(--accent)", bg: "var(--accent-soft)" },
  { who: "赵敏", action: "标记包裹 #GY-28457 异常", time: "2 小时前", icon: "truck", color: "#c0392b", bg: "#fdf0ef" },
  { who: "李娜", action: "新增渠道客户 Milano Vini", time: "3 小时前", icon: "share", color: "#c2703d", bg: "#fff5ec" },
  { who: "陈思远", action: "更新官网品牌故事文案", time: "5 小时前", icon: "file", color: "#2b6cb0", bg: "#eef4ff" },
];

export function RecentActivity() {
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
      <span style={{ fontSize: 15, fontWeight: 700 }}>最近操作记录</span>
      <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>团队最新动作</span>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
        {ITEMS.map((it, i) => (
          <div
            key={it.action}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "10px 0",
              borderBottom: i < ITEMS.length - 1 ? "1px solid var(--line)" : "none",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: it.bg,
                color: it.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              <Icon name={it.icon} size={14} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12.5, color: "#2c322e" }}>
                <b style={{ fontWeight: 700 }}>{it.who}</b> {it.action}
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{it.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

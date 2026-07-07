import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";

const ACTIONS: { label: string; icon: IconName; href: string; color: string; bg: string }[] = [
  { label: "创建订单", icon: "bag", href: "/orders", color: "#c2703d", bg: "#fff5ec" },
  { label: "添加客户", icon: "userPlus", href: "/crm", color: "var(--accent)", bg: "var(--accent-soft)" },
  { label: "商品入库", icon: "box", href: "/inventory?view=moves", color: "#2b6cb0", bg: "#eef4ff" },
  { label: "上传素材", icon: "upload", href: "/brand?view=media", color: "#8a6fb0", bg: "#f4f0fa" },
  { label: "导出报表", icon: "download", href: "/analytics", color: "#16894f", bg: "#e9f5ef" },
];

export function QuickActions() {
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
      <span style={{ fontSize: 15, fontWeight: 700 }}>快捷入口</span>
      <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>常用操作一键直达</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 }}>
        {ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="hoverable"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "16px 8px",
              borderRadius: 11,
              border: "1px solid var(--line)",
              background: "var(--card)",
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: a.bg,
                color: a.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={a.icon} size={18} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e" }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

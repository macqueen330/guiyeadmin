import type { ReactNode } from "react";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { Card } from "@/components/ui/Card";
import { getSystemUsers } from "@/lib/data/queries";
import { SettingsView } from "./SettingsView";

interface PrefRow {
  label: string;
  sub?: string;
  value: ReactNode;
}

const prefRows: PrefRow[] = [
  { label: "结算币种", sub: "默认报价与结算货币", value: "人民币 CNY ¥" },
  { label: "默认时区", value: "Asia/Shanghai (UTC+8)" },
  { label: "增值税率", sub: "跨境开票适用", value: "13%" },
  { label: "多仓自动分配", sub: "按区域就近分配库存", value: <OnValue text="已开启" /> },
  { label: "操作日志保留", value: "180 天" },
  { label: "双因素认证 (2FA)", sub: "管理员登录强制", value: <OnValue text="已启用" /> },
];

function OnValue({ text }: { text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16894f", flex: "none" }} />
      <span style={{ color: "#16894f" }}>{text}</span>
    </span>
  );
}

export default async function SettingsPage() {
  const users = await getSystemUsers();

  const count = (s: string) => users.filter((u) => u.status === s).length;
  const roleCount = new Set(users.map((u) => u.role)).size;

  const stats: Stat[] = [
    { label: "成员数", value: String(users.length), icon: "users", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
    { label: "启用中", value: String(count("active")), icon: "check", iconColor: "#16894f", iconBg: "#e9f5ef", valueColor: "#16894f" },
    { label: "待激活邀请", value: String(count("invited")), icon: "mail", iconColor: "#b45309", iconBg: "#fff7ec", valueColor: "#b45309" },
    { label: "角色数", value: String(roleCount), sub: "权限分组", icon: "settings", iconColor: "#2b6cb0", iconBg: "#eef4ff" },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SettingsView users={users} />
      <Card style={{ marginTop: 16, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>系统偏好</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>结算、税务与安全策略</span>
        </div>
        <div>
          {prefRows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 0",
                borderBottom: i === prefRows.length - 1 ? "none" : "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{row.label}</span>
                {row.sub && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{row.sub}</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", textAlign: "right" }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useViewer } from "@/components/shell/AdminProvider";
import { can } from "@/lib/auth/permissions";

// 快捷入口。两处修正：
//   1. 每个入口现在直达**创建表单**（?new=1 / ?view=moves&new=1），不再只是跳到列表页；
//   2. 按当前管理员的权限过滤 —— Viewer 里本来就带着 grants，之前完全没用上。
const ACTIONS: {
  label: string;
  icon: IconName;
  href: string;
  color: string;
  bg: string;
  module: string;
  action: string;
}[] = [
  {
    label: "创建订单",
    icon: "bag",
    href: "/orders?new=1",
    color: "#c2703d",
    bg: "#fff5ec",
    module: "orders",
    action: "新建订单",
  },
  {
    label: "添加客户",
    icon: "userPlus",
    href: "/crm?new=1",
    color: "var(--accent)",
    bg: "var(--accent-soft)",
    module: "crm",
    action: "新建客户",
  },
  {
    label: "商品入库",
    icon: "box",
    href: "/inventory?view=moves&new=1",
    color: "#2b6cb0",
    bg: "#eef4ff",
    module: "inventory",
    action: "调整库存",
  },
  {
    label: "登记发货",
    icon: "truck",
    href: "/logistics?view=pending",
    color: "#8a6fb0",
    bg: "#f4f0fa",
    module: "logistics",
    action: "填写物流",
  },
  {
    label: "导出报表",
    icon: "download",
    href: "/analytics",
    color: "#16894f",
    bg: "#e9f5ef",
    module: "analytics",
    action: "导出报表",
  },
];

export function QuickActions() {
  const viewer = useViewer();
  const actions = ACTIONS.filter((a) => can(viewer, a.module, a.action));

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
      <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
        {actions.length > 0 ? "常用操作一键直达" : "当前账号没有可用的快捷操作"}
      </span>
      {actions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 }}>
          {actions.map((a) => (
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
                textDecoration: "none",
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
      )}
    </div>
  );
}

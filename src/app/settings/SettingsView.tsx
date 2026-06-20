"use client";

import type { SystemUser } from "@/lib/types";
import { avatarTone, type Tone } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

const roleTone: Record<string, Tone> = {
  超级管理员: { text: "超级管理员", color: "#1f7a5c", bg: "#e9f5ef" },
  运营: { text: "运营", color: "#2b6cb0", bg: "#eef4ff" },
  财务: { text: "财务", color: "#b45309", bg: "#fff7ec" },
  仓储: { text: "仓储", color: "#8a6fb0", bg: "#f4f0fa" },
  客服: { text: "客服", color: "#c2703d", bg: "#fff5ec" },
};

const roleFallback = (role: string): Tone => ({ text: role, color: "#5b6470", bg: "#eef0f2" });

const statusTone: Record<SystemUser["status"], Tone> = {
  active: { text: "启用", color: "#16894f", bg: "#e9f5ef" },
  invited: { text: "待激活", color: "#b45309", bg: "#fff7ec" },
  disabled: { text: "已停用", color: "#c0392b", bg: "#fdf0ef" },
};

export function SettingsView({ users }: { users: SystemUser[] }) {
  const indexById = new Map(users.map((u, i) => [u.id, i]));

  const uniqueRoles = Array.from(new Set(users.map((u) => u.role)));

  const columns: Column<SystemUser>[] = [
    {
      key: "member",
      header: "成员",
      render: (u) => {
        const av = avatarTone(indexById.get(u.id) ?? 0);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: av.bg,
                color: av.color,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                flex: "none",
              }}
            >
              {u.name[0]}
            </span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontWeight: 600, color: "#2c322e" }}>{u.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{u.email}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "role",
      header: "角色",
      render: (u) => <Chip tone={roleTone[u.role] ?? roleFallback(u.role)} />,
    },
    {
      key: "status",
      header: "状态",
      render: (u) => <StatusTag tone={statusTone[u.status]} />,
    },
    {
      key: "last_active",
      header: "最近活跃",
      render: (u) => <span style={{ color: "var(--muted)", fontSize: 12 }}>{u.last_active}</span>,
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: () => (
        <Button variant="ghost" style={{ height: 30, padding: "0 12px", fontSize: 12.5 }}>
          编辑
        </Button>
      ),
    },
  ];

  const filters: FilterDef<SystemUser>[] = [
    {
      key: "role",
      label: "角色",
      options: uniqueRoles.map((role) => ({ value: role, label: role })),
      match: (u, v) => u.role === v,
    },
    {
      key: "status",
      label: "状态",
      options: (Object.entries(statusTone) as [SystemUser["status"], Tone][]).map(([value, t]) => ({
        value,
        label: t.text,
      })),
      match: (u, v) => u.status === v,
    },
  ];

  return (
    <FilterableTable
      rows={users}
      columns={columns}
      filters={filters}
      searchText={(u) => `${u.name} ${u.email} ${u.role}`}
      searchPlaceholder="搜索成员 / 邮箱 / 角色"
      rightAction={
        <Button variant="primary" icon="plus">
          邀请成员
        </Button>
      }
    />
  );
}

"use client";

import { useState } from "react";
import type { Admin } from "@/lib/types";
import { ADMIN_LEVEL, ADMIN_STATUS, avatarTone, maskPhone, type Tone } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { CreateAdmin } from "./CreateAdmin";

const levelOptions = (["L1", "L2", "L3"] as const).map((value) => ({ value, label: ADMIN_LEVEL[value].text }));
const statusOptions = Object.entries(ADMIN_STATUS).map(([value, t]) => ({ value, label: (t as Tone).text }));

// L1 (超级管理员) accounts cannot be edited / disabled by other admins.
interface Op {
  label: string;
  strong?: boolean;
  danger?: boolean;
}
function opLinks(a: Admin): Op[] {
  const ops: Op[] = [{ label: "查看", strong: true }];
  if (a.level !== "L1") {
    ops.push(
      { label: "编辑权限" },
      { label: "重置密码" },
      { label: a.status === "suspended" ? "启用" : "停用", danger: a.status !== "suspended" },
    );
  }
  ops.push({ label: "查看日志" });
  return ops;
}

export function StaffView({ admins }: { admins: Admin[] }) {
  const [creating, setCreating] = useState(false);
  if (creating) return <CreateAdmin onBack={() => setCreating(false)} />;

  const indexById = new Map(admins.map((x, i) => [x.id, i]));

  const columns: Column<Admin>[] = [
    {
      key: "name",
      header: "姓名",
      render: (a) => {
        const av = avatarTone(indexById.get(a.id) ?? 0);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: av.bg, color: av.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, flex: "none" }}>
              {a.name[0]}
            </span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
              <span style={{ fontWeight: 600, color: "#2c322e" }}>{a.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{maskPhone(a.phone)}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "level",
      header: "管理等级",
      render: (a) => {
        const t = ADMIN_LEVEL[a.level];
        return <span style={{ fontSize: 11, fontWeight: 700, color: t.color, background: t.bg, padding: "3px 10px", borderRadius: 20 }}>{t.text}</span>;
      },
    },
    { key: "role", header: "岗位", render: (a) => <span style={{ color: "#2c322e", fontWeight: 600, fontSize: 12.5 }}>{a.role}</span> },
    {
      key: "scope",
      header: "数据范围",
      render: (a) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
          <span style={{ fontSize: 12.5, color: "#4a514c" }}>{a.scope_label}</span>
          <Chip tone={{ text: a.scope === "all" ? "全部" : a.scope === "region" ? "区域" : a.scope === "dept" ? "部门" : a.scope === "warehouse" ? "仓库" : a.scope === "subordinate" ? "下属" : "本人", color: "#5b6470", bg: "var(--bg)" }} />
        </div>
      ),
    },
    { key: "status", header: "状态", align: "center", render: (a) => <StatusTag tone={ADMIN_STATUS[a.status]} /> },
    { key: "last_login", header: "最近登录", render: (a) => <span style={{ color: "var(--muted)", fontSize: 12 }}>{a.last_login}</span> },
    {
      key: "ops",
      header: "操作",
      align: "right",
      render: (a) => (
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {opLinks(a).map((op) => (
            <span
              key={op.label}
              style={{
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                color: op.danger ? "#c0392b" : op.strong ? "var(--accent)" : "#6b716d",
              }}
            >
              {op.label}
            </span>
          ))}
        </div>
      ),
    },
  ];

  const filters: FilterDef<Admin>[] = [
    { key: "level", label: "等级", options: levelOptions, match: (a, v) => a.level === v },
    { key: "status", label: "状态", options: statusOptions, match: (a, v) => a.status === v },
  ];

  return (
    <FilterableTable
      rows={admins}
      columns={columns}
      filters={filters}
      searchText={(a) => `${a.name} ${a.email} ${a.role} ${a.dept}`}
      searchPlaceholder="搜索姓名 / 岗位 / 部门"
      empty="暂无管理员"
      rightAction={
        <>
          <Button variant="secondary" icon="download">
            导出
          </Button>
          <Button variant="primary" icon="userPlus" onClick={() => setCreating(true)}>
            创建管理员
          </Button>
        </>
      }
    />
  );
}

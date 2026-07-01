"use client";

import { useState, useTransition } from "react";
import type { Admin, AdminStatus } from "@/lib/types";
import { ADMIN_LEVEL, ADMIN_STATUS, avatarTone, maskPhone, type Tone } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { useViewer } from "@/components/shell/AdminProvider";
import { manageError } from "@/lib/auth/permissions";
import { CreateAdmin } from "./CreateAdmin";
import { AdminEditor } from "./AdminEditor";
import {
  setStatusAction,
  resetPasswordAction,
  forceLogoutAction,
  type ActionResult,
} from "./actions";

const levelOptions = (["L1", "L2", "L3"] as const).map((value) => ({ value, label: ADMIN_LEVEL[value].text }));
const statusOptions = Object.entries(ADMIN_STATUS).map(([value, t]) => ({ value, label: (t as Tone).text }));

interface Op {
  label: string;
  strong?: boolean;
  danger?: boolean;
  run: () => void;
}

export function StaffView({ admins }: { admins: Admin[] }) {
  const viewer = useViewer();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTransition] = useTransition();

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await fn();
      setToast({ ok: res.ok, text: (res.ok ? res.message : res.error) ?? (res.ok ? "已完成" : "操作失败") });
    });
  }

  function doStatus(a: Admin, status: AdminStatus, label: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    run(() => setStatusAction(a.id, status));
  }
  function doReset(a: Admin) {
    const pw = window.prompt(`为「${a.name}」设置新密码（至少 8 位，含字母 + 数字）：`);
    if (!pw) return;
    run(() => resetPasswordAction(a.id, pw));
  }
  function doForce(a: Admin) {
    if (!window.confirm(`确定强制退出「${a.name}」的所有登录会话？`)) return;
    run(() => forceLogoutAction(a.id));
  }

  function opsFor(a: Admin): Op[] {
    const ops: Op[] = [];
    const blocked = manageError(viewer, a.level); // null = manageable
    const isSelf = a.id === viewer.id;
    if (blocked) return ops; // 只读：无权管理该账号
    ops.push({ label: "编辑权限", strong: true, run: () => setEditing(a) });
    ops.push({ label: "重置密码", run: () => doReset(a) });
    if (a.status === "active") {
      if (!isSelf) ops.push({ label: "停用", danger: true, run: () => doStatus(a, "suspended", "停用", `确定停用「${a.name}」？停用后该账号将无法登录。`) });
      if (!isSelf) ops.push({ label: "锁定", danger: true, run: () => doStatus(a, "locked", "锁定", `确定锁定「${a.name}」？`) });
      ops.push({ label: "强制退出", danger: true, run: () => doForce(a) });
    } else if (a.status === "suspended") {
      ops.push({ label: "启用", run: () => doStatus(a, "active", "启用") });
    } else if (a.status === "locked") {
      ops.push({ label: "解锁", run: () => doStatus(a, "active", "解锁") });
    } else if (a.status === "pending") {
      ops.push({ label: "激活", strong: true, run: () => doStatus(a, "active", "激活") });
      ops.push({ label: "停用", danger: true, run: () => doStatus(a, "suspended", "停用") });
    }
    return ops;
  }

  if (creating) {
    return <CreateAdmin onBack={() => setCreating(false)} onSaved={() => setToast({ ok: true, text: "管理员已创建" })} />;
  }

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
              <span style={{ fontWeight: 600, color: "#2c322e" }}>
                {a.name}
                {a.id === viewer.id && <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 6 }}>（我）</span>}
              </span>
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
      render: (a) => {
        const ops = opsFor(a);
        if (ops.length === 0) return <span style={{ fontSize: 12, color: "var(--muted)" }}>只读</span>;
        return (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {ops.map((op) => (
              <span
                key={op.label}
                onClick={op.run}
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
        );
      },
    },
  ];

  const filters: FilterDef<Admin>[] = [
    { key: "level", label: "等级", options: levelOptions, match: (a, v) => a.level === v },
    { key: "status", label: "状态", options: statusOptions, match: (a, v) => a.status === v },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            color: toast.ok ? "#16894f" : "#c0392b",
            background: toast.ok ? "#e9f5ef" : "#fdf0ef",
            border: `1px solid ${toast.ok ? "#cbe7d8" : "#f3d3ce"}`,
            borderRadius: 10,
            padding: "10px 13px",
          }}
        >
          {toast.text}
        </div>
      )}

      {viewer.level === "L2" && (
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>二级管理员：仅可创建与管理三级操作员账号。</div>
      )}

      <FilterableTable
        rows={admins}
        columns={columns}
        filters={filters}
        searchText={(a) => `${a.name} ${a.email} ${a.role} ${a.dept}`}
        searchPlaceholder="搜索姓名 / 岗位 / 部门"
        empty="暂无管理员"
        rightAction={
          <Button variant="primary" icon="userPlus" onClick={() => setCreating(true)}>
            创建管理员
          </Button>
        }
      />

      {editing && <AdminEditor admin={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

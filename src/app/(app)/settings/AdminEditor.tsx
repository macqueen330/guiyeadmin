"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ADMIN_LEVEL } from "@/lib/tokens";
import { PERMISSION_MODULES, DATA_SCOPES, grantedActions } from "@/lib/rbac";
import { effectiveGrants } from "@/lib/auth/permissions";
import { useViewer } from "@/components/shell/AdminProvider";
import { updateAdminAction } from "./actions";
import type { Admin, AdminGrant, AdminLevel, DataScope } from "@/lib/types";

const inputStyle: React.CSSProperties = {
  height: 36,
  padding: "0 11px",
  borderRadius: 9,
  border: "1px solid var(--line)",
  background: "var(--card)",
  fontFamily: "inherit",
  fontSize: 13,
  color: "var(--ink)",
  outline: "none",
  width: "100%",
};

function checkedFromGrants(grants: Record<string, AdminGrant>): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const m of PERMISSION_MODULES) {
    const set = grantedActions(m, grants[m.key]);
    for (const a of m.actions) map[`${m.key}:${a.name}`] = set.has(a.name);
  }
  return map;
}

function grantsFromChecked(checked: Record<string, boolean>): Record<string, AdminGrant> {
  const out: Record<string, AdminGrant> = {};
  for (const m of PERMISSION_MODULES) {
    const selected = m.actions.filter((a) => checked[`${m.key}:${a.name}`]).map((a) => a.name);
    if (selected.length === 0) continue;
    out[m.key] = selected.length === m.actions.length ? "all" : selected;
  }
  return out;
}

export function AdminEditor({ admin, onClose }: { admin: Admin; onClose: () => void }) {
  const viewer = useViewer();
  const canChangeLevel = viewer.level === "L1"; // L2 只能管理三级，不能改等级

  const [level, setLevel] = useState<AdminLevel>(admin.level);
  const [role, setRole] = useState(admin.role);
  const [dept, setDept] = useState(admin.dept);
  const [scope, setScope] = useState<DataScope>(admin.scope);
  const [scopeValues, setScopeValues] = useState((admin.scope_values ?? []).join(", "));
  const initialGrants = useMemo(() => effectiveGrants(admin), [admin]);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => checkedFromGrants(initialGrants));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (k: string) => setChecked((s) => ({ ...s, [k]: !s[k] }));
  const grantedCount = Object.values(checked).filter(Boolean).length;

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateAdminAction({
        id: admin.id,
        role,
        dept,
        level,
        scope,
        scopeValues: scopeValues.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
        grants: grantsFromChecked(checked),
      });
      if (res.ok) onClose();
      else setMsg({ ok: false, text: res.error ?? "保存失败" });
    });
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,28,24,.45)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 760, background: "var(--card)", borderRadius: 16, border: "1px solid var(--line)", boxShadow: "0 20px 60px rgba(20,40,30,.25)", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 80px)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 15.5, fontWeight: 700 }}>编辑管理员 · {admin.name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: ADMIN_LEVEL[level].color, background: ADMIN_LEVEL[level].bg, padding: "2px 9px", borderRadius: 20 }}>{ADMIN_LEVEL[level].text}</span>
          <button type="button" onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4a514c" }}>管理等级</span>
              <select value={level} disabled={!canChangeLevel} onChange={(e) => setLevel(e.target.value as AdminLevel)} style={{ ...inputStyle, cursor: canChangeLevel ? "pointer" : "not-allowed", opacity: canChangeLevel ? 1 : 0.6 }}>
                <option value="L1">一级 · 超级管理员</option>
                <option value="L2">二级 · 业务管理员</option>
                <option value="L3">三级 · 操作员</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4a514c" }}>岗位 / 角色</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4a514c" }}>部门</span>
              <input value={dept} onChange={(e) => setDept(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4a514c" }}>数据范围</span>
              <select value={scope} onChange={(e) => setScope(e.target.value as DataScope)} style={{ ...inputStyle, cursor: "pointer" }}>
                {DATA_SCOPES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          {scope !== "all" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4a514c" }}>数据范围取值（区域 / 部门 / 仓库 / 下属，逗号分隔）</span>
              <input value={scopeValues} onChange={(e) => setScopeValues(e.target.value)} style={inputStyle} placeholder="如 华东, 上海" />
            </label>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>模块权限</span>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>已授予 {grantedCount} 项 · 一级管理员默认拥有全部权限</span>
            </div>
            {level === "L1" ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)", background: "var(--bg)", borderRadius: 10, padding: "12px 14px" }}>
                一级（超级管理员）默认拥有全部模块权限，无需逐项配置。
              </div>
            ) : (
              PERMISSION_MODULES.map((m, i) => (
                <div key={m.key} style={{ display: "flex", gap: 12, padding: "10px 2px", borderBottom: i === PERMISSION_MODULES.length - 1 ? "none" : "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: 118, flex: "none" }}>
                    <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <Icon name={m.icon} size={14} />
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#2c322e" }}>{m.name}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
                    {m.actions.map((act) => {
                      const key = `${m.key}:${act.name}`;
                      const on = !!checked[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggle(key)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "5px 10px",
                            borderRadius: 8,
                            fontSize: 11.5,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            color: on ? "var(--accent-strong)" : "#6b716d",
                            background: on ? "var(--accent-soft)" : "var(--bg)",
                            border: on ? "1px solid var(--accent)" : "1px solid var(--line)",
                          }}
                        >
                          {on && <Icon name="check" size={10} strokeWidth={3.2} />}
                          {act.name}
                          {act.sensitive && <span style={{ fontSize: 9, fontWeight: 800, color: "#b45309" }}>高</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {msg && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: msg.ok ? "#16894f" : "#c0392b", background: msg.ok ? "#e9f5ef" : "#fdf0ef", border: `1px solid ${msg.ok ? "#cbe7d8" : "#f3d3ce"}`, borderRadius: 9, padding: "9px 11px" }}>
              {msg.text}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--line)" }}>
          <Button variant="secondary" type="button" onClick={onClose}>取消</Button>
          <Button variant="primary" icon="check" type="button" onClick={save} disabled={pending}>{pending ? "保存中…" : "保存权限"}</Button>
        </div>
      </div>
    </div>
  );
}

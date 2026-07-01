"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ADMIN_LEVEL } from "@/lib/tokens";
import { LEVELS, ROLE_TEMPLATES, DATA_SCOPES } from "@/lib/rbac";
import { useViewer } from "@/components/shell/AdminProvider";
import { createAdminAction, type ActionResult } from "./actions";
import type { AdminLevel, DataScope } from "@/lib/types";

const inputStyle: React.CSSProperties = {
  height: 38,
  padding: "0 12px",
  borderRadius: 9,
  border: "1px solid var(--line)",
  background: "var(--card)",
  fontFamily: "inherit",
  fontSize: 13,
  color: "var(--ink)",
  outline: "none",
  width: "100%",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#4a514c" }}>{label}</span>
      {children}
    </label>
  );
}

function Step({ n, title, sub, children }: { n: number; title: string; sub: string; children: ReactNode }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          {n}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</span>
        </div>
      </div>
      {children}
    </Card>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0" }}>
      <span style={{ fontSize: 12.5, color: "#3a403c" }}>{label}</span>
      <button
        type="button"
        onClick={onClick}
        style={{ width: 40, height: 22, borderRadius: 20, border: "none", cursor: "pointer", padding: 2, background: on ? "var(--accent)" : "#cdd2cb", transition: "background .14s", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}
      >
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff" }} />
      </button>
    </div>
  );
}

export function CreateAdmin({ onBack, onSaved }: { onBack: () => void; onSaved?: () => void }) {
  const viewer = useViewer();
  // 二级管理员只能创建三级管理员。
  const allowedLevels = viewer.level === "L1" ? LEVELS : LEVELS.filter((l) => l.level === "L3");

  const [level, setLevel] = useState<AdminLevel>(viewer.level === "L1" ? "L2" : "L3");
  const [roleKey, setRoleKey] = useState("");
  const [scope, setScope] = useState<DataScope>("all");
  const [forceReset, setForceReset] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [status, setStatus] = useState<"active" | "pending">("active");

  const [state, formAction, pending] = useActionState<ActionResult, FormData>(createAdminAction, { ok: false });

  const rolesForLevel = ROLE_TEMPLATES.filter((r) => r.level === level);
  // Derive the selected role during render (no effect) so switching level always
  // resolves to a valid template without a cascading setState.
  const activeRoleKey = rolesForLevel.some((r) => r.key === roleKey)
    ? roleKey
    : (rolesForLevel[0]?.key ?? "");

  // On success the list behind is revalidated; surface it to the parent (which
  // may refresh) while keeping the confirmation visible.
  useEffect(() => {
    if (state.ok) onSaved?.();
  }, [state.ok, onSaved]);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* hidden fields carry the selected values to the server action */}
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="roleKey" value={activeRoleKey} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="two_factor" value={twoFactor ? "on" : "off"} />
      <input type="hidden" name="force_reset" value={forceReset ? "on" : "off"} />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
          返回管理员列表
        </button>
        <span style={{ fontSize: 16, fontWeight: 700 }}>创建管理员</span>
      </div>

      <Step n={1} title="基本信息" sub="姓名、联系方式与所属部门">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <Field label="姓名"><input name="name" style={inputStyle} placeholder="请输入姓名" required /></Field>
          <Field label="手机号"><input name="phone" style={inputStyle} placeholder="用于登录与验证码" /></Field>
          <Field label="邮箱"><input name="email" type="email" style={inputStyle} placeholder="name@guiye.com（登录账号）" required /></Field>
          <Field label="部门"><input name="dept" style={inputStyle} placeholder="如 运营部 / 财务部" /></Field>
          <Field label="数据范围取值"><input name="scopeValues" style={inputStyle} placeholder="如 华东, 上海（区域/部门/仓库，可留空）" /></Field>
          <Field label="工号"><input name="employee_no" style={inputStyle} placeholder="可选" /></Field>
        </div>
      </Step>

      <Step n={2} title="管理等级" sub="一级管理员只能由现有一级管理员创建；二级只能创建三级">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {LEVELS.map((l) => {
            const on = level === l.level;
            const tone = ADMIN_LEVEL[l.level];
            const locked = !allowedLevels.some((a) => a.level === l.level);
            return (
              <button
                key={l.level}
                type="button"
                onClick={() => !locked && setLevel(l.level)}
                style={{
                  textAlign: "left",
                  padding: "13px 14px",
                  borderRadius: 11,
                  cursor: locked ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  background: on ? "var(--accent-soft)" : "var(--card)",
                  border: on ? "1px solid var(--accent)" : "1px solid var(--line)",
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: tone.color, background: tone.bg, padding: "2px 8px", borderRadius: 20 }}>{tone.text}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</span>
                  {locked && <Icon name="lock" size={12} color="#9a9f9a" style={{ marginLeft: "auto" }} />}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{l.tagline}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={3} title="角色模板" sub="选择后自动生成默认权限，可在「员工管理 → 编辑权限」中微调">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {rolesForLevel.map((r) => {
            const on = r.key === activeRoleKey;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRoleKey(r.key)}
                style={{
                  padding: "8px 13px",
                  borderRadius: 9,
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  color: on ? "#fff" : "#4a514c",
                  background: on ? "var(--accent)" : "var(--card)",
                  border: on ? "1px solid var(--accent)" : "1px solid var(--line)",
                }}
              >
                {r.name}
              </button>
            );
          })}
          {rolesForLevel.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>该等级暂无预设模板，可创建后再自定义权限</span>}
        </div>
      </Step>

      <Step n={4} title="数据范围" sub="决定该账号能查看哪些订单与客户（后端自动按此过滤）">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {DATA_SCOPES.map((s) => {
            const on = scope === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setScope(s.key)}
                style={{
                  textAlign: "left",
                  padding: "11px 13px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: on ? "var(--accent-soft)" : "var(--card)",
                  border: on ? "1px solid var(--accent)" : "1px solid var(--line)",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2c322e", marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{s.desc}</div>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={5} title="登录安全" sub="初始密码、验证方式与账号状态">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
          <div>
            <Field label="初始密码"><input name="password" type="text" style={inputStyle} placeholder="至少 8 位，含字母 + 数字" required /></Field>
            <div style={{ marginTop: 10 }}>
              <Toggle on={forceReset} onClick={() => setForceReset((v) => !v)} label="首次登录强制修改密码" />
              <Toggle on={twoFactor} onClick={() => setTwoFactor((v) => !v)} label="启用二次验证（预留）" />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="账号状态">
              <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "pending")} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="active">正常（可立即登录）</option>
                <option value="pending">待激活（暂不可登录）</option>
              </select>
            </Field>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.7 }}>
              密码由 Supabase Auth 加密存储，系统不保存明文。创建后可在列表中重置密码、停用或强制退出。
            </div>
          </div>
        </div>
      </Step>

      {state.error && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#c0392b", background: "#fdf0ef", border: "1px solid #f3d3ce", borderRadius: 9, padding: "10px 12px" }}>
          {state.error}
        </div>
      )}
      {state.ok && state.message && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#16894f", background: "#e9f5ef", border: "1px solid #cbe7d8", borderRadius: 9, padding: "10px 12px" }}>
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button variant="secondary" onClick={onBack} type="button">
          取消
        </Button>
        <Button variant="primary" icon="check" type="submit" disabled={pending}>
          {pending ? "创建中…" : "创建账号"}
        </Button>
      </div>
    </form>
  );
}

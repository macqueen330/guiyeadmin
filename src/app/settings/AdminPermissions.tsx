"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ADMIN_LEVEL } from "@/lib/tokens";
import {
  LEVELS,
  DATA_SCOPES,
  ROLE_TEMPLATES,
  PERMISSION_MODULES,
  grantedActions,
  L1_ONLY,
  LEVEL_NAME,
  type RoleTemplate,
} from "@/lib/rbac";

function LevelCard({ level, name, tagline, audience, keywords }: (typeof LEVELS)[number]) {
  const tone = ADMIN_LEVEL[level];
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: tone.color, background: tone.bg, padding: "3px 10px", borderRadius: 20 }}>
          {tone.text}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{name}</span>
      </div>
      <span style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{tagline}</span>
      <div style={{ fontSize: 11.5, color: "#4a514c" }}>适用：{audience.join(" · ")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
        {keywords.map((k) => (
          <span key={k} style={{ fontSize: 11, fontWeight: 600, color: tone.color, background: tone.bg, padding: "3px 9px", borderRadius: 6 }}>
            {k}
          </span>
        ))}
      </div>
    </Card>
  );
}

function PermChip({ label, checked, sensitive, onClick }: { label: string; checked: boolean; sensitive?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 11px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        color: checked ? "var(--accent-strong)" : "#6b716d",
        background: checked ? "var(--accent-soft)" : "var(--bg)",
        border: checked ? "1px solid var(--accent)" : "1px solid var(--line)",
        transition: "all .12s",
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: checked ? "var(--accent)" : "transparent",
          border: checked ? "none" : "1.5px solid #c9cdc6",
        }}
      >
        {checked && <Icon name="check" size={10} color="#fff" strokeWidth={3.2} />}
      </span>
      {label}
      {sensitive && (
        <span title="高风险操作" style={{ fontSize: 9, fontWeight: 800, color: "#b45309", background: "#fff7ec", padding: "0 4px", borderRadius: 4 }}>
          高
        </span>
      )}
    </button>
  );
}

function computeChecked(role: RoleTemplate): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const m of PERMISSION_MODULES) {
    const granted = grantedActions(m, role.grants[m.key]);
    for (const act of m.actions) map[`${m.key}:${act.name}`] = granted.has(act.name);
  }
  return map;
}

export function AdminPermissions() {
  const [roleKey, setRoleKey] = useState("super");
  const role = ROLE_TEMPLATES.find((r) => r.key === roleKey) ?? ROLE_TEMPLATES[0];
  const [checked, setChecked] = useState<Record<string, boolean>>(() => computeChecked(role));

  const selectRole = (key: string) => {
    const r = ROLE_TEMPLATES.find((x) => x.key === key);
    if (!r) return;
    setRoleKey(key);
    setChecked(computeChecked(r));
  };
  const toggle = (k: string) => setChecked((s) => ({ ...s, [k]: !s[k] }));

  const scope = DATA_SCOPES.find((s) => s.key === role.scope);
  const grantedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {LEVELS.map((l) => (
          <LevelCard key={l.level} {...l} />
        ))}
      </div>

      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>角色模板与权限矩阵</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            等级 + 模块权限 + 数据范围 —— 同为二级，权限也可完全不同。选择模板生成默认权限后可微调。
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {ROLE_TEMPLATES.map((r) => {
            const on = r.key === roleKey;
            const tone = ADMIN_LEVEL[r.level];
            return (
              <button
                key={r.key}
                onClick={() => selectRole(r.key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
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
                <span style={{ fontSize: 10, fontWeight: 700, color: on ? "#fff" : tone.color, opacity: on ? 0.9 : 1 }}>
                  {tone.text}
                </span>
                {r.name}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 14,
            padding: "12px 14px",
            borderRadius: 11,
            background: "var(--bg)",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>管理等级</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {ADMIN_LEVEL[role.level].text} · {LEVEL_NAME[role.level]}
            </span>
          </div>
          <div style={{ width: 1, height: 28, background: "var(--line)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>默认数据范围</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{scope?.label ?? "—"}</span>
          </div>
          <div style={{ width: 1, height: 28, background: "var(--line)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>已授予权限</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{grantedCount} 项</span>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", maxWidth: 260 }}>{role.desc}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {PERMISSION_MODULES.map((m, i) => (
            <div
              key={m.key}
              style={{
                display: "flex",
                gap: 14,
                padding: "14px 4px",
                borderBottom: i === PERMISSION_MODULES.length - 1 ? "none" : "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, width: 128, flex: "none" }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <Icon name={m.icon} size={16} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#2c322e" }}>{m.name}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
                {m.actions.map((act) => {
                  const key = `${m.key}:${act.name}`;
                  return (
                    <PermChip
                      key={key}
                      label={act.name}
                      sensitive={act.sensitive}
                      checked={!!checked[key]}
                      onClick={() => toggle(key)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>一级管理员独有权限</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>以下操作仅超级管理员可执行，无法授予二级 / 三级</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {L1_ONLY.map((p) => (
            <span
              key={p}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#b07d18",
                background: "#fbf4e3",
                border: "1px solid #efe2bf",
                padding: "5px 11px",
                borderRadius: 8,
              }}
            >
              <Icon name="settings" size={12} color="#b07d18" />
              {p}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

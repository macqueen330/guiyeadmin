"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ADMIN_LEVEL } from "@/lib/tokens";
import { LEVELS, ROLE_TEMPLATES, DATA_SCOPES } from "@/lib/rbac";
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
        onClick={onClick}
        style={{ width: 40, height: 22, borderRadius: 20, border: "none", cursor: "pointer", padding: 2, background: on ? "var(--accent)" : "#cdd2cb", transition: "background .14s", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}
      >
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff" }} />
      </button>
    </div>
  );
}

export function CreateAdmin({ onBack }: { onBack: () => void }) {
  const [level, setLevel] = useState<AdminLevel>("L2");
  const [roleKey, setRoleKey] = useState("order_mgr");
  const [scope, setScope] = useState<DataScope>("all");
  const [forceReset, setForceReset] = useState(true);
  const [smsCode, setSmsCode] = useState(true);
  const [allowRemote, setAllowRemote] = useState(false);

  const rolesForLevel = ROLE_TEMPLATES.filter((r) => r.level === level);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
          返回管理员列表
        </button>
        <span style={{ fontSize: 16, fontWeight: 700 }}>创建管理员</span>
      </div>

      <Step n={1} title="基本信息" sub="姓名、联系方式与所属部门">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <Field label="姓名"><input style={inputStyle} placeholder="请输入姓名" /></Field>
          <Field label="手机号"><input style={inputStyle} placeholder="用于登录与验证码" /></Field>
          <Field label="邮箱"><input style={inputStyle} placeholder="name@guiye.com" /></Field>
          <Field label="部门"><input style={inputStyle} placeholder="如 运营部 / 财务部" /></Field>
          <Field label="职位"><input style={inputStyle} placeholder="如 订单主管" /></Field>
          <Field label="工号"><input style={inputStyle} placeholder="可选" /></Field>
        </div>
      </Step>

      <Step n={2} title="管理等级" sub="一级管理员只能由现有一级管理员创建">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {LEVELS.map((l) => {
            const on = level === l.level;
            const tone = ADMIN_LEVEL[l.level];
            const locked = l.level === "L1";
            return (
              <button
                key={l.level}
                onClick={() => !locked && setLevel(l.level)}
                style={{
                  textAlign: "left",
                  padding: "13px 14px",
                  borderRadius: 11,
                  cursor: locked ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  background: on ? "var(--accent-soft)" : "var(--card)",
                  border: on ? "1px solid var(--accent)" : "1px solid var(--line)",
                  opacity: locked ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: tone.color, background: tone.bg, padding: "2px 8px", borderRadius: 20 }}>{tone.text}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</span>
                  {locked && <Icon name="settings" size={12} color="#9a9f9a" style={{ marginLeft: "auto" }} />}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{l.tagline}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={3} title="角色模板" sub="选择后自动生成默认权限，可在「账号与权限」中微调">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {rolesForLevel.map((r) => {
            const on = r.key === roleKey;
            return (
              <button
                key={r.key}
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
          {rolesForLevel.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>该等级暂无预设模板，可自定义权限</span>}
        </div>
      </Step>

      <Step n={4} title="数据范围" sub="决定该账号能查看哪些订单与客户">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {DATA_SCOPES.map((s) => {
            const on = scope === s.key;
            return (
              <button
                key={s.key}
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
            <Field label="初始密码"><input style={inputStyle} placeholder="至少 8 位，含字母 + 数字" /></Field>
            <div style={{ marginTop: 10 }}>
              <Toggle on={forceReset} onClick={() => setForceReset((v) => !v)} label="首次登录强制修改密码" />
              <Toggle on={smsCode} onClick={() => setSmsCode((v) => !v)} label="启用手机验证码" />
              <Toggle on={allowRemote} onClick={() => setAllowRemote((v) => !v)} label="允许异地登录" />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="账号有效期">
              <select style={{ ...inputStyle, cursor: "pointer" }}>
                <option>长期有效</option>
                <option>90 天</option>
                <option>180 天</option>
                <option>自定义</option>
              </select>
            </Field>
            <Field label="自动退出时间">
              <select style={{ ...inputStyle, cursor: "pointer" }}>
                <option>30 分钟无操作</option>
                <option>1 小时无操作</option>
                <option>2 小时无操作</option>
              </select>
            </Field>
            <Field label="账号状态">
              <select style={{ ...inputStyle, cursor: "pointer" }}>
                <option>待激活</option>
                <option>正常</option>
              </select>
            </Field>
          </div>
        </div>
      </Step>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button variant="secondary" onClick={onBack}>
          取消
        </Button>
        <Button variant="primary" icon="check">
          创建账号
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  updateOwnProfileAction,
  changeOwnPasswordAction,
  type ProfileResult,
} from "./actions";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#4a514c" }}>{label}</span>
      {children}
    </label>
  );
}

function Note({ state }: { state: ProfileResult }) {
  if (!state.error && !state.message) return null;
  const ok = state.ok;
  return (
    <div
      style={{
        fontSize: 12.5,
        fontWeight: 600,
        color: ok ? "#16894f" : "#c0392b",
        background: ok ? "#e9f5ef" : "#fdf0ef",
        border: `1px solid ${ok ? "#cbe7d8" : "#f3d3ce"}`,
        borderRadius: 9,
        padding: "9px 11px",
      }}
    >
      {ok ? state.message : state.error}
    </div>
  );
}

export function ProfileBasicForm({
  name,
  phone,
  dept,
}: {
  name: string;
  phone: string;
  dept: string;
}) {
  const [state, action, pending] = useActionState<ProfileResult, FormData>(updateOwnProfileAction, { ok: false });
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Field label="姓名"><input name="name" style={inputStyle} defaultValue={name} required /></Field>
        <Field label="手机号"><input name="phone" style={inputStyle} defaultValue={phone} placeholder="用于登录与验证码" /></Field>
        <Field label="部门 / 职位"><input name="dept" style={inputStyle} defaultValue={dept} placeholder="如 运营管理部" /></Field>
      </div>
      <Note state={state} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" icon="check" type="submit" disabled={pending}>
          {pending ? "保存中…" : "保存资料"}
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ProfileResult, FormData>(changeOwnPasswordAction, { ok: false });
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 460 }}>
      <Field label="当前密码"><input name="current" type="password" style={inputStyle} autoComplete="current-password" required /></Field>
      <Field label="新密码"><input name="next" type="password" style={inputStyle} autoComplete="new-password" placeholder="至少 8 位，含字母 + 数字" required /></Field>
      <Field label="确认新密码"><input name="confirm" type="password" style={inputStyle} autoComplete="new-password" required /></Field>
      <Note state={state} />
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <Button variant="primary" icon="key" type="submit" disabled={pending}>
          {pending ? "提交中…" : "修改密码"}
        </Button>
      </div>
    </form>
  );
}

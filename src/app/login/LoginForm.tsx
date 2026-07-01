"use client";

import { useActionState } from "react";
import { signInAction, type AuthState } from "@/lib/auth/actions";

const inputStyle: React.CSSProperties = {
  height: 42,
  padding: "0 13px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--bg)",
  fontFamily: "inherit",
  fontSize: 14,
  color: "var(--ink)",
  outline: "none",
  width: "100%",
};

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signInAction, {});

  return (
    <form
      action={formAction}
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: "0 8px 30px rgba(20,40,30,.06)",
      }}
    >
      <input type="hidden" name="redirect" value={redirectTo ?? "/"} />

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#4a514c" }}>邮箱</span>
        <input
          style={inputStyle}
          type="email"
          name="email"
          autoComplete="username"
          placeholder="name@guiye.com"
          required
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#4a514c" }}>密码</span>
        <input
          style={inputStyle}
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="请输入登录密码"
          required
        />
      </label>

      {state.error && (
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "#c0392b",
            background: "#fdf0ef",
            border: "1px solid #f3d3ce",
            borderRadius: 9,
            padding: "9px 11px",
          }}
        >
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          height: 44,
          borderRadius: 10,
          border: "none",
          background: pending ? "var(--muted)" : "var(--accent)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14.5,
          fontFamily: "inherit",
          cursor: pending ? "default" : "pointer",
          marginTop: 4,
        }}
      >
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}

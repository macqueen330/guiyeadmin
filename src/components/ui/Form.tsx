"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import { Icon } from "./Icon";
import type { ActionResult } from "@/lib/actions/types";

// 共用的表单原语。所有「点了没反应」的按钮都改成走这里 → Server Action，
// 成功 / 失败都有明确反馈，不再静默。

// ---------------------------------------------------------------------------
// 字段
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
};

const controlStyle: React.CSSProperties = {
  height: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--card)",
  fontSize: 13,
  fontFamily: "inherit",
  color: "#3a403c",
  width: "100%",
  boxSizing: "border-box",
};

export function Field({
  label,
  hint,
  required,
  children,
  span = 1,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  span?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: `span ${span}` }}>
      <span style={labelStyle}>
        {label}
        {required && <span style={{ color: "#c0392b" }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...controlStyle, ...props.style }} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      style={{ ...controlStyle, height: "auto", padding: "10px 12px", ...props.style }}
    />
  );
}

export function Select({
  options,
  ...props
}: { options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{ ...controlStyle, cursor: "pointer", ...props.style }}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FieldGrid({ columns = 2, children }: { columns?: number; children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

/** 开关。原来「消息通知」5 条规则的值是写死的文字，结构上只能渲染开启态。 */
export function Toggle({
  name,
  defaultChecked,
  onChange,
  disabled,
}: {
  name: string;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const [on, setOn] = useState(Boolean(defaultChecked));
  return (
    <>
      <input type="hidden" name={name} value={on ? "true" : "false"} />
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => {
          const next = !on;
          setOn(next);
          onChange?.(next);
        }}
        style={{
          width: 42,
          height: 24,
          borderRadius: 20,
          border: "none",
          padding: 2,
          cursor: disabled ? "not-allowed" : "pointer",
          background: on ? "var(--accent)" : "#d8dcd6",
          opacity: disabled ? 0.5 : 1,
          transition: "background .15s ease",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transform: `translateX(${on ? 18 : 0}px)`,
            transition: "transform .15s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          }}
        />
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// 提交按钮 / 结果提示
// ---------------------------------------------------------------------------

export function SubmitButton({
  children = "保存",
  variant = "primary",
  icon,
  ...rest
}: {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "soft";
  icon?: React.ComponentProps<typeof Button>["icon"];
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} icon={icon} disabled={pending} {...rest}>
      {pending ? "处理中…" : children}
    </Button>
  );
}

export function ResultBanner({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  if (!state.ok && !state.error) return null;
  const good = state.ok;
  const text = good ? (state.message ?? "已保存") : state.error;
  if (!text) return null;
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 10,
        fontSize: 12.5,
        fontWeight: 600,
        color: good ? "#16894f" : "#c0392b",
        background: good ? "#e9f5ef" : "#fdf0ef",
      }}
    >
      <Icon name={good ? "check" : "alert"} size={14} />
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 表单容器
// ---------------------------------------------------------------------------

export type ServerAction<T> = (
  prev: ActionResult<T> | null,
  fd: FormData,
) => Promise<ActionResult<T>>;

/**
 * 包一个 Server Action 表单：自动管理 pending / 错误 / 成功提示，
 * 成功后可选地关闭弹窗、重置表单、把返回数据交给调用方（例如导出 CSV）。
 */
export function ActionForm<T>({
  action,
  children,
  onSuccess,
  resetOnSuccess,
  hidden,
  style,
}: {
  action: ServerAction<T>;
  children: ReactNode | ((state: ActionResult<T> | null) => ReactNode);
  onSuccess?: (result: ActionResult<T>) => void;
  resetOnSuccess?: boolean;
  hidden?: Record<string, string | number | undefined | null>;
  style?: React.CSSProperties;
}) {
  const [state, formAction] = useActionState<ActionResult<T> | null, FormData>(
    async (prev, fd) => action(prev, fd),
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<ActionResult<T> | null>(null);

  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) {
      onSuccess?.(state);
      if (resetOnSuccess) formRef.current?.reset();
    }
  }, [state, onSuccess, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{ display: "flex", flexDirection: "column", gap: 14, ...style }}
    >
      {hidden &&
        Object.entries(hidden).map(([k, v]) =>
          v === undefined || v === null ? null : (
            <input key={k} type="hidden" name={k} value={String(v)} />
          ),
        )}
      <ResultBanner state={state} />
      {typeof children === "function" ? children(state) : children}
    </form>
  );
}

// ---------------------------------------------------------------------------
// 弹窗
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = 560,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(30,34,31,.38)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "6vh 16px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: width,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          boxShadow: "0 18px 48px rgba(30,34,31,.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "18px 22px 12px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span id={titleId} style={{ fontSize: 15.5, fontWeight: 700 }}>
              {title}
            </span>
            {subtitle && <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--muted)",
              padding: 4,
              lineHeight: 0,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
          </button>
        </div>
        <div style={{ padding: "18px 22px 22px" }}>{children}</div>
      </div>
    </div>
  );
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 二次确认（rbac.CONFIRM_ACTIONS 里的高风险操作）
// ---------------------------------------------------------------------------

export function ConfirmSubmit({
  message,
  children = "确认",
  variant = "primary",
}: {
  message: string;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "soft";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "处理中…" : children}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// 空态
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  hint,
  action,
  compact,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: compact ? "20px 12px" : "40px 20px",
        color: "var(--muted)",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "#5b6470" }}>{title}</span>
      {hint && <span style={{ fontSize: 12, maxWidth: 420, lineHeight: 1.6 }}>{hint}</span>}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}

/** 导出按钮：Server Action 返回 CSV 文本，浏览器侧触发下载。 */
export function ExportForm({
  action,
  label = "导出",
  reason = "运营导出",
  extra,
}: {
  action: ServerAction<{ csv: string; filename: string }>;
  label?: string;
  reason?: string;
  extra?: ReactNode;
}) {
  return (
    <ActionForm<{ csv: string; filename: string }>
      action={action}
      hidden={{ reason }}
      style={{ gap: 8 }}
      onSuccess={(state) => {
        const data = state.data;
        if (!data) return;
        const blob = new Blob(["﻿" + data.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      {extra}
      <SubmitButton variant="secondary" icon="download">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

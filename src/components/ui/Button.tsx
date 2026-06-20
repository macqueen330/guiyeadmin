"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "soft";

const base: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    boxShadow: "0 2px 8px var(--accent-soft)",
  },
  secondary: {
    background: "var(--bg)",
    color: "#3a403c",
    border: "1px solid var(--line)",
  },
  ghost: {
    background: "var(--card)",
    color: "#3a403c",
    border: "1px solid var(--line)",
  },
  soft: {
    background: "var(--accent-soft)",
    color: "var(--accent)",
    border: "none",
  },
};

const hover: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--accent-strong)" },
  secondary: { background: "#eeeee9" },
  ghost: { background: "var(--bg)" },
  soft: { background: "var(--accent-soft)" },
};

export function Button({
  children,
  variant = "secondary",
  icon,
  style,
  ...rest
}: {
  children?: ReactNode;
  variant?: Variant;
  icon?: IconName;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [h, setH] = useState(false);
  return (
    <button
      {...rest}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 38,
        padding: "0 16px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .14s ease",
        ...base[variant],
        ...(h ? hover[variant] : null),
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

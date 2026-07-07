"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ADMIN_STATUS } from "@/lib/tokens";
import { useViewer } from "./AdminProvider";
import { signOutAction } from "@/lib/auth/actions";

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg,#2a9c74,#175f47)",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.42,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      }}
    >
      {name[0]}
    </span>
  );
}

function MenuLink({ href, icon, label, onClick }: { href: string; icon: IconName; label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 9,
        fontSize: 13,
        fontWeight: 500,
        color: "#3a403c",
        textDecoration: "none",
        background: hover ? "var(--bg)" : "transparent",
        transition: "background .12s",
      }}
    >
      <Icon name={icon} size={16} color="#6b716d" />
      {label}
    </Link>
  );
}

export function AdminMenu() {
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canApprove = viewer.level !== "L3"; // 操作员不负责审批

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const statusTone = ADMIN_STATUS[viewer.status];
  const close = () => setOpen(false);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 38,
          padding: "0 8px 0 6px",
          borderRadius: 10,
          border: "1px solid var(--line)",
          background: open ? "var(--bg)" : "var(--card)",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "background .14s",
        }}
      >
        <Avatar name={viewer.name} />
        <span className="admin-menu-name" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#2c322e", whiteSpace: "nowrap" }}>{viewer.name}</span>
          <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600 }}>{viewer.role}</span>
        </span>
        <Icon name="caretDown" size={14} color="#9a9f9a" style={{ flex: "none" }} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 268,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "0 16px 44px rgba(20,40,30,.16)",
            zIndex: 60,
            overflow: "hidden",
          }}
        >
          {/* 1. 当前管理员信息 */}
          <div style={{ padding: 16, display: "flex", gap: 12, borderBottom: "1px solid var(--line)" }}>
            <Avatar name={viewer.name} size={44} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: "#2c322e" }}>{viewer.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 8px", borderRadius: 20 }}>{viewer.role}</span>
              </div>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{viewer.dept || "—"}</span>
              <span style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "var(--muted)" }}>账号状态：</span>
                <span style={{ fontWeight: 700, color: statusTone.color }}>{statusTone.text}</span>
                {viewer.isDemo && <span style={{ color: "var(--muted)" }}>· 演示</span>}
              </span>
            </div>
          </div>

          {/* 2. 快捷入口 */}
          <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 1 }}>
            <MenuLink href="/profile" icon="users" label="个人中心" onClick={close} />
            <MenuLink href="/profile?tab=security" icon="shield" label="账号安全" onClick={close} />
            <MenuLink href="/profile?tab=devices" icon="globe" label="登录设备" onClick={close} />
            {canApprove && <MenuLink href="/settings?view=approval" icon="ticket" label="我的审批" onClick={close} />}
            <MenuLink href="/profile?tab=logs" icon="file" label="操作记录" onClick={close} />
          </div>

          {/* 底部退出登录 */}
          <div style={{ padding: 10, borderTop: "1px solid var(--line)" }}>
            <form action={signOutAction}>
              <button
                type="submit"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: 38,
                  borderRadius: 9,
                  border: "1px solid #f3d3ce",
                  background: "#fdf0ef",
                  color: "#c0392b",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Icon name="logout" size={15} />
                退出登录
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

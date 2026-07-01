"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  NAV_GROUPS,
  navMetaForPath,
  subHref,
  activeSubView,
  type NavItem,
} from "@/lib/nav";
import { Icon } from "@/components/ui/Icon";
import { useViewer } from "./AdminProvider";
import { signOutAction } from "@/lib/auth/actions";
import { ADMIN_LEVEL } from "@/lib/tokens";

function Badge({ tone, text }: { tone: "accent" | "red"; text: string }) {
  return (
    <span
      style={{
        marginLeft: "auto",
        background: tone === "accent" ? "var(--accent)" : "#a04437",
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 7px",
        borderRadius: 20,
        flex: "none",
      }}
    >
      {text}
    </span>
  );
}

function NavRow({
  item,
  active,
  expanded,
  onToggle,
  activeChildKey,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  activeChildKey?: string;
}) {
  const [hover, setHover] = useState(false);
  const hasChildren = !!item.children?.length;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "9px 12px",
          borderRadius: 9,
          background: active
            ? "rgba(255,255,255,.09)"
            : hover
              ? "rgba(255,255,255,.06)"
              : "transparent",
          transition: "background .14s",
        }}
      >
        <Link
          href={item.href}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            flex: 1,
            minWidth: 0,
            fontSize: 13.5,
            fontWeight: active ? 600 : 500,
            color: active ? "#fff" : "#9aa098",
          }}
        >
          <Icon name={item.icon} size={17} />
          <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
        </Link>
        {item.badge && <Badge tone={item.badge.tone} text={item.badge.text} />}
        {hasChildren && (
          <button
            aria-label={expanded ? "收起" : "展开"}
            onClick={onToggle}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: active ? "#cfd3cc" : "#6f756e",
              flex: "none",
            }}
          >
            <Icon
              name="chevronDown"
              size={14}
              strokeWidth={2.4}
              style={{
                transition: "transform .16s",
                transform: expanded ? "none" : "rotate(-90deg)",
              }}
            />
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            margin: "2px 0 4px 22px",
            paddingLeft: 11,
            borderLeft: "1px solid rgba(255,255,255,.08)",
          }}
        >
          {item.children!.map((sub) => {
            const subActive = active && activeChildKey === sub.key;
            return (
              <SubRow
                key={sub.key}
                href={subHref(item, sub)}
                label={sub.label}
                active={subActive}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubRow({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 10px",
        borderRadius: 7,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        color: active ? "#fff" : "#838983",
        background: active ? "rgba(255,255,255,.07)" : hover ? "rgba(255,255,255,.04)" : "transparent",
        transition: "background .14s, color .14s",
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: active ? "var(--accent)" : "#4f544e",
          flex: "none",
        }}
      />
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const activeItem = navMetaForPath(pathname);
  const activeKey = activeItem.key;
  const viewer = useViewer();

  // Only show modules the current admin is allowed to access. Server-side checks
  // still gate every page & action — this is menu-level UX filtering.
  const allowed = new Set(viewer.visibleNav);
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => allowed.has(it.key)),
  })).filter((g) => g.items.length > 0);

  // Each group with children starts collapsed except the active one; the user
  // can override per-module via the chevron.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (item: NavItem) => open[item.key] ?? item.key === activeKey;

  return (
    <aside
      style={{
        background: "var(--sidebar)",
        display: "flex",
        flexDirection: "column",
        padding: "18px 14px",
        gap: 2,
        minHeight: 0,
        overflowY: "auto",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 10px 16px" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(140deg,#2a9c74,#c2703d)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(31,122,92,.35)",
            flex: "none",
          }}
        >
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-.5px" }}>
            瑰
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: ".5px" }}>
            GUIYE 瑰野
          </span>
          <span style={{ color: "#727872", fontWeight: 500, fontSize: 10.5 }}>
            订单 · 渠道 · 履约中台
          </span>
        </div>
      </div>

      {groups.map((group, gi) => (
        <div key={group.label ?? `group-${gi}`} style={{ display: "contents" }}>
          {group.label && (
            <span
              style={{
                color: "#565b56",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "14px 12px 5px",
              }}
            >
              {group.label}
            </span>
          )}
          {group.items.map((item) => {
            const active = activeKey === item.key;
            const activeChild = active ? activeSubView(item, view) : undefined;
            return (
              <NavRow
                key={item.key}
                item={item}
                active={active}
                expanded={isOpen(item)}
                onToggle={() => setOpen((s) => ({ ...s, [item.key]: !isOpen(item) }))}
                activeChildKey={activeChild?.key}
              />
            );
          })}
        </div>
      ))}

      {/* User card + logout */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 10px",
          borderRadius: 11,
          background: "rgba(255,255,255,.04)",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#2a9c74,#175f47)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            flex: "none",
          }}
        >
          {viewer.name[0]}
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
          <span
            style={{
              color: "#e7e8e5",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {viewer.name}
          </span>
          <span style={{ color: "#727872", fontSize: 10.5 }}>
            {ADMIN_LEVEL[viewer.level].text} · {viewer.role}
            {viewer.isDemo ? " · 演示" : ""}
          </span>
        </div>
        <form action={signOutAction} style={{ marginLeft: "auto", flex: "none", display: "flex" }}>
          <button
            type="submit"
            title="退出登录"
            aria-label="退出登录"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#9aa098",
              cursor: "pointer",
            }}
          >
            <Icon name="logout" size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}

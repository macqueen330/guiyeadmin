"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS, navMetaForPath } from "@/lib/nav";
import { Icon } from "@/components/ui/Icon";

function NavLink({
  item,
  active,
}: {
  item: (typeof NAV_GROUPS)[number]["items"][number];
  active: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "9px 12px",
        borderRadius: 9,
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        color: active ? "#fff" : "#9aa098",
        background: active
          ? "rgba(255,255,255,.09)"
          : hover
            ? "rgba(255,255,255,.06)"
            : "transparent",
        transition: "all .14s",
      }}
    >
      <Icon name={item.icon} size={17} />
      <span>{item.label}</span>
      {item.badge && (
        <span
          style={{
            marginLeft: "auto",
            background: item.badge.tone === "accent" ? "var(--accent)" : "#a04437",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            padding: "1px 7px",
            borderRadius: 20,
          }}
        >
          {item.badge.text}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const activeKey = navMetaForPath(pathname).key;

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "6px 10px 16px",
        }}
      >
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

      {NAV_GROUPS.map((group) => (
        <div key={group.label} style={{ display: "contents" }}>
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
          {group.items.map((item) => (
            <NavLink key={item.key} item={item} active={activeKey === item.key} />
          ))}
        </div>
      ))}

      {/* User card */}
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
          陈
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
            陈思远
          </span>
          <span style={{ color: "#727872", fontSize: 10.5 }}>超级管理员</span>
        </div>
        <Icon name="caretDown" size={15} color="#727872" style={{ marginLeft: "auto", flex: "none" }} />
      </div>
    </aside>
  );
}

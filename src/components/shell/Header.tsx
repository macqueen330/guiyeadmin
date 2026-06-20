"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { navMetaForPath } from "@/lib/nav";
import { Icon } from "@/components/ui/Icon";

export function Header() {
  const pathname = usePathname();
  const meta = navMetaForPath(pathname);
  const [bellHover, setBellHover] = useState(false);
  const [exportHover, setExportHover] = useState(false);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 28px",
        borderBottom: "1px solid var(--line)",
        background: "var(--card)",
        flex: "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-.3px" }}>
            {meta.title}
          </h1>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--accent)",
              background: "var(--accent-soft)",
              padding: "2px 9px",
              borderRadius: 20,
            }}
          >
            实时
          </span>
        </div>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{meta.subtitle}</span>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "8px 12px",
            width: 230,
          }}
        >
          <Icon name="search" size={15} color="#9a9f9a" />
          <input
            placeholder="搜索订单 / 客户 / 经销商"
            style={{
              border: "none",
              background: "none",
              outline: "none",
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--ink)",
              width: "100%",
            }}
          />
          <span
            style={{
              fontSize: 10.5,
              color: "#9a9f9a",
              border: "1px solid var(--line)",
              borderRadius: 5,
              padding: "1px 5px",
              flex: "none",
            }}
          >
            ⌘K
          </span>
        </div>

        <button
          onMouseEnter={() => setBellHover(true)}
          onMouseLeave={() => setBellHover(false)}
          style={{
            position: "relative",
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: bellHover ? "var(--bg)" : "var(--card)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background .14s",
          }}
        >
          <Icon name="bell" size={18} color="#4b524d" />
          <span
            style={{
              position: "absolute",
              top: 7,
              right: 8,
              minWidth: 15,
              height: 15,
              padding: "0 3px",
              borderRadius: 8,
              background: "#c0392b",
              color: "#fff",
              fontSize: 9.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid var(--card)",
            }}
          >
            9
          </span>
        </button>

        <button
          onMouseEnter={() => setExportHover(true)}
          onMouseLeave={() => setExportHover(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 38,
            padding: "0 16px",
            borderRadius: 10,
            border: "none",
            background: exportHover ? "var(--accent-strong)" : "var(--accent)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px var(--accent-soft)",
            transition: "background .14s",
          }}
        >
          <Icon name="download" size={15} />
          导出报表
        </button>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navMetaForPath } from "@/lib/nav";
import { Icon } from "@/components/ui/Icon";
import { AdminMenu } from "./AdminMenu";
import type { AlertItem } from "@/lib/types";

// Routes that aren't part of the sidebar nav but still need a header title.
const EXTRA_META: Record<string, { title: string; subtitle: string }> = {
  "/profile": { title: "个人中心", subtitle: "管理个人资料、账号安全和登录设备" },
  "/search": { title: "全局搜索", subtitle: "在订单、客户与商品中查找" },
};

const TONE_COLOR: Record<AlertItem["tone"], string> = {
  red: "#c0392b",
  amber: "#b45309",
  blue: "#2b6cb0",
};

export function Header({
  alerts = [],
  pendingApprovals = 0,
}: {
  alerts?: AlertItem[];
  pendingApprovals?: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const extra = Object.keys(EXTRA_META).find((p) => pathname === p || pathname.startsWith(p + "/"));
  const meta = extra ? EXTRA_META[extra] : navMetaForPath(pathname);

  const [bellOpen, setBellOpen] = useState(false);
  const [bellHover, setBellHover] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const totalAlerts = alerts.reduce((s, a) => s + a.count, 0) + pendingApprovals;

  // ⌘K / Ctrl+K —— 这个提示以前是纯装饰，全库没有任何 keydown 监听。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!bellOpen) return;
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [bellOpen]);

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
        position: "relative",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-.3px" }}>
          {meta.title}
        </h1>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{meta.subtitle}</span>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {/* 全局搜索：真的会提交并跳到 /search，不再是一个没有 value/onChange 的装饰框 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q");
            const value = String(q ?? "").trim();
            if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
          }}
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
            ref={searchRef}
            name="q"
            defaultValue={pathname === "/search" ? (params.get("q") ?? "") : ""}
            placeholder="搜索订单 / 客户 / 商品"
            aria-label="全局搜索"
            style={{
              border: "none",
              background: "none",
              outline: "none",
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--ink)",
              width: "100%",
              minWidth: 0,
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
        </form>

        {/* 待办铃铛：数字是真实待办合计（首页待办 + 待我审批），为 0 时不显示红点 */}
        <div ref={bellRef} style={{ position: "relative" }}>
          <button
            onClick={() => setBellOpen((v) => !v)}
            onMouseEnter={() => setBellHover(true)}
            onMouseLeave={() => setBellHover(false)}
            aria-label={`待办 ${totalAlerts} 条`}
            aria-expanded={bellOpen}
            style={{
              position: "relative",
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: bellHover || bellOpen ? "var(--bg)" : "var(--card)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background .14s",
            }}
          >
            <Icon name="bell" size={18} color="#4b524d" />
            {totalAlerts > 0 && (
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
                {totalAlerts > 99 ? "99+" : totalAlerts}
              </span>
            )}
          </button>

          {bellOpen && (
            <div
              style={{
                position: "absolute",
                top: 46,
                right: 0,
                width: 300,
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                boxShadow: "0 12px 32px rgba(30,34,31,.14)",
                padding: 6,
                zIndex: 60,
              }}
            >
              <div
                style={{
                  padding: "8px 10px 6px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--muted)",
                  letterSpacing: ".5px",
                }}
              >
                今日待办
              </div>
              {pendingApprovals > 0 && (
                <Link
                  href="/settings?view=approval"
                  onClick={() => setBellOpen(false)}
                  className="row-hover"
                  style={rowStyle}
                >
                  <span style={{ ...dotStyle, background: "#b45309" }} />
                  <span style={{ flex: 1 }}>待我审批</span>
                  <strong style={{ color: "#b45309" }}>{pendingApprovals}</strong>
                </Link>
              )}
              {alerts.length === 0 && pendingApprovals === 0 ? (
                <div style={{ padding: "14px 10px", fontSize: 12.5, color: "var(--muted)" }}>
                  暂无待办，一切正常。
                </div>
              ) : (
                alerts.map((a) => (
                  <Link
                    key={a.key}
                    href={a.href ?? "/"}
                    onClick={() => setBellOpen(false)}
                    className="row-hover"
                    style={rowStyle}
                  >
                    <span style={{ ...dotStyle, background: TONE_COLOR[a.tone] }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block" }}>{a.title}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.detail}</span>
                    </span>
                    <strong style={{ color: TONE_COLOR[a.tone] }}>{a.count}</strong>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <span style={{ width: 1, height: 24, background: "var(--line)", flex: "none" }} />

        <AdminMenu pendingApprovals={pendingApprovals} />
      </div>
    </header>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "9px 10px",
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 600,
  color: "#3a403c",
  textDecoration: "none",
};

const dotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  flex: "none",
};

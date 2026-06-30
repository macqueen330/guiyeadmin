"use client";

import { useState } from "react";
import type { RegionRank } from "@/lib/types";
import { fmtCurrency, fmtNumber } from "@/lib/tokens";

// 地区排行 with a 国内省市 / 海外国家 toggle. China-stage business shows
// provinces/cities first; overseas can be switched on as it matures.
export function RegionRanking({
  domestic,
  overseas,
  title = "销售额 · 地区排行",
}: {
  domestic: RegionRank[];
  overseas: RegionRank[];
  title?: string;
}) {
  const [scope, setScope] = useState<"domestic" | "overseas">("domestic");
  const rows = scope === "domestic" ? domestic : overseas;
  const max = rows.length > 0 ? Math.max(...rows.map((r) => r.value)) : 0;

  const tab = (on: boolean): React.CSSProperties => ({
    padding: "5px 11px",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontFamily: "inherit",
    background: on ? "var(--card)" : "transparent",
    color: on ? "var(--ink)" : "var(--muted)",
    boxShadow: on ? "0 1px 2px rgba(0,0,0,.07)" : "none",
  });

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {scope === "domestic" ? "国内省市排行" : "海外国家排行"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 2, background: "var(--bg)", padding: 3, borderRadius: 9 }}>
          <button style={tab(scope === "domestic")} onClick={() => setScope("domestic")}>
            国内省市
          </button>
          <button style={tab(scope === "overseas")} onClick={() => setScope("overseas")}>
            海外国家
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 16 }}>
        {rows.length === 0 ? (
          <span style={{ fontSize: 12.5, color: "var(--muted)", padding: "12px 0" }}>暂无数据</span>
        ) : (
          rows.map((r) => (
            <div key={r.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e" }}>{r.name}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  <span style={{ fontWeight: 700, color: "#2c322e", fontVariantNumeric: "tabular-nums" }}>
                    {fmtCurrency(r.value)}
                  </span>
                  {" · "}
                  {fmtNumber(r.orders)} 单
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 5, background: "var(--bg)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 5,
                    background: "var(--accent)",
                    width: `${max > 0 ? (r.value / max) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { type ReactNode, useMemo, useState } from "react";
import { DataTable, type Column } from "./DataTable";
import { Icon } from "./Icon";

export interface FilterDef<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
}

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: "0 30px 0 12px",
  borderRadius: 9,
  border: "1px solid var(--line)",
  background:
    "var(--card) url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239a9f9a' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\") no-repeat right 10px center",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#3a403c",
  fontFamily: "inherit",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

export function FilterableTable<T extends { id: string }>({
  rows,
  columns,
  searchText,
  searchPlaceholder = "搜索…",
  filters = [],
  rightAction,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  rightAction?: ReactNode;
  empty?: string;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle && !searchText(row).toLowerCase().includes(needle)) return false;
      for (const f of filters) {
        const v = active[f.key];
        if (v && v !== "all" && !f.match(row, v)) return false;
      }
      return true;
    });
  }, [rows, q, active, filters, searchText]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 9,
            padding: "8px 12px",
            width: 260,
          }}
        >
          <Icon name="search" size={15} color="#9a9f9a" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
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
        </div>
        {filters.map((f) => (
          <select
            key={f.key}
            value={active[f.key] ?? "all"}
            onChange={(e) => setActive((s) => ({ ...s, [f.key]: e.target.value }))}
            style={selectStyle}
          >
            <option value="all">{f.label}：全部</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 2 }}>
          共 {filtered.length} 条
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>{rightAction}</div>
      </div>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "6px 18px 8px",
          minWidth: 0,
          overflowX: "auto",
        }}
      >
        <DataTable columns={columns} rows={filtered} empty={empty} />
      </div>
    </div>
  );
}

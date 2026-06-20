"use client";

import type { Dealer } from "@/lib/types";
import { DEALER_STATUS, avatarTone, fmtCurrency, type Tone } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

const levelTone: Record<string, Tone> = {
  金牌: { text: "金牌", color: "#b07d18", bg: "#fbf4e3" },
  银牌: { text: "银牌", color: "#5b6470", bg: "#eef0f2" },
  标准: { text: "标准", color: "#2b6cb0", bg: "#eef4ff" },
};

const statusOptions = Object.entries(DEALER_STATUS).map(([value, t]) => ({
  value,
  label: t.text,
}));

const levelOptions = ["金牌", "银牌", "标准"].map((value) => ({ value, label: value }));

// Highlight contracts expiring within 60 days of "today" (the prototype date).
const TODAY = new Date("2026-06-20");
const SOON_DAYS = 60;

function daysUntil(dateStr: string): number {
  const end = new Date(dateStr);
  return Math.round((end.getTime() - TODAY.getTime()) / 86_400_000);
}

export function ChannelView({ dealers }: { dealers: Dealer[] }) {
  const columns: Column<Dealer>[] = [
    {
      key: "name",
      header: "经销商",
      render: (d) => {
        const av = avatarTone(d.name.length);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: av.bg,
                color: av.color,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                flex: "none",
              }}
            >
              {d.name[0]}
            </span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontWeight: 600, color: "#2c322e" }}>{d.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{d.region}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "contact",
      header: "联系人",
      render: (d) => <span style={{ color: "#4a514c" }}>{d.contact}</span>,
    },
    {
      key: "level",
      header: "等级",
      render: (d) => <Chip tone={levelTone[d.level]} />,
    },
    {
      key: "mtd_sales",
      header: "本月销售",
      align: "right",
      render: (d) => (
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {fmtCurrency(d.mtd_sales)}
        </span>
      ),
    },
    {
      key: "credit",
      header: "信用 / 欠款",
      align: "right",
      render: (d) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
            {fmtCurrency(d.credit_limit)}
          </span>
          {d.debt > 0 ? (
            <span style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              欠 {fmtCurrency(d.debt)}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
          )}
        </div>
      ),
    },
    {
      key: "contract_end",
      header: "合同到期",
      render: (d) => {
        const left = daysUntil(d.contract_end);
        const soon = left <= SOON_DAYS;
        return (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
            <span
              style={{
                fontSize: 12.5,
                color: soon ? "#b45309" : "var(--muted)",
                fontWeight: soon ? 600 : 400,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {d.contract_end}
            </span>
            {soon && <span style={{ fontSize: 10.5, color: "#b45309" }}>即将到期</span>}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "状态",
      align: "center",
      render: (d) => <StatusTag tone={DEALER_STATUS[d.status]} />,
    },
  ];

  const filters: FilterDef<Dealer>[] = [
    { key: "status", label: "状态", options: statusOptions, match: (d, v) => d.status === v },
    { key: "level", label: "等级", options: levelOptions, match: (d, v) => d.level === v },
  ];

  return (
    <FilterableTable
      rows={dealers}
      columns={columns}
      filters={filters}
      searchText={(d) => `${d.name} ${d.region} ${d.contact}`}
      searchPlaceholder="搜索经销商 / 地区 / 联系人"
      rightAction={
        <Button variant="primary" icon="plus">
          新增经销商
        </Button>
      }
    />
  );
}

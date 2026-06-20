"use client";

import type { Customer } from "@/lib/types";
import { avatarTone, fmtCurrency, type Tone } from "@/lib/tokens";
import { Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

const typeTone: Record<Customer["type"], Tone> = {
  individual: { text: "个人", color: "#2b6cb0", bg: "#eef4ff" },
  dealer: { text: "经销商", color: "#c2703d", bg: "#fbf0e6" },
  wholesale: { text: "批发", color: "#5b6470", bg: "#eef0f2" },
};

const levelTone: Record<string, Tone> = {
  VIP: { text: "VIP", color: "#b07d18", bg: "#fbf4e3" },
  普通: { text: "普通", color: "#5b6470", bg: "#eef0f2" },
  新客: { text: "新客", color: "#16894f", bg: "#e9f5ef" },
};

const typeOptions = Object.entries(typeTone).map(([value, t]) => ({
  value,
  label: t.text,
}));
const levelOptions = (["VIP", "普通", "新客"] as const).map((value) => ({
  value,
  label: levelTone[value].text,
}));

export function CrmView({ customers }: { customers: Customer[] }) {
  const indexById = new Map(customers.map((c, i) => [c.id, i]));

  const columns: Column<Customer>[] = [
    {
      key: "customer",
      header: "客户",
      render: (c) => {
        const av = avatarTone(indexById.get(c.id) ?? 0);
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
              {c.name[0]}
            </span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontWeight: 600, color: "#2c322e" }}>{c.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{c.country}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "类型",
      render: (c) => <Chip tone={typeTone[c.type]} />,
    },
    {
      key: "level",
      header: "等级",
      render: (c) => <Chip tone={levelTone[c.level] ?? typeTone.wholesale} />,
    },
    {
      key: "orders_count",
      header: "订单数",
      align: "right",
      render: (c) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.orders_count}</span>
      ),
    },
    {
      key: "total_spent",
      header: "累计消费",
      align: "right",
      render: (c) => (
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {fmtCurrency(c.total_spent)}
        </span>
      ),
    },
    {
      key: "last_order_at",
      header: "最近下单",
      render: (c) => <span style={{ color: "var(--muted)" }}>{c.last_order_at}</span>,
    },
    {
      key: "contact",
      header: "联系方式",
      render: (c) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontSize: 12.5, color: "#4a514c" }}>{c.email}</span>
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{c.phone}</span>
        </div>
      ),
    },
  ];

  const filters: FilterDef<Customer>[] = [
    { key: "type", label: "类型", options: typeOptions, match: (c, v) => c.type === v },
    { key: "level", label: "等级", options: levelOptions, match: (c, v) => c.level === v },
  ];

  return (
    <FilterableTable
      rows={customers}
      columns={columns}
      filters={filters}
      searchText={(c) => `${c.name} ${c.email} ${c.country} ${c.phone}`}
      searchPlaceholder="搜索客户 / 邮箱 / 国家"
      rightAction={
        <Button variant="primary" icon="plus">
          新增客户
        </Button>
      }
    />
  );
}

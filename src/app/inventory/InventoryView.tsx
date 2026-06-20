"use client";

import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { fmtCurrency, fmtNumber, type Tone } from "@/lib/tokens";

export interface InventoryRowView {
  id: string;
  name: string;
  sku_code: string;
  category: string;
  price: number;
  cost: number;
  safety_stock: number;
  status: "active" | "draft" | "archived";
  sellable: number;
  locked: number;
  transit: number;
  low: boolean;
}

const statusTone: Record<InventoryRowView["status"], Tone> = {
  active: { text: "上架", color: "#16894f", bg: "#e9f5ef" },
  draft: { text: "草稿", color: "#6b716d", bg: "#f1f2f0" },
  archived: { text: "下架", color: "#c0392b", bg: "#fdf0ef" },
};

const statusOptions = Object.entries(statusTone).map(([value, t]) => ({
  value,
  label: t.text,
}));

export function InventoryView({ rows }: { rows: InventoryRowView[] }) {
  const categoryOptions = Array.from(new Set(rows.map((r) => r.category))).map((c) => ({
    value: c,
    label: c,
  }));

  const columns: Column<InventoryRowView>[] = [
    {
      key: "name",
      header: "商品",
      render: (r) => <span style={{ fontWeight: 600, color: "#2c322e" }}>{r.name}</span>,
    },
    {
      key: "sku_code",
      header: "SKU",
      render: (r) => (
        <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{r.sku_code}</span>
      ),
    },
    {
      key: "category",
      header: "分类",
      render: (r) => <Chip tone={{ text: r.category, color: "#4a514c", bg: "var(--bg)" }} />,
    },
    {
      key: "price",
      header: "售价",
      align: "right",
      render: (r) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(r.price)}</span>
      ),
    },
    {
      key: "margin",
      header: "毛利率",
      align: "right",
      render: (r) => (
        <span style={{ color: "#16894f", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {(((r.price - r.cost) / r.price) * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      key: "safety_stock",
      header: "安全库存",
      align: "right",
      render: (r) => (
        <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
          {fmtNumber(r.safety_stock)}
        </span>
      ),
    },
    {
      key: "sellable",
      header: "可售",
      align: "right",
      render: (r) => (
        <span
          style={{
            color: r.low ? "#c0392b" : undefined,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtNumber(r.sellable)}
        </span>
      ),
    },
    {
      key: "status",
      header: "状态",
      align: "center",
      render: (r) => <StatusTag tone={statusTone[r.status]} />,
    },
  ];

  const filters: FilterDef<InventoryRowView>[] = [
    {
      key: "category",
      label: "分类",
      options: categoryOptions,
      match: (r, v) => r.category === v,
    },
    {
      key: "status",
      label: "状态",
      options: statusOptions,
      match: (r, v) => r.status === v,
    },
  ];

  return (
    <FilterableTable
      rows={rows}
      columns={columns}
      filters={filters}
      searchText={(r) => `${r.name} ${r.sku_code} ${r.category}`}
      searchPlaceholder="搜索商品 / SKU / 分类"
      rightAction={
        <>
          <Button variant="secondary" icon="download">
            导出库存
          </Button>
          <Button variant="primary" icon="plus">
            新增商品
          </Button>
        </>
      }
    />
  );
}

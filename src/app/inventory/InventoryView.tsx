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

const nameCol: Column<InventoryRowView> = {
  key: "name",
  header: "商品",
  render: (r) => <span style={{ fontWeight: 600, color: "#2c322e" }}>{r.name}</span>,
};
const skuCol: Column<InventoryRowView> = {
  key: "sku_code",
  header: "SKU",
  render: (r) => (
    <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{r.sku_code}</span>
  ),
};

// Multi-tier pricing derived from the官网零售价. The point is to show the data
// model supports官网零售/会员/经销/团购/企业/海外建议 prices — not every tier is
// "enabled" yet, but the structure is here.
function priceCol(header: string, factor: number, accent = false): Column<InventoryRowView> {
  return {
    key: header,
    header,
    align: "right",
    render: (r) => (
      <span
        style={{
          fontWeight: accent ? 700 : 500,
          color: accent ? "#2c322e" : "#4a514c",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtCurrency(Math.round(r.price * factor))}
      </span>
    ),
  };
}

function numCol(
  key: string,
  header: string,
  pick: (r: InventoryRowView) => number,
  opts: { low?: boolean; muted?: boolean } = {},
): Column<InventoryRowView> {
  return {
    key,
    header,
    align: "right",
    render: (r) => (
      <span
        style={{
          color: opts.low && r.low ? "#c0392b" : opts.muted ? "var(--muted)" : undefined,
          fontWeight: opts.low ? 700 : 500,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtNumber(pick(r))}
      </span>
    ),
  };
}

const statusCol: Column<InventoryRowView> = {
  key: "status",
  header: "状态",
  align: "center",
  render: (r) => <StatusTag tone={statusTone[r.status]} />,
};

const COLUMNS: Record<string, Column<InventoryRowView>[]> = {
  products: [
    nameCol,
    skuCol,
    {
      key: "category",
      header: "分类",
      render: (r) => <Chip tone={{ text: r.category, color: "#4a514c", bg: "var(--bg)" }} />,
    },
    priceCol("零售价", 1, true),
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
    numCol("sellable", "可售", (r) => r.sellable, { low: true }),
    statusCol,
  ],
  pricing: [
    nameCol,
    skuCol,
    priceCol("官网零售价", 1, true),
    priceCol("会员价", 0.92),
    priceCol("经销价", 0.78),
    priceCol("团购价", 0.85),
    priceCol("企业采购价", 0.75),
    priceCol("海外建议价", 1.15),
  ],
  stock: [
    nameCol,
    skuCol,
    numCol("sellable", "可售", (r) => r.sellable, { low: true }),
    numCol("locked", "锁定", (r) => r.locked, { muted: true }),
    numCol("transit", "在途", (r) => r.transit, { muted: true }),
    numCol("safety_stock", "安全库存", (r) => r.safety_stock, { muted: true }),
    statusCol,
  ],
  alerts: [
    nameCol,
    skuCol,
    {
      key: "category",
      header: "分类",
      render: (r) => <Chip tone={{ text: r.category, color: "#4a514c", bg: "var(--bg)" }} />,
    },
    numCol("sellable", "可售", (r) => r.sellable, { low: true }),
    numCol("safety_stock", "安全库存", (r) => r.safety_stock, { muted: true }),
    {
      key: "gap",
      header: "缺口",
      align: "right",
      render: (r) => (
        <span style={{ color: "#c0392b", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {r.sellable < r.safety_stock ? "-" + fmtNumber(r.safety_stock - r.sellable) : "—"}
        </span>
      ),
    },
  ],
};

const PLACEHOLDER: Record<string, string> = {
  products: "搜索商品 / SKU / 分类",
  pricing: "搜索商品 / SKU",
  stock: "搜索商品 / SKU",
  alerts: "搜索预警商品 / SKU",
};

export function InventoryView({
  rows,
  view = "products",
}: {
  rows: InventoryRowView[];
  view?: string;
}) {
  const columns = COLUMNS[view] ?? COLUMNS.products;
  const data = view === "alerts" ? rows.filter((r) => r.low) : rows;

  const categoryOptions = Array.from(new Set(rows.map((r) => r.category))).map((c) => ({
    value: c,
    label: c,
  }));
  const filters: FilterDef<InventoryRowView>[] =
    view === "products"
      ? [
          { key: "category", label: "分类", options: categoryOptions, match: (r, v) => r.category === v },
          { key: "status", label: "状态", options: statusOptions, match: (r, v) => r.status === v },
        ]
      : view === "stock"
        ? [{ key: "category", label: "分类", options: categoryOptions, match: (r, v) => r.category === v }]
        : [];

  return (
    <FilterableTable
      rows={data}
      columns={columns}
      filters={filters}
      searchText={(r) => `${r.name} ${r.sku_code} ${r.category}`}
      searchPlaceholder={PLACEHOLDER[view] ?? "搜索商品 / SKU"}
      empty={view === "alerts" ? "暂无库存预警 SKU" : "暂无商品"}
      rightAction={
        view === "pricing" ? (
          <Button variant="primary" icon="plus">
            新增价格策略
          </Button>
        ) : (
          <>
            <Button variant="secondary" icon="download">
              导出
            </Button>
            <Button variant="primary" icon="plus">
              新增商品
            </Button>
          </>
        )
      }
    />
  );
}

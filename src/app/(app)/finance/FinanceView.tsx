"use client";

import type { Settlement } from "@/lib/types";
import { SETTLEMENT_STATUS, SETTLEMENT_TYPE, fmtCurrency } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

const settlementStatusOptions = Object.entries(SETTLEMENT_STATUS).map(
  ([value, t]) => ({ value, label: t.text }),
);
const settlementTypeOptions = Object.entries(SETTLEMENT_TYPE).map(
  ([value, label]) => ({ value, label }),
);

const columns: Column<Settlement>[] = [
  {
    key: "ref_no",
    header: "单据号",
    render: (f) => (
      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{f.ref_no}</span>
    ),
  },
  {
    key: "type",
    header: "类型",
    render: (f) => <Chip tone={{ text: SETTLEMENT_TYPE[f.type], color: "#4a514c", bg: "var(--bg)" }} />,
  },
  {
    key: "party",
    header: "往来方",
    render: (f) => <span style={{ color: "#4a514c" }}>{f.party}</span>,
  },
  {
    key: "amount",
    header: "金额",
    align: "right",
    render: (f) => (
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(f.amount)}</span>
    ),
  },
  {
    key: "due_date",
    header: "到期日",
    render: (f) =>
      f.status === "overdue" ? (
        <span style={{ color: "#c0392b", fontWeight: 600 }}>{f.due_date}</span>
      ) : (
        <span style={{ color: "var(--muted)" }}>{f.due_date}</span>
      ),
  },
  {
    key: "status",
    header: "状态",
    align: "center",
    render: (f) => <StatusTag tone={SETTLEMENT_STATUS[f.status]} />,
  },
];

// Each sub-view is a口径 onto the same settlement ledger.
const VIEW_FILTER: Record<string, (s: Settlement) => boolean> = {
  receipts: (s) => s.status === "paid",
  refunds: (s) => s.type === "refund",
  invoices: (s) => s.type === "invoice",
  reconcile: () => true,
  receivable: (s) => s.type === "receivable",
};

const VIEW_PLACEHOLDER: Record<string, string> = {
  receipts: "搜索收款单 / 往来方",
  refunds: "搜索退款单 / 往来方",
  invoices: "搜索发票 / 往来方",
  reconcile: "搜索单据号 / 往来方",
  receivable: "搜索应收单 / 往来方",
};

export function FinanceView({
  settlements,
  view,
}: {
  settlements: Settlement[];
  view: string;
}) {
  const predicate = VIEW_FILTER[view] ?? VIEW_FILTER.reconcile;
  const rows = settlements.filter(predicate);

  // 对账 needs the full filter set; focused views keep just a status filter.
  const filters: FilterDef<Settlement>[] =
    view === "reconcile"
      ? [
          { key: "type", label: "类型", options: settlementTypeOptions, match: (f, v) => f.type === v },
          { key: "status", label: "状态", options: settlementStatusOptions, match: (f, v) => f.status === v },
        ]
      : [{ key: "status", label: "状态", options: settlementStatusOptions, match: (f, v) => f.status === v }];

  return (
    <FilterableTable
      rows={rows}
      columns={columns}
      filters={filters}
      searchText={(f) => `${f.ref_no} ${f.party} ${SETTLEMENT_TYPE[f.type]}`}
      searchPlaceholder={VIEW_PLACEHOLDER[view] ?? "搜索单据号 / 往来方"}
      empty="该类目暂无单据"
      rightAction={
        <Button variant="secondary" icon="download">
          导出对账
        </Button>
      }
    />
  );
}

"use client";

import type { Settlement } from "@/lib/types";
import { daysUntil, fmtCurrency, fmtDate } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { ActionForm, ExportForm, SubmitButton } from "@/components/ui/Form";
import { useDict } from "@/components/shell/DictProvider";
import { useViewer } from "@/components/shell/AdminProvider";
import { can } from "@/lib/auth/permissions";
import { exportSettlementsAction, markSettlementPaidAction } from "../payments/actions";

// Each sub-view is a 口径 onto the same settlement ledger.
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

export function FinanceView({ settlements, view }: { settlements: Settlement[]; view: string }) {
  const dict = useDict();
  const viewer = useViewer();
  const canConfirm = can(viewer, "finance", "确认收款");
  const canExport = can(viewer, "finance", "导出财务数据");

  const predicate = VIEW_FILTER[view] ?? VIEW_FILTER.reconcile;
  const rows = settlements.filter(predicate);

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
      render: (f) => <Chip tone={dict.tone("settlement_type", f.type)} />,
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
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {fmtCurrency(f.amount)}
        </span>
      ),
    },
    {
      key: "due_date",
      header: "到期日",
      render: (f) => {
        const days = daysUntil(f.due_date);
        // 逾期由「到期日 < 今天且未结清」实时判定，不再只信 status 字段。
        const overdue = f.status !== "paid" && days !== null && days < 0;
        return (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
            <span style={{ color: overdue ? "#c0392b" : "var(--muted)", fontWeight: overdue ? 600 : 400 }}>
              {fmtDate(f.due_date)}
            </span>
            {f.status !== "paid" && days !== null && (
              <span style={{ fontSize: 10.5, color: overdue ? "#c0392b" : "var(--muted)" }}>
                {days < 0 ? `逾期 ${Math.abs(days)} 天` : `还有 ${days} 天`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "状态",
      align: "center",
      render: (f) => <StatusTag tone={dict.tone("settlement_status", f.status)} />,
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (f) =>
        canConfirm && f.status !== "paid" ? (
          <ActionForm action={markSettlementPaidAction} hidden={{ id: f.id }} style={{ gap: 0 }}>
            <SubmitButton variant="secondary" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
              确认结清
            </SubmitButton>
          </ActionForm>
        ) : f.paid_at ? (
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtDate(f.paid_at)} 结清</span>
        ) : null,
    },
  ];

  // 对账 needs the full filter set; focused views keep just a status filter.
  const filters: FilterDef<Settlement>[] =
    view === "reconcile"
      ? [
          {
            key: "type",
            label: "类型",
            options: dict.filterOptions("settlement_type").slice(1),
            match: (f, v) => f.type === v,
          },
          {
            key: "status",
            label: "状态",
            options: dict.filterOptions("settlement_status").slice(1),
            match: (f, v) => f.status === v,
          },
        ]
      : [
          {
            key: "status",
            label: "状态",
            options: dict.filterOptions("settlement_status").slice(1),
            match: (f, v) => f.status === v,
          },
        ];

  return (
    <FilterableTable
      rows={rows}
      columns={columns}
      filters={filters}
      searchText={(f) => `${f.ref_no} ${f.party} ${dict.label("settlement_type", f.type)}`}
      searchPlaceholder={VIEW_PLACEHOLDER[view] ?? "搜索单据号 / 往来方"}
      empty="该类目暂无单据"
      rightAction={canExport ? <ExportForm action={exportSettlementsAction} label="导出对账" /> : null}
    />
  );
}

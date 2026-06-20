"use client";

import type { Shipment, Settlement } from "@/lib/types";
import {
  SHIPMENT_STATUS,
  SETTLEMENT_STATUS,
  SETTLEMENT_TYPE,
  fmtCurrency,
} from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

const shipmentStatusOptions = Object.entries(SHIPMENT_STATUS).map(
  ([value, t]) => ({ value, label: t.text }),
);
const settlementTypeOptions = Object.entries(SETTLEMENT_TYPE).map(
  ([value, label]) => ({ value, label }),
);
const settlementStatusOptions = Object.entries(SETTLEMENT_STATUS).map(
  ([value, t]) => ({ value, label: t.text }),
);

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
    </div>
  );
}

export function LogisticsView({
  shipments,
  settlements,
}: {
  shipments: Shipment[];
  settlements: Settlement[];
}) {
  const shipmentColumns: Column<Shipment>[] = [
    {
      key: "order_no",
      header: "运单号",
      render: (s) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {s.order_no}
        </span>
      ),
    },
    {
      key: "carrier",
      header: "承运商",
      render: (s) => <span style={{ color: "#4a514c" }}>{s.carrier}</span>,
    },
    {
      key: "tracking_no",
      header: "物流单号",
      render: (s) => (
        <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
          {s.tracking_no}
        </span>
      ),
    },
    {
      key: "destination",
      header: "目的地",
      render: (s) => <span style={{ color: "#4a514c" }}>{s.destination}</span>,
    },
    {
      key: "exception",
      header: "异常",
      render: (s) =>
        s.exception ? (
          <span style={{ color: "#c0392b", fontWeight: 600 }}>{s.exception}</span>
        ) : (
          <span style={{ color: "var(--muted)" }}>—</span>
        ),
    },
    {
      key: "status",
      header: "状态",
      align: "center",
      render: (s) => <StatusTag tone={SHIPMENT_STATUS[s.status]} />,
    },
  ];

  const shipmentFilters: FilterDef<Shipment>[] = [
    {
      key: "status",
      label: "状态",
      options: shipmentStatusOptions,
      match: (s, v) => s.status === v,
    },
  ];

  const settlementColumns: Column<Settlement>[] = [
    {
      key: "ref_no",
      header: "单据号",
      render: (f) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {f.ref_no}
        </span>
      ),
    },
    {
      key: "type",
      header: "类型",
      render: (f) => (
        <Chip tone={{ text: SETTLEMENT_TYPE[f.type], color: "#4a514c", bg: "var(--bg)" }} />
      ),
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

  const settlementFilters: FilterDef<Settlement>[] = [
    {
      key: "type",
      label: "类型",
      options: settlementTypeOptions,
      match: (f, v) => f.type === v,
    },
    {
      key: "status",
      label: "状态",
      options: settlementStatusOptions,
      match: (f, v) => f.status === v,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionHeader title="物流追踪" subtitle="全渠道包裹与异常追踪" />
        <FilterableTable
          rows={shipments}
          columns={shipmentColumns}
          filters={shipmentFilters}
          searchText={(s) =>
            `${s.order_no} ${s.tracking_no} ${s.destination} ${s.carrier}`
          }
          searchPlaceholder="搜索运单 / 物流单号 / 目的地"
          rightAction={
            <Button variant="secondary" icon="download">
              导出物流
            </Button>
          }
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionHeader title="财务结算" subtitle="应收应付、退款与开票" />
        <FilterableTable
          rows={settlements}
          columns={settlementColumns}
          filters={settlementFilters}
          searchText={(f) => `${f.ref_no} ${f.party}`}
          searchPlaceholder="搜索单据号 / 往来方"
          rightAction={
            <Button variant="secondary" icon="download">
              导出对账
            </Button>
          }
        />
      </section>
    </div>
  );
}

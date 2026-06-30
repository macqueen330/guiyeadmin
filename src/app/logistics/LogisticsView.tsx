"use client";

import type { Shipment, WarehouseStock } from "@/lib/types";
import { SHIPMENT_STATUS, fmtNumber } from "@/lib/tokens";
import { StatusTag } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

const shipmentStatusOptions = Object.entries(SHIPMENT_STATUS).map(
  ([value, t]) => ({ value, label: t.text }),
);

const shipmentColumns: Column<Shipment>[] = [
  {
    key: "order_no",
    header: "运单号",
    render: (s) => (
      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{s.order_no}</span>
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

function WarehousePanel({ warehouses }: { warehouses: WarehouseStock[] }) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>发货仓库</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>各仓可售 / 锁定 / 在途分布</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)" }} />可售
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#e0a44a" }} />锁定
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#cdd2cb" }} />在途
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 14 }}>
        {warehouses.map((w) => {
          const total = w.sellable + w.locked + w.transit;
          const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) + "%" : "0%");
          return (
            <div key={w.name} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{w.name}</span>
                <span style={{ fontSize: 10.5, color: "var(--muted)", background: "var(--bg)", padding: "1px 7px", borderRadius: 5 }}>
                  {w.code}
                </span>
                {w.low > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "#c0392b", background: "#fdf0ef", padding: "1px 7px", borderRadius: 5 }}>
                    {w.low} SKU预警
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {fmtNumber(total)}
                </span>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "var(--bg)" }}>
                <div style={{ background: "var(--accent)", width: pct(w.sellable) }} />
                <div style={{ background: "#e0a44a", width: pct(w.locked) }} />
                <div style={{ background: "#cdd2cb", width: pct(w.transit) }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const VIEW_META: Record<string, { placeholder: string; status?: Shipment["status"] }> = {
  pending: { placeholder: "搜索运单 / 目的地", status: "preparing" },
  tracking: { placeholder: "搜索运单 / 物流单号 / 目的地" },
  exception: { placeholder: "搜索异常运单 / 目的地", status: "exception" },
};

export function LogisticsView({
  shipments,
  warehouses,
  view,
}: {
  shipments: Shipment[];
  warehouses: WarehouseStock[];
  view: string;
}) {
  if (view === "warehouse") {
    return <WarehousePanel warehouses={warehouses} />;
  }

  const meta = VIEW_META[view] ?? VIEW_META.tracking;
  const rows = meta.status ? shipments.filter((s) => s.status === meta.status) : shipments;

  // The status dropdown only adds value on the full tracking board; preset tabs
  // already pin the status otherwise.
  const filters: FilterDef<Shipment>[] =
    view === "tracking"
      ? [{ key: "status", label: "状态", options: shipmentStatusOptions, match: (s, v) => s.status === v }]
      : [];

  return (
    <FilterableTable
      rows={rows}
      columns={shipmentColumns}
      filters={filters}
      searchText={(s) => `${s.order_no} ${s.tracking_no} ${s.destination} ${s.carrier}`}
      searchPlaceholder={meta.placeholder}
      empty="该状态暂无包裹"
      rightAction={
        <Button variant="secondary" icon="download">
          导出物流
        </Button>
      }
    />
  );
}

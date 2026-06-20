"use client";

import Link from "next/link";
import type { Order } from "@/lib/types";
import { ORDER_SOURCE, ORDER_STATUS, avatarTone, fmtCurrency } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

const statusOptions = Object.entries(ORDER_STATUS).map(([value, t]) => ({
  value,
  label: t.text,
}));
const sourceOptions = Object.entries(ORDER_SOURCE).map(([value, t]) => ({
  value,
  label: t.text,
}));

export function OrdersView({ orders }: { orders: Order[] }) {
  const columns: Column<Order>[] = [
    {
      key: "order_no",
      header: "订单号",
      render: (o) => (
        <Link
          href={`/orders/${o.order_no.replace("#", "")}`}
          style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--accent)" }}
        >
          {o.order_no}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "客户 / 国家",
      render: (o) => {
        const av = avatarTone(o.order_no.length);
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
              {o.customer_name[0]}
            </span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontWeight: 600, color: "#2c322e" }}>{o.customer_name}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{o.country}</span>
            </div>
          </div>
        );
      },
    },
    { key: "source", header: "来源", render: (o) => <Chip tone={ORDER_SOURCE[o.source]} /> },
    {
      key: "ship_from",
      header: "发货方",
      render: (o) => <span style={{ color: "#4a514c" }}>{o.ship_from}</span>,
    },
    {
      key: "amount",
      header: "金额",
      align: "right",
      render: (o) => (
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(o.amount)}</span>
      ),
    },
    {
      key: "received",
      header: "实收",
      align: "right",
      render: (o) => (
        <span style={{ color: o.amount_received >= o.amount ? "#16894f" : "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
          {fmtCurrency(o.amount_received)}
        </span>
      ),
    },
    {
      key: "status",
      header: "状态",
      align: "center",
      render: (o) => <StatusTag tone={ORDER_STATUS[o.status]} />,
    },
    {
      key: "created_at",
      header: "下单时间",
      render: (o) => (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {o.created_at.slice(0, 10)} {o.created_at.slice(11, 16)}
        </span>
      ),
    },
  ];

  const filters: FilterDef<Order>[] = [
    { key: "status", label: "状态", options: statusOptions, match: (o, v) => o.status === v },
    { key: "source", label: "来源", options: sourceOptions, match: (o, v) => o.source === v },
  ];

  return (
    <FilterableTable
      rows={orders}
      columns={columns}
      filters={filters}
      searchText={(o) => `${o.order_no} ${o.customer_name} ${o.country} ${o.ship_from}`}
      searchPlaceholder="搜索订单号 / 客户 / 国家"
      rightAction={
        <>
          <Button variant="secondary" icon="filter">
            高级筛选
          </Button>
          <Button variant="primary" icon="plus">
            新建订单
          </Button>
        </>
      }
    />
  );
}

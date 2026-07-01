"use client";

import Link from "next/link";
import { useState } from "react";
import type { Order } from "@/lib/types";
import {
  ORDER_TYPE,
  ORDER_CHANNEL,
  PAYMENT_METHOD,
  PAY_STATUS,
  FULFILL_STATUS,
  avatarTone,
  fmtCurrency,
} from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const payStatusOptions = Object.entries(PAY_STATUS).map(([value, t]) => ({ value, label: t.text }));
const fulfillStatusOptions = Object.entries(FULFILL_STATUS).map(([value, t]) => ({ value, label: t.text }));

const NEW_ORDER_TYPES = [
  { key: "retail", label: "新建零售订单" },
  { key: "channel", label: "新建渠道订单" },
  { key: "enterprise", label: "新建企业采购" },
  { key: "sample", label: "新建样品订单" },
  { key: "reissue", label: "新建补发订单" },
];

const BATCH_ACTIONS = ["批量审核", "批量分配仓库", "批量发货", "批量导出", "批量打印面单", "批量关闭"];

// view (sub-tab) → row predicate
const VIEW_FILTER: Record<string, (o: Order) => boolean> = {
  all: () => true,
  retail: (o) => o.order_type === "retail",
  channel: (o) => o.order_type === "channel",
  enterprise: (o) => o.order_type === "enterprise",
  refund: (o) => o.pay_status === "partial_refund" || o.pay_status === "refunded",
  exception: (o) => o.fulfill_status === "fulfill_exception",
};

function NewOrderButton() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Button variant="primary" icon="plus" onClick={() => setOpen((o) => !o)}>
        新建订单
        <Icon name="chevronDown" size={13} strokeWidth={2.4} style={{ marginLeft: 2 }} />
      </Button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div
            style={{
              position: "absolute",
              top: 44,
              right: 0,
              zIndex: 11,
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 11,
              boxShadow: "0 8px 24px rgba(0,0,0,.10)",
              padding: 6,
              minWidth: 168,
            }}
          >
            {NEW_ORDER_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setOpen(false)}
                className="hoverable"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#3a403c",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function contextAction(o: Order): string | null {
  if (o.pay_status === "unpaid" || o.pay_status === "paying") return "收款确认";
  if (o.pay_status === "pay_exception" || o.pay_status === "failed") return "处理异常";
  if (o.fulfill_status === "fulfill_exception") return "处理异常";
  if (o.fulfill_status === "prep" || o.fulfill_status === "wait_ship" || o.fulfill_status === "assign")
    return "发货";
  return null;
}

export function OrdersView({
  orders,
  view = "all",
  refundedByOrder = {},
}: {
  orders: Order[];
  view?: string;
  refundedByOrder?: Record<string, number>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rows = orders.filter(VIEW_FILTER[view] ?? VIEW_FILTER.all);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allOn) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });

  const checkbox = (checked: boolean, onChange: () => void) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--accent)" }}
    />
  );

  const columns: Column<Order>[] = [
    {
      key: "select",
      header: checkbox(allOn, toggleAll),
      width: 34,
      render: (o) => checkbox(selected.has(o.id), () => toggle(o.id)),
    },
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
      header: "客户 / 地区",
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
    {
      key: "type_channel",
      header: "订单类型 / 下单渠道",
      render: (o) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
          <Chip tone={ORDER_TYPE[o.order_type]} />
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{ORDER_CHANNEL[o.order_channel].text}</span>
        </div>
      ),
    },
    {
      key: "payment_method",
      header: "支付方式",
      render: (o) => <Chip tone={PAYMENT_METHOD[o.payment_method]} />,
    },
    {
      key: "ship_from",
      header: "发货仓",
      render: (o) => <span style={{ color: "#4a514c", fontSize: 12 }}>{o.ship_from}</span>,
    },
    {
      key: "amount",
      header: "应付 / 净实收",
      align: "right",
      render: (o) => {
        const net = o.amount_received - (refundedByOrder[o.order_no] ?? 0);
        const shortfall = net < o.amount;
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {fmtCurrency(o.amount)}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: shortfall ? "#c0392b" : "#16894f",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtCurrency(net)}
            </span>
          </div>
        );
      },
    },
    {
      key: "pay_status",
      header: "支付状态",
      align: "center",
      render: (o) => <StatusTag tone={PAY_STATUS[o.pay_status]} />,
    },
    {
      key: "fulfill_status",
      header: "履约状态",
      align: "center",
      render: (o) => <StatusTag tone={FULFILL_STATUS[o.fulfill_status]} />,
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
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (o) => {
        const action = contextAction(o);
        return (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <Link
              href={`/orders/${o.order_no.replace("#", "")}`}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", padding: "5px 10px", borderRadius: 7, background: "var(--accent-soft)" }}
            >
              查看
            </Link>
            {action && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#4a514c",
                  padding: "5px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  cursor: "pointer",
                }}
              >
                {action}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const filters: FilterDef<Order>[] =
    view === "all"
      ? [
          { key: "pay_status", label: "支付状态", options: payStatusOptions, match: (o, v) => o.pay_status === v },
          { key: "fulfill_status", label: "履约状态", options: fulfillStatusOptions, match: (o, v) => o.fulfill_status === v },
        ]
      : view === "refund" || view === "exception"
        ? []
        : [{ key: "pay_status", label: "支付状态", options: payStatusOptions, match: (o, v) => o.pay_status === v }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            padding: "10px 14px",
            borderRadius: 11,
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-soft)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-strong)" }}>
            已选 {selected.size} 项
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {BATCH_ACTIONS.map((a) => (
              <span
                key={a}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#3a403c",
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  padding: "5px 11px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {a}
              </span>
            ))}
          </div>
          <button
            onClick={() => setSelected(new Set())}
            style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            取消
          </button>
        </div>
      )}

      <FilterableTable
        rows={rows}
        columns={columns}
        filters={filters}
        searchText={(o) => `${o.order_no} ${o.customer_name} ${o.country} ${o.ship_from}`}
        searchPlaceholder="搜索订单号 / 客户 / 地区"
        empty={view === "exception" ? "暂无发货异常订单" : view === "refund" ? "暂无退款订单" : "该类型暂无订单"}
        rightAction={
          <>
            <Button variant="secondary" icon="filter">
              高级筛选
            </Button>
            <NewOrderButton />
          </>
        }
      />
    </div>
  );
}

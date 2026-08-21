"use client";

import Link from "next/link";
import { useState } from "react";
import type { Order } from "@/lib/types";
import { avatarTone, fmtCurrency, fmtDateTime, initial } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ActionForm, ExportForm, SubmitButton } from "@/components/ui/Form";
import { useDict } from "@/components/shell/DictProvider";
import { useViewer } from "@/components/shell/AdminProvider";
import { can } from "@/lib/auth/permissions";
import {
  bulkUpdateOrdersAction,
  exportOrdersAction,
  updateOrderStatusAction,
} from "./actions";
import { OrderCreateModal, type OrderFormRefs } from "./OrderCreateModal";

// view (sub-tab) → row predicate
const VIEW_FILTER: Record<string, (o: Order) => boolean> = {
  all: () => true,
  retail: (o) => o.order_type === "retail",
  channel: (o) => o.order_type === "channel",
  enterprise: (o) => o.order_type === "enterprise",
  refund: (o) => o.pay_status === "partial_refund" || o.pay_status === "refunded",
  exception: (o) => o.fulfill_status === "fulfill_exception",
};

/**
 * 行内快捷操作：什么状态显示什么按钮 + 点了之后到底改哪个字段。
 * 原来只返回一个中文标签，渲染成不可点的 <span>。
 */
function contextAction(
  o: Order,
): { label: string; field: string; value: string; permission: string } | null {
  if (o.pay_status === "unpaid" || o.pay_status === "paying") {
    return { label: "收款确认", field: "pay_status", value: "paid", permission: "审核订单" };
  }
  if (o.pay_status === "pay_exception" || o.pay_status === "failed") {
    return { label: "重新收款", field: "pay_status", value: "paid", permission: "审核订单" };
  }
  if (o.fulfill_status === "fulfill_exception") {
    return { label: "恢复备货", field: "fulfill_status", value: "prep", permission: "修改订单" };
  }
  if (o.fulfill_status === "assign") {
    return { label: "开始备货", field: "fulfill_status", value: "prep", permission: "修改订单" };
  }
  if (o.fulfill_status === "prep") {
    return { label: "标记待发", field: "fulfill_status", value: "wait_ship", permission: "修改订单" };
  }
  if (o.fulfill_status === "wait_ship") {
    return { label: "确认发货", field: "fulfill_status", value: "shipped", permission: "修改订单" };
  }
  if (o.fulfill_status === "shipped") {
    return { label: "确认签收", field: "fulfill_status", value: "signed", permission: "修改订单" };
  }
  return null;
}

const BATCH_ACTIONS: { label: string; field: string; value: string; permission: string }[] = [
  { label: "批量确认收款", field: "pay_status", value: "paid", permission: "审核订单" },
  { label: "批量开始备货", field: "fulfill_status", value: "prep", permission: "修改订单" },
  { label: "批量标记待发", field: "fulfill_status", value: "wait_ship", permission: "修改订单" },
  { label: "批量确认发货", field: "fulfill_status", value: "shipped", permission: "修改订单" },
  { label: "批量标记异常", field: "fulfill_status", value: "fulfill_exception", permission: "修改订单" },
  { label: "批量进入对账", field: "settle_status", value: "reconciling", permission: "修改订单" },
];

export function OrdersView({
  orders,
  view = "all",
  refundedByOrder = {},
  refs,
  openNew = false,
  query,
}: {
  orders: Order[];
  view?: string;
  refundedByOrder?: Record<string, number>;
  refs: OrderFormRefs;
  openNew?: boolean;
  /** 全局搜索跳转过来时的初始关键词 */
  query?: string;
}) {
  const dict = useDict();
  const viewer = useViewer();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(openNew);
  const [advanced, setAdvanced] = useState(false);

  const rows = orders.filter(VIEW_FILTER[view] ?? VIEW_FILTER.all);
  const canCreate = can(viewer, "orders", "新建订单");
  const canExport = can(viewer, "orders", "导出订单");

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

  const checkbox = (checked: boolean, onChange: () => void, label: string) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--accent)" }}
    />
  );

  const columns: Column<Order>[] = [
    {
      key: "select",
      header: checkbox(allOn, toggleAll, "全选"),
      width: 34,
      render: (o) => checkbox(selected.has(o.id), () => toggle(o.id), `选择 ${o.order_no}`),
    },
    {
      key: "order_no",
      header: "订单号",
      render: (o) => (
        <Link
          href={`/orders/${encodeURIComponent(o.order_no)}`}
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
              {initial(o.customer_name)}
            </span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontWeight: 600, color: "#2c322e" }}>{o.customer_name}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
                {o.country}
                {o.province ? ` · ${o.province}` : ""}
              </span>
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
          <Chip tone={dict.tone("order_type", o.order_type)} />
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
            {dict.label("order_channel", o.order_channel)}
          </span>
        </div>
      ),
    },
    {
      key: "payment_method",
      header: "支付方式",
      render: (o) => <Chip tone={dict.tone("payment_method", o.payment_method)} />,
    },
    {
      key: "ship_from",
      header: "发货仓",
      render: (o) => (
        <span style={{ color: "#4a514c", fontSize: 12 }}>{o.ship_from || "未分配"}</span>
      ),
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
      render: (o) => <StatusTag tone={dict.tone("pay_status", o.pay_status)} />,
    },
    {
      key: "fulfill_status",
      header: "履约状态",
      align: "center",
      render: (o) => <StatusTag tone={dict.tone("fulfill_status", o.fulfill_status)} />,
    },
    {
      key: "created_at",
      header: "下单时间",
      render: (o) => (
        <span style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
          {fmtDateTime(o.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (o) => {
        const action = contextAction(o);
        const allowed = action ? can(viewer, "orders", action.permission) : false;
        return (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
            <Link
              href={`/orders/${encodeURIComponent(o.order_no)}`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent)",
                padding: "5px 10px",
                borderRadius: 7,
                background: "var(--accent-soft)",
              }}
            >
              查看
            </Link>
            {action && allowed && (
              <ActionForm
                action={updateOrderStatusAction}
                hidden={{ order_no: o.order_no, field: action.field, value: action.value }}
                style={{ gap: 0 }}
              >
                <SubmitButton variant="secondary" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
                  {action.label}
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        );
      },
    },
  ];

  const baseFilters: FilterDef<Order>[] = [
    {
      key: "pay_status",
      label: "支付状态",
      options: dict.filterOptions("pay_status").slice(1),
      match: (o, v) => o.pay_status === v,
    },
    {
      key: "fulfill_status",
      label: "履约状态",
      options: dict.filterOptions("fulfill_status").slice(1),
      match: (o, v) => o.fulfill_status === v,
    },
  ];

  // 「高级筛选」不再是无 handler 的按钮：点开会追加类型 / 渠道 / 结算三组筛选。
  const advancedFilters: FilterDef<Order>[] = [
    {
      key: "order_type",
      label: "订单类型",
      options: dict.filterOptions("order_type").slice(1),
      match: (o, v) => o.order_type === v,
    },
    {
      key: "order_channel",
      label: "下单渠道",
      options: dict.filterOptions("order_channel").slice(1),
      match: (o, v) => o.order_channel === v,
    },
    {
      key: "settle_status",
      label: "结算状态",
      options: dict.filterOptions("settle_status").slice(1),
      match: (o, v) => o.settle_status === v,
    },
    {
      key: "customer_source",
      label: "客户来源",
      options: dict.filterOptions("customer_source").slice(1),
      match: (o, v) => o.customer_source === v,
    },
  ];

  const filters =
    view === "refund" || view === "exception"
      ? advanced
        ? advancedFilters
        : []
      : advanced
        ? [...baseFilters, ...advancedFilters]
        : baseFilters;

  const selectedNos = rows.filter((r) => selected.has(r.id)).map((r) => r.order_no);

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
            {BATCH_ACTIONS.filter((a) => can(viewer, "orders", a.permission)).map((a) => (
              <ActionForm
                key={a.label}
                action={bulkUpdateOrdersAction}
                hidden={{ field: a.field, value: a.value }}
                onSuccess={() => setSelected(new Set())}
                style={{ gap: 0 }}
              >
                {selectedNos.map((no) => (
                  <input key={no} type="hidden" name="order_no" value={no} />
                ))}
                <SubmitButton
                  variant="secondary"
                  style={{ height: 30, padding: "0 11px", fontSize: 12, background: "var(--card)" }}
                >
                  {a.label}
                </SubmitButton>
              </ActionForm>
            ))}
          </div>
          <button
            onClick={() => setSelected(new Set())}
            style={{
              marginLeft: "auto",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            取消
          </button>
        </div>
      )}

      <FilterableTable
        rows={rows}
        columns={columns}
        filters={filters}
        searchText={(o) =>
          `${o.order_no} ${o.customer_name} ${o.country} ${o.province ?? ""} ${o.ship_from}`
        }
        searchPlaceholder="搜索订单号 / 客户 / 地区"
        initialQuery={query}
        empty={
          view === "exception"
            ? "暂无发货异常订单"
            : view === "refund"
              ? "暂无退款订单"
              : "该类型暂无订单"
        }
        rightAction={
          <>
            <Button
              variant={advanced ? "soft" : "secondary"}
              icon="filter"
              onClick={() => setAdvanced((v) => !v)}
            >
              高级筛选
            </Button>
            {canExport && <ExportForm action={exportOrdersAction} label="导出" reason="订单列表导出" />}
            {canCreate && (
              <Button variant="primary" icon="plus" onClick={() => setNewOpen(true)}>
                新建订单
                <Icon name="chevronRight" size={13} strokeWidth={2.4} style={{ marginLeft: 2 }} />
              </Button>
            )}
          </>
        }
      />

      {canCreate && (
        <OrderCreateModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          refs={refs}
          defaultType={
            view === "retail" || view === "channel" || view === "enterprise" ? view : "retail"
          }
        />
      )}
    </div>
  );
}

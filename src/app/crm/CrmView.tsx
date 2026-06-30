"use client";

import type { Customer, Order } from "@/lib/types";
import { ORDER_SOURCE, ORDER_STATUS, avatarTone, fmtCurrency, fmtNumber, type Tone } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import { ModulePlaceholder } from "@/components/ui/ModulePlaceholder";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

const levelTone: Record<string, Tone> = {
  VIP: { text: "VIP", color: "#b07d18", bg: "#fbf4e3" },
  普通: { text: "普通", color: "#5b6470", bg: "#eef0f2" },
  新客: { text: "新客", color: "#16894f", bg: "#e9f5ef" },
};

const levelOptions = (["VIP", "普通", "新客"] as const).map((value) => ({
  value,
  label: levelTone[value].text,
}));

const RETAIL_SOURCES = ["web", "wechat", "whatsapp", "instagram"];

function Avatar({ seed, name }: { seed: number; name: string }) {
  const av = avatarTone(seed);
  return (
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
      {name[0]}
    </span>
  );
}

function CustomerCell(c: Customer, seed: number) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <Avatar seed={seed} name={c.name} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span style={{ fontWeight: 600, color: "#2c322e" }}>{c.name}</span>
        <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{c.country}</span>
      </div>
    </div>
  );
}

export function CrmView({
  customers,
  orders,
  view = "consumers",
}: {
  customers: Customer[];
  orders: Order[];
  view?: string;
}) {
  const indexById = new Map(customers.map((c, i) => [c.id, i]));

  if (view === "tags") {
    return (
      <ModulePlaceholder
        icon="tag"
        title="客户标签"
        description="为消费者打标签并按标签分群运营，例如高复购、礼赠客户、活动参与者、沉睡客户，用于精准触达与召回。"
        fields={["标签名称", "打标人数", "自动规则", "手动标记", "标签分组", "创建人"]}
      />
    );
  }

  if (view === "records") {
    // 消费记录 = 个人消费者的零售订单流水。
    const records = orders.filter((o) => RETAIL_SOURCES.includes(o.source));
    const recordColumns: Column<Order>[] = [
      {
        key: "order_no",
        header: "订单号",
        render: (o) => (
          <span style={{ fontWeight: 600, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
            {o.order_no}
          </span>
        ),
      },
      {
        key: "customer",
        header: "消费者 / 国家",
        render: (o) => (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Avatar seed={o.order_no.length} name={o.customer_name} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontWeight: 600, color: "#2c322e" }}>{o.customer_name}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{o.country}</span>
            </div>
          </div>
        ),
      },
      { key: "source", header: "渠道", render: (o) => <Chip tone={ORDER_SOURCE[o.source]} /> },
      {
        key: "amount",
        header: "金额",
        align: "right",
        render: (o) => (
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(o.amount)}</span>
        ),
      },
      { key: "status", header: "状态", align: "center", render: (o) => <StatusTag tone={ORDER_STATUS[o.status]} /> },
      {
        key: "created_at",
        header: "时间",
        render: (o) => <span style={{ color: "var(--muted)", fontSize: 12 }}>{o.created_at.slice(0, 10)}</span>,
      },
    ];
    return (
      <FilterableTable
        rows={records}
        columns={recordColumns}
        searchText={(o) => `${o.order_no} ${o.customer_name} ${o.country}`}
        searchPlaceholder="搜索消费记录 / 消费者"
        empty="暂无消费记录"
        rightAction={
          <Button variant="secondary" icon="download">
            导出记录
          </Button>
        }
      />
    );
  }

  // consumers / members share a customer table with view-specific columns.
  const isMembers = view === "members";
  const data = isMembers ? customers.filter((c) => c.level !== "新客") : customers;

  const columns: Column<Customer>[] = isMembers
    ? [
        { key: "customer", header: "会员", render: (c) => CustomerCell(c, indexById.get(c.id) ?? 0) },
        { key: "level", header: "等级", render: (c) => <Chip tone={levelTone[c.level] ?? levelTone.普通} /> },
        {
          key: "points",
          header: "积分",
          align: "right",
          render: (c) => (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtNumber(Math.round(c.total_spent / 10))}</span>
          ),
        },
        {
          key: "growth",
          header: "成长值",
          align: "right",
          render: (c) => (
            <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {fmtNumber(c.orders_count * 100)}
            </span>
          ),
        },
        { key: "orders_count", header: "订单数", align: "right", render: (c) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.orders_count}</span> },
        {
          key: "total_spent",
          header: "累计消费",
          align: "right",
          render: (c) => (
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(c.total_spent)}</span>
          ),
        },
      ]
    : [
        { key: "customer", header: "消费者", render: (c) => CustomerCell(c, indexById.get(c.id) ?? 0) },
        { key: "level", header: "等级", render: (c) => <Chip tone={levelTone[c.level] ?? levelTone.普通} /> },
        { key: "orders_count", header: "订单数", align: "right", render: (c) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.orders_count}</span> },
        {
          key: "total_spent",
          header: "累计消费",
          align: "right",
          render: (c) => (
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(c.total_spent)}</span>
          ),
        },
        { key: "last_order_at", header: "最近下单", render: (c) => <span style={{ color: "var(--muted)" }}>{c.last_order_at}</span> },
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
    { key: "level", label: "等级", options: levelOptions, match: (c, v) => c.level === v },
  ];

  return (
    <FilterableTable
      rows={data}
      columns={columns}
      filters={filters}
      searchText={(c) => `${c.name} ${c.email} ${c.country} ${c.phone}`}
      searchPlaceholder="搜索消费者 / 邮箱 / 国家"
      empty="暂无消费者"
      rightAction={
        <Button variant="primary" icon="plus">
          {isMembers ? "新增会员" : "新增消费者"}
        </Button>
      }
    />
  );
}

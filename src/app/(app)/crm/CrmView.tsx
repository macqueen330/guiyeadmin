"use client";

import { useState } from "react";
import type { Customer, CustomerTag, MembershipTier, Order } from "@/lib/types";
import {
  avatarTone,
  fmtCurrency,
  fmtDate,
  fmtNumber,
  initial,
  maskEmail,
  maskPhone,
  type Tone,
} from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { ActionForm, ExportForm, Field, FieldGrid, SubmitButton, TextInput } from "@/components/ui/Form";
import { useDict } from "@/components/shell/DictProvider";
import { useViewer } from "@/components/shell/AdminProvider";
import { can } from "@/lib/auth/permissions";
import { createCustomerTagAction, exportCustomersAction } from "./actions";
import { CustomerDetailModal, CustomerFormModal } from "./CustomerPanels";

// 客户中心（用户）。
//
// 改造要点：
//   * 积分 / 成长值读的是 customers.points / growth（真实字段 + points_ledger 流水），
//     不再是渲染时 total_spent/10 与 orders_count*100 算出来的伪造资产；
//   * 会员判定用 membership_tiers 的门槛，不再是散在两处的 level !== "新客"；
//   * 手机号 / 邮箱按查看者等级脱敏（security.mask_phone_min_level）；
//   * 消费记录按 customer_id 关联，不再靠 order.source 猜；
//   * 三个按钮（导出 / 新增消费者 / 新增会员）全部接上真实 Server Action。

function tierTone(tiers: MembershipTier[], level: string): Tone {
  const t = tiers.find((x) => x.name === level);
  return t
    ? { text: t.name, color: t.color, bg: t.bg }
    : { text: level || "—", color: "#5b6470", bg: "#eef0f2" };
}

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
      {initial(name)}
    </span>
  );
}

export function CrmView({
  customers,
  orders,
  tags,
  tagLinks,
  tiers,
  view = "consumers",
  openNew = false,
  query,
}: {
  customers: Customer[];
  orders: Order[];
  tags: CustomerTag[];
  tagLinks: Record<string, string[]>;
  tiers: MembershipTier[];
  view?: string;
  openNew?: boolean;
  /** 全局搜索跳转过来时的初始关键词 */
  query?: string;
}) {
  const dict = useDict();
  const viewer = useViewer();
  const [formOpen, setFormOpen] = useState(openNew);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);

  const canCreate = can(viewer, "crm", "新建客户");
  const canExport = can(viewer, "crm", "导出客户");
  const showFull = viewer.canSeeFullContact;

  const indexById = new Map(customers.map((c, i) => [c.id, i]));
  const openDetail = (c: Customer) => setDetail(c);

  const CustomerCell = (c: Customer) => (
    <button
      onClick={() => openDetail(c)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        border: "none",
        background: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
      }}
    >
      <Avatar seed={indexById.get(c.id) ?? 0} name={c.name} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span style={{ fontWeight: 600, color: "var(--accent)" }}>{c.name}</span>
        <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{c.country}</span>
      </div>
    </button>
  );

  // ---- 客户标签 ----
  if (view === "tags") {
    const counts = new Map<string, number>();
    for (const ids of Object.values(tagLinks)) {
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const tagColumns: Column<CustomerTag>[] = [
      {
        key: "name",
        header: "标签",
        render: (t) => <Chip tone={{ text: t.name, color: t.color, bg: t.bg }} />,
      },
      {
        key: "count",
        header: "打标人数",
        align: "right",
        render: (t) => <span style={{ fontWeight: 700 }}>{fmtNumber(counts.get(t.id) ?? 0)}</span>,
      },
      {
        key: "sort",
        header: "排序",
        align: "right",
        render: (t) => <span style={{ color: "var(--muted)" }}>{t.sort}</span>,
      },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FilterableTable
          rows={tags}
          columns={tagColumns}
          searchText={(t) => t.name}
          searchPlaceholder="搜索标签"
          empty="还没有客户标签"
        />
        {can(viewer, "crm", "修改客户") && (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "16px 20px",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>新建标签</span>
            <ActionForm action={createCustomerTagAction} resetOnSuccess style={{ marginTop: 12 }}>
              <FieldGrid columns={4}>
                <Field label="标签名称" required>
                  <TextInput name="name" placeholder="例如：礼盒偏好" />
                </Field>
                <Field label="文字颜色">
                  <TextInput name="color" defaultValue="#5b6470" />
                </Field>
                <Field label="背景色">
                  <TextInput name="bg" defaultValue="#eef0f2" />
                </Field>
                <Field label="排序">
                  <TextInput name="sort" type="number" defaultValue={0} />
                </Field>
              </FieldGrid>
              <div>
                <SubmitButton variant="secondary" icon="plus">
                  创建标签
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        )}
      </div>
    );
  }

  // ---- 消费记录 ----
  if (view === "records") {
    // 按 customer_id 关联到当前客户集合，而不是靠 order.source 猜是不是零售单。
    const ids = new Set(customers.map((c) => c.id));
    const records = orders.filter((o) => (o.customer_id ? ids.has(o.customer_id) : false));
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
      {
        key: "channel",
        header: "下单渠道",
        render: (o) => <Chip tone={dict.tone("order_channel", o.order_channel)} />,
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
        key: "status",
        header: "状态",
        align: "center",
        render: (o) => <StatusTag tone={dict.tone("order_status", o.status)} />,
      },
      {
        key: "created_at",
        header: "时间",
        render: (o) => <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(o.created_at)}</span>,
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
          canExport ? <ExportForm action={exportCustomersAction} label="导出客户" reason="消费记录导出" /> : null
        }
      />
    );
  }

  // ---- 消费者 / 会员 ----
  // 会员 = 已达到「最低门槛之上」的等级，门槛来自 membership_tiers，不是写死的 level !== "新客"。
  const baseTier = tiers[0];
  const isMembers = view === "members";
  const data = isMembers
    ? customers.filter((c) => (baseTier ? c.tier_id !== baseTier.id : c.level !== "新客"))
    : customers;

  const contactCell = (c: Customer) => (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
      <span style={{ fontSize: 12.5, color: "#4a514c" }}>
        {showFull ? c.email : maskEmail(c.email)}
      </span>
      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
        {showFull ? c.phone : maskPhone(c.phone)}
      </span>
    </div>
  );

  const columns: Column<Customer>[] = isMembers
    ? [
        { key: "customer", header: "会员", render: CustomerCell },
        { key: "level", header: "等级", render: (c) => <Chip tone={tierTone(tiers, c.level)} /> },
        {
          key: "points",
          header: "积分",
          align: "right",
          render: (c) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtNumber(c.points)}</span>,
        },
        {
          key: "growth",
          header: "成长值",
          align: "right",
          render: (c) => (
            <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {fmtNumber(c.growth)}
            </span>
          ),
        },
        {
          key: "orders_count",
          header: "订单数",
          align: "right",
          render: (c) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.orders_count}</span>,
        },
        {
          key: "total_spent",
          header: "累计消费",
          align: "right",
          render: (c) => (
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmtCurrency(c.total_spent)}
            </span>
          ),
        },
        { key: "contact", header: "联系方式", render: contactCell },
      ]
    : [
        { key: "customer", header: "消费者", render: CustomerCell },
        { key: "level", header: "等级", render: (c) => <Chip tone={tierTone(tiers, c.level)} /> },
        {
          key: "orders_count",
          header: "订单数",
          align: "right",
          render: (c) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.orders_count}</span>,
        },
        {
          key: "total_spent",
          header: "累计消费",
          align: "right",
          render: (c) => (
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmtCurrency(c.total_spent)}
            </span>
          ),
        },
        {
          key: "last_order_at",
          header: "最近下单",
          render: (c) => <span style={{ color: "var(--muted)" }}>{fmtDate(c.last_order_at)}</span>,
        },
        {
          key: "last_contacted_at",
          header: "最近跟进",
          render: (c) => (
            <span style={{ color: "var(--muted)" }}>{fmtDate(c.last_contacted_at)}</span>
          ),
        },
        { key: "contact", header: "联系方式", render: contactCell },
        {
          key: "actions",
          header: "操作",
          align: "right",
          render: (c) =>
            can(viewer, "crm", "修改客户") ? (
              <Button
                variant="secondary"
                style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                onClick={() => {
                  setEditing(c);
                  setFormOpen(true);
                }}
              >
                编辑
              </Button>
            ) : null,
        },
      ];

  const filters: FilterDef<Customer>[] = [
    {
      key: "level",
      label: "等级",
      options: tiers.map((t) => ({ value: t.name, label: t.name })),
      match: (c, v) => c.level === v,
    },
    {
      key: "tag",
      label: "标签",
      options: tags.map((t) => ({ value: t.id, label: t.name })),
      match: (c, v) => (tagLinks[c.id] ?? []).includes(v),
    },
  ];

  return (
    <>
      <FilterableTable
        rows={data}
        columns={columns}
        filters={filters}
        searchText={(c) => `${c.name} ${c.email} ${c.country} ${c.phone} ${c.city ?? ""}`}
        searchPlaceholder="搜索消费者 / 邮箱 / 国家"
        initialQuery={query}
        empty={isMembers ? "还没有会员" : "还没有消费者"}
        rightAction={
          <>
            {canExport && <ExportForm action={exportCustomersAction} label="导出记录" reason="客户列表导出" />}
            {canCreate && (
              <Button
                variant="primary"
                icon="plus"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                {isMembers ? "新增会员" : "新增消费者"}
              </Button>
            )}
          </>
        }
      />

      <CustomerFormModal
        open={formOpen}
        customer={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
      <CustomerDetailModal customer={detail} tags={tags} onClose={() => setDetail(null)} />
    </>
  );
}

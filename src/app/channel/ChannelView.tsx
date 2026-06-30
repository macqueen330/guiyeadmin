"use client";

import type { Dealer } from "@/lib/types";
import { DEALER_STATUS, avatarTone, fmtCurrency, type Tone } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import { ModulePlaceholder } from "@/components/ui/ModulePlaceholder";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

const levelTone: Record<string, Tone> = {
  金牌: { text: "金牌", color: "#b07d18", bg: "#fbf4e3" },
  银牌: { text: "银牌", color: "#5b6470", bg: "#eef0f2" },
  标准: { text: "标准", color: "#2b6cb0", bg: "#eef4ff" },
};

const statusOptions = Object.entries(DEALER_STATUS).map(([value, t]) => ({
  value,
  label: t.text,
}));
const levelOptions = ["金牌", "银牌", "标准"].map((value) => ({ value, label: value }));

// Highlight contracts expiring within 60 days of "today" (the prototype date).
const TODAY = new Date("2026-06-20");
const SOON_DAYS = 60;
function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - TODAY.getTime()) / 86_400_000);
}

function DealerCell(d: Dealer) {
  const av = avatarTone(d.name.length);
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
        {d.name[0]}
      </span>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span style={{ fontWeight: 600, color: "#2c322e" }}>{d.name}</span>
        <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{d.region}</span>
      </div>
    </div>
  );
}

const PLACEHOLDERS: Record<string, { title: string; description: string; fields: string[]; icon: "file" | "ticket" | "box" }> = {
  followup: {
    title: "跟进记录",
    description: "记录每一次与渠道客户的沟通，沉淀客户跟进阶段与下一步动作，避免长时间未跟进的客户被遗漏。",
    fields: ["跟进时间", "跟进方式", "客户阶段", "负责人", "下一步计划", "提醒"],
    icon: "file",
  },
  quote: {
    title: "报价管理",
    description: "面向渠道客户的报价单，支持多价格档（经销价 / 团购价 / 企业采购价）与有效期，跟踪报价转化率。",
    fields: ["报价单号", "客户", "产品 / 数量", "价格档", "有效期", "转化状态"],
    icon: "ticket",
  },
  sample: {
    title: "样品寄送",
    description: "管理寄往潜在渠道客户的样品，跟踪物流与客户反馈，衡量样品转化率。",
    fields: ["样品 / 数量", "收件人", "物流单号", "寄送状态", "客户反馈", "是否转化"],
    icon: "box",
  },
};

export function ChannelView({
  dealers,
  view = "clients",
}: {
  dealers: Dealer[];
  view?: string;
}) {
  const ph = PLACEHOLDERS[view];
  if (ph) {
    return (
      <ModulePlaceholder icon={ph.icon} title={ph.title} description={ph.description} fields={ph.fields} />
    );
  }

  const isApply = view === "apply";
  const isContract = view === "contract";
  const data = isApply ? dealers.filter((d) => d.status === "pending") : dealers;

  const clientCols: Column<Dealer>[] = [
    { key: "name", header: "渠道客户", render: DealerCell },
    { key: "contact", header: "联系人", render: (d) => <span style={{ color: "#4a514c" }}>{d.contact}</span> },
    { key: "level", header: "合作等级", render: (d) => <Chip tone={levelTone[d.level]} /> },
    {
      key: "mtd_sales",
      header: "本月进货",
      align: "right",
      render: (d) => (
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(d.mtd_sales)}</span>
      ),
    },
    {
      key: "credit",
      header: "信用 / 欠款",
      align: "right",
      render: (d) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
            {fmtCurrency(d.credit_limit)}
          </span>
          {d.debt > 0 ? (
            <span style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              欠 {fmtCurrency(d.debt)}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
          )}
        </div>
      ),
    },
    { key: "status", header: "状态", align: "center", render: (d) => <StatusTag tone={DEALER_STATUS[d.status]} /> },
  ];

  const applyCols: Column<Dealer>[] = [
    { key: "name", header: "申请客户", render: DealerCell },
    { key: "contact", header: "联系人", render: (d) => <span style={{ color: "#4a514c" }}>{d.contact}</span> },
    { key: "level", header: "拟定等级", render: (d) => <Chip tone={levelTone[d.level]} /> },
    { key: "created_at", header: "申请时间", render: (d) => <span style={{ color: "var(--muted)" }}>{d.created_at}</span> },
    { key: "status", header: "状态", align: "center", render: (d) => <StatusTag tone={DEALER_STATUS[d.status]} /> },
  ];

  const contractCols: Column<Dealer>[] = [
    { key: "name", header: "渠道客户", render: DealerCell },
    { key: "level", header: "合作等级", render: (d) => <Chip tone={levelTone[d.level]} /> },
    {
      key: "contract_end",
      header: "合同到期",
      render: (d) => {
        const soon = daysUntil(d.contract_end) <= SOON_DAYS;
        return (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
            <span style={{ fontSize: 12.5, color: soon ? "#b45309" : "var(--muted)", fontWeight: soon ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>
              {d.contract_end}
            </span>
            {soon && <span style={{ fontSize: 10.5, color: "#b45309" }}>即将到期</span>}
          </div>
        );
      },
    },
    {
      key: "credit_limit",
      header: "信用额度",
      align: "right",
      render: (d) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(d.credit_limit)}</span>
      ),
    },
    { key: "status", header: "合同状态", align: "center", render: (d) => <StatusTag tone={DEALER_STATUS[d.status]} /> },
  ];

  const columns = isApply ? applyCols : isContract ? contractCols : clientCols;
  const filters: FilterDef<Dealer>[] = isApply
    ? []
    : [
        { key: "status", label: "状态", options: statusOptions, match: (d, v) => d.status === v },
        { key: "level", label: "等级", options: levelOptions, match: (d, v) => d.level === v },
      ];

  return (
    <FilterableTable
      rows={data}
      columns={columns}
      filters={filters}
      searchText={(d) => `${d.name} ${d.region} ${d.contact}`}
      searchPlaceholder="搜索渠道客户 / 地区 / 联系人"
      empty={isApply ? "暂无待审核的合作申请" : "暂无渠道客户"}
      rightAction={
        <Button variant="primary" icon="plus">
          {isApply ? "新增申请" : "新增渠道客户"}
        </Button>
      }
    />
  );
}

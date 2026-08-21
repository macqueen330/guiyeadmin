"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusTag, Chip } from "@/components/ui/Tag";
import {
  ActionForm,
  ConfirmSubmit,
  Field,
  FieldGrid,
  Modal,
  ModalFooter,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
  Toggle,
} from "@/components/ui/Form";
import { useViewer } from "@/components/shell/AdminProvider";
import { can } from "@/lib/auth/permissions";
import { fmtCurrency, fmtDateTime } from "@/lib/tokens";
import { DICT_GROUP_NAMES, type DictGroup } from "@/lib/dict";
import type { Settings } from "@/lib/settings";
import type { ApprovalRequest, ApprovalRule, DictEntry, NotificationRule } from "@/lib/types";
import {
  decideApprovalAction,
  saveApprovalRuleAction,
  saveDictEntryAction,
  saveNotificationRuleAction,
  saveSettingsAction,
} from "./actions";

const CHANNEL_LABELS: Record<string, string> = {
  inapp: "站内",
  email: "邮件",
  sms: "短信",
  wecom: "企业微信",
};

// ---------------------------------------------------------------------------
// 消息通知
// ---------------------------------------------------------------------------

export function NotifyPanel({ rules }: { rules: NotificationRule[] }) {
  const viewer = useViewer();
  const canEdit = can(viewer, "system", "设置通知规则");
  const [editing, setEditing] = useState<NotificationRule | null>(null);

  return (
    <>
      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>消息通知</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            待办与异常的提醒开关 · 触发条件与接收人都存在数据库里
          </span>
        </div>
        {rules.length === 0 ? (
          <div style={{ padding: "22px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
            还没有通知规则，请先导入 supabase/seed_reference.sql
          </div>
        ) : (
          <div>
            {rules.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: i === rules.length - 1 ? "none" : "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{r.name}</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {r.description}
                    {Object.keys(r.threshold).length > 0 &&
                      ` · 条件 ${JSON.stringify(r.threshold)}`}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {r.channels.map((c) => (
                      <Chip
                        key={c}
                        tone={{ text: CHANNEL_LABELS[c] ?? c, color: "#4a514c", bg: "var(--bg)" }}
                      />
                    ))}
                  </div>
                  <StatusTag
                    tone={
                      r.enabled
                        ? { text: "已开启", color: "#16894f", bg: "#e9f5ef" }
                        : { text: "已关闭", color: "#6b716d", bg: "#f1f2f0" }
                    }
                  />
                  {canEdit && (
                    <Button
                      variant="secondary"
                      style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                      onClick={() => setEditing(r)}
                    >
                      配置
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="配置通知规则"
        subtitle={editing?.name}
      >
        {editing && (
          <ActionForm
            action={saveNotificationRuleAction}
            hidden={{ event_key: editing.event_key }}
            onSuccess={() => setEditing(null)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Toggle name="enabled" defaultChecked={editing.enabled} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>启用该提醒</span>
            </div>
            <Field label="通知渠道">
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 4 }}>
                {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                  <label
                    key={value}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}
                  >
                    <input
                      type="checkbox"
                      name="channels"
                      value={value}
                      defaultChecked={editing.channels.includes(value)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="触发条件（JSON）" hint='例如 {"days":7} 或 {"overdue_hours":48}'>
              <TextInput name="threshold" defaultValue={JSON.stringify(editing.threshold)} />
            </Field>
            <Field label="接收人" hint="邮箱 / 企业微信 ID，逗号分隔">
              <TextInput name="recipients" defaultValue={editing.recipients.join(",")} />
            </Field>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                取消
              </Button>
              <SubmitButton>保存</SubmitButton>
            </ModalFooter>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// 审批规则 + 我的审批
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  refund: "退款",
  price_change: "修改商品价格",
  stock_adjust: "库存调整",
  export_customers: "导出客户资料",
  order_amount_change: "修改订单金额",
};

export function ApprovalPanel({
  rules,
  requests,
}: {
  rules: ApprovalRule[];
  requests: ApprovalRequest[];
}) {
  const viewer = useViewer();
  const canEditRules = can(viewer, "system", "设置角色");
  const canDecide = viewer.level !== "L3";
  const [editing, setEditing] = useState<ApprovalRule | "new" | null>(null);
  const [deciding, setDeciding] = useState<ApprovalRequest | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>待我审批</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              退款、改价、库存调整、批量导出超过阈值时自动生成
            </span>
          </div>
        </div>
        {requests.length === 0 ? (
          <div style={{ padding: "22px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
            暂无待审批事项
          </div>
        ) : (
          <div>
            {requests.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: i === requests.length - 1 ? "none" : "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{r.title}</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {ACTION_LABELS[r.action_key] ?? r.action_key} · {r.requester_name ?? "—"} ·{" "}
                    {fmtDateTime(r.created_at)}
                    {r.amount !== null && ` · ${fmtCurrency(r.amount)}`}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Chip
                    tone={{
                      text: r.required_level === "L1" ? "需一级审批" : "需二级审批",
                      color: "#b45309",
                      bg: "#fff7ec",
                    }}
                  />
                  {canDecide && (
                    <Button
                      variant="secondary"
                      style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                      onClick={() => setDeciding(r)}
                    >
                      处理
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>审批阈值</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              金额是可比较的数值，直接参与判定（原来是「¥500 – 5,000」这样的中文字符串）
            </span>
          </div>
          {canEditRules && (
            <Button variant="secondary" icon="plus" onClick={() => setEditing("new")}>
              新增规则
            </Button>
          )}
        </div>
        {rules.length === 0 ? (
          <div style={{ padding: "22px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
            还没有审批规则
          </div>
        ) : (
          <div>
            {rules.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "11px 0",
                  borderBottom: i === rules.length - 1 ? "none" : "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {ACTION_LABELS[r.action_key] ?? r.action_key} · {r.name}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {fmtCurrency(r.min_amount)} –{" "}
                    {r.max_amount === null ? "不限" : fmtCurrency(r.max_amount)}
                    {r.note ? ` · ${r.note}` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Chip
                    tone={{
                      text: r.required_level === "L1" ? "一级审批" : "二级审批",
                      color: r.required_level === "L1" ? "#b07d18" : "#2b6cb0",
                      bg: r.required_level === "L1" ? "#fbf4e3" : "#eef4ff",
                    }}
                  />
                  {r.require_2fa && (
                    <Chip tone={{ text: "需二次验证", color: "#c0392b", bg: "#fdf0ef" }} />
                  )}
                  {canEditRules && (
                    <Button
                      variant="secondary"
                      style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                      onClick={() => setEditing(r)}
                    >
                      编辑
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 审批规则编辑 */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing && editing !== "new" ? "编辑审批规则" : "新增审批规则"}
      >
        {editing && (
          <ActionForm
            action={saveApprovalRuleAction}
            hidden={{ id: editing === "new" ? undefined : editing.id }}
            onSuccess={() => setEditing(null)}
          >
            <FieldGrid columns={2}>
              <Field label="动作" required>
                <Select
                  name="action_key"
                  defaultValue={editing === "new" ? "refund" : editing.action_key}
                  options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
                />
              </Field>
              <Field label="规则名称" required>
                <TextInput name="name" defaultValue={editing === "new" ? "" : editing.name} />
              </Field>
            </FieldGrid>
            <FieldGrid columns={3}>
              <Field label="金额下限" required>
                <TextInput
                  name="min_amount"
                  type="number"
                  step="0.01"
                  defaultValue={editing === "new" ? 0 : editing.min_amount}
                />
              </Field>
              <Field label="金额上限" hint="留空表示不限">
                <TextInput
                  name="max_amount"
                  type="number"
                  step="0.01"
                  defaultValue={editing === "new" || editing.max_amount === null ? "" : editing.max_amount}
                />
              </Field>
              <Field label="需要等级" required>
                <Select
                  name="required_level"
                  defaultValue={editing === "new" ? "L2" : editing.required_level}
                  options={[
                    { value: "L2", label: "二级管理员" },
                    { value: "L1", label: "一级管理员" },
                  ]}
                />
              </Field>
            </FieldGrid>
            <Field label="备注">
              <TextInput name="note" defaultValue={editing === "new" ? "" : (editing.note ?? "")} />
            </Field>
            <div style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <Toggle name="require_2fa" defaultChecked={editing !== "new" && editing.require_2fa} />
                需二次验证
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <Toggle name="enabled" defaultChecked={editing === "new" ? true : editing.enabled} />
                启用
              </label>
            </div>
            <input type="hidden" name="sort" value={editing === "new" ? 99 : editing.sort} />
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                取消
              </Button>
              <SubmitButton>保存规则</SubmitButton>
            </ModalFooter>
          </ActionForm>
        )}
      </Modal>

      {/* 审批处理 */}
      <Modal
        open={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        title="处理审批"
        subtitle={deciding?.title}
      >
        {deciding && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 12.5, color: "#4a514c", lineHeight: 1.8 }}>
              <div>申请人：{deciding.requester_name ?? "—"}</div>
              <div>提交时间：{fmtDateTime(deciding.created_at)}</div>
              {deciding.amount !== null && <div>金额：{fmtCurrency(deciding.amount)}</div>}
              <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--muted)", wordBreak: "break-all" }}>
                {JSON.stringify(deciding.payload)}
              </div>
            </div>
            <ActionForm
              action={decideApprovalAction}
              hidden={{ request_id: deciding.id, decision: "approve" }}
              onSuccess={() => setDeciding(null)}
            >
              <Field label="审批意见">
                <TextInput name="note" placeholder="可留空" />
              </Field>
              <ConfirmSubmit message="确认通过该申请？">通过</ConfirmSubmit>
            </ActionForm>
            <div style={{ height: 1, background: "var(--line)" }} />
            <ActionForm
              action={decideApprovalAction}
              hidden={{ request_id: deciding.id, decision: "reject" }}
              onSuccess={() => setDeciding(null)}
            >
              <Field label="驳回原因" required>
                <TextInput name="note" />
              </Field>
              <div>
                <SubmitButton variant="secondary">驳回</SubmitButton>
              </div>
            </ActionForm>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 业务规则（库存 / 客户 / 订单 / 财务 / 分析阈值）
// ---------------------------------------------------------------------------

export function RulesPanel({ settings }: { settings: Settings }) {
  const viewer = useViewer();
  const canEdit = can(viewer, "system", "设置通知规则");

  const groups: {
    category: keyof Settings;
    title: string;
    subtitle: string;
    fields: { key: string; label: string; hint?: string; value: number | string | boolean; type?: "number" | "text" | "bool" }[];
  }[] = [
    {
      category: "inventory",
      title: "库存规则",
      subtitle: "安全库存、预警口径与紧急阈值",
      fields: [
        { key: "inventory.default_safety_stock", label: "默认安全库存", value: settings.inventory.defaultSafetyStock },
        {
          key: "inventory.count_transit",
          label: "低库存计算含在途",
          hint: "开启后 可售+在途 低于安全库存才预警",
          value: settings.inventory.countTransit,
          type: "bool",
        },
        {
          key: "inventory.urgent_ratio",
          label: "紧急预警比例",
          hint: "低于 安全库存×该比例 判定为紧急",
          value: settings.inventory.urgentRatio,
        },
      ],
    },
    {
      category: "crm",
      title: "客户规则",
      subtitle: "跟进节奏与积分有效期",
      fields: [
        { key: "crm.follow_up_days", label: "未跟进天数阈值", value: settings.crm.followUpDays },
        { key: "crm.points_expire_months", label: "积分有效期（月）", value: settings.crm.pointsExpireMonths },
      ],
    },
    {
      category: "orders",
      title: "订单规则",
      subtitle: "超时判定与首页展示",
      fields: [
        { key: "orders.overdue_ship_hours", label: "超时未发货（小时）", value: settings.orders.overdueShipHours },
        { key: "orders.recent_limit", label: "首页最近订单条数", value: settings.orders.recentLimit },
      ],
    },
    {
      category: "finance",
      title: "财务规则",
      subtitle: "币种与金额精度",
      fields: [
        { key: "finance.currency", label: "本位币", value: settings.finance.currency, type: "text" },
        { key: "finance.currency_symbol", label: "货币符号", value: settings.finance.currencySymbol, type: "text" },
        { key: "finance.amount_decimals", label: "金额小数位", value: settings.finance.amountDecimals },
      ],
    },
    {
      category: "analytics",
      title: "分析口径",
      subtitle: "趋势区间、告警线与单品诊断阈值",
      fields: [
        { key: "analytics.default_range_days", label: "趋势默认区间（天）", value: settings.analytics.defaultRangeDays },
        { key: "analytics.bounce_alert", label: "跳出率告警线（%）", value: settings.analytics.bounceAlert },
        { key: "analytics.funnel_good", label: "漏斗健康线（%）", value: settings.analytics.funnelGood },
        { key: "analytics.funnel_warn", label: "漏斗警戒线（%）", value: settings.analytics.funnelWarn },
        { key: "analytics.tz_offset_hours", label: "经营日切时区（UTC+N）", value: settings.analytics.tzOffsetHours },
        {
          key: "analytics.vercel_enabled",
          label: "启用 Vercel Web Analytics",
          value: settings.analytics.vercelEnabled,
          type: "bool",
        },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((g) => (
        <Card key={g.category} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{g.title}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{g.subtitle}</span>
          </div>
          <ActionForm action={saveSettingsAction} hidden={{ category: g.category }}>
            <FieldGrid columns={3}>
              {g.fields.map((f) =>
                f.type === "bool" ? (
                  <div
                    key={f.key}
                    style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end" }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{f.label}</span>
                    <div style={{ height: 38, display: "flex", alignItems: "center" }}>
                      <Toggle name={f.key} defaultChecked={Boolean(f.value)} disabled={!canEdit} />
                    </div>
                    {f.hint && <span style={{ fontSize: 11, color: "var(--muted)" }}>{f.hint}</span>}
                  </div>
                ) : (
                  <Field key={f.key} label={f.label} hint={f.hint}>
                    <TextInput
                      name={f.key}
                      type={f.type === "text" ? "text" : "number"}
                      step="any"
                      defaultValue={String(f.value)}
                      disabled={!canEdit}
                    />
                  </Field>
                ),
              )}
            </FieldGrid>
            {g.category === "analytics" && (
              <Field label="单品诊断阈值（JSON）" hint="点击率 / 详情率 / 加购率 / 支付率的判定线">
                <TextArea
                  name="analytics.product_diagnosis"
                  rows={2}
                  defaultValue={JSON.stringify(settings.analytics.productDiagnosis)}
                  disabled={!canEdit}
                />
              </Field>
            )}
            {canEdit && (
              <div>
                <SubmitButton>保存{g.title}</SubmitButton>
              </div>
            )}
          </ActionForm>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 业务字典
// ---------------------------------------------------------------------------

export function DictPanel({ entries }: { entries: DictEntry[] }) {
  const viewer = useViewer();
  const canEdit = can(viewer, "system", "修改业务字典");
  const [editing, setEditing] = useState<DictEntry | null>(null);

  const groups = new Map<string, DictEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.group_key) ?? [];
    list.push(e);
    groups.set(e.group_key, list);
  }

  if (entries.length === 0) {
    return (
      <Card>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>
          还没有导入业务字典。运行 <code>supabase/seed_reference.sql</code> 后，
          订单状态、支付方式、客户来源等 16 组取值的中文名与配色就可以在这里修改，
          界面会立即跟着变，不需要改代码发版。
        </div>
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[...groups.entries()].map(([group, rows]) => (
          <Card key={group} style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                {DICT_GROUP_NAMES[group as DictGroup] ?? group}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {group} · 共 {rows.length} 个取值
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {rows.map((e) => (
                <button
                  key={e.id}
                  onClick={() => canEdit && setEditing(e)}
                  disabled={!canEdit}
                  title={e.code}
                  style={{
                    border: "1px solid var(--line)",
                    background: e.is_active ? "var(--card)" : "var(--bg)",
                    borderRadius: 8,
                    padding: "5px 4px 5px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: canEdit ? "pointer" : "default",
                    fontFamily: "inherit",
                    opacity: e.is_active ? 1 : 0.55,
                  }}
                >
                  <Chip tone={{ text: e.label, color: e.color, bg: e.bg }} />
                  <span style={{ fontSize: 10.5, color: "var(--muted)", paddingRight: 6 }}>{e.code}</span>
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="编辑字典项"
        subtitle={editing ? `${editing.group_key} · ${editing.code}` : undefined}
      >
        {editing && (
          <ActionForm
            action={saveDictEntryAction}
            hidden={{ id: editing.id }}
            onSuccess={() => setEditing(null)}
          >
            <FieldGrid columns={2}>
              <Field label="显示名称" required>
                <TextInput name="label" defaultValue={editing.label} />
              </Field>
              <Field label="排序">
                <TextInput name="sort" type="number" defaultValue={editing.sort} />
              </Field>
            </FieldGrid>
            <FieldGrid columns={2}>
              <Field label="文字颜色">
                <TextInput name="color" defaultValue={editing.color} />
              </Field>
              <Field label="背景色">
                <TextInput name="bg" defaultValue={editing.bg} />
              </Field>
            </FieldGrid>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <Toggle name="is_active" defaultChecked={editing.is_active} />
              在下拉与筛选中显示
            </label>
            {editing.is_system && (
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                系统内置取值：可以改名与配色，但不能删除（代码里的类型依赖这个取值）。
              </span>
            )}
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                取消
              </Button>
              <SubmitButton>保存</SubmitButton>
            </ModalFooter>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}

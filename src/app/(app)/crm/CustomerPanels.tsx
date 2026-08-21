"use client";

import { useEffect, useState } from "react";
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
  type ServerAction,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Tag";
import { fmtCurrency, fmtDate, fmtDateTime, fmtNumber, maskEmail, maskPhone } from "@/lib/tokens";
import { useViewer } from "@/components/shell/AdminProvider";
import { can } from "@/lib/auth/permissions";
import {
  addFollowUpAction,
  adjustPointsAction,
  createCustomerAction,
  deleteCustomerAction,
  fetchCustomerDetailAction,
  setCustomerTagsAction,
  updateCustomerAction,
  type CustomerDetail,
} from "./actions";
import type { Customer, CustomerTag } from "@/lib/types";

const TYPE_OPTIONS = [
  { value: "individual", label: "个人消费者" },
  { value: "dealer", label: "经销商" },
  { value: "wholesale", label: "批发客户" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "未填写" },
  { value: "wechat", label: "微信" },
  { value: "xhs", label: "小红书" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "fair", label: "展会" },
  { value: "referral", label: "转介绍" },
  { value: "organic", label: "自然搜索" },
];

/** 新建 / 编辑客户。原来「新增消费者」「新增会员」两个按钮都没有 onClick。 */
export function CustomerFormModal({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
}) {
  const editing = Boolean(customer);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "编辑客户资料" : "新增客户"}
      subtitle={editing ? customer?.name : "等级与积分由消费记录自动计算，无需手填"}
      width={640}
    >
      <ActionForm<unknown>
        action={
          (editing ? updateCustomerAction : createCustomerAction) as ServerAction<unknown>
        }
        hidden={{ id: customer?.id }}
        onSuccess={onClose}
      >
        <FieldGrid columns={2}>
          <Field label="姓名 / 名称" required>
            <TextInput name="name" defaultValue={customer?.name ?? ""} />
          </Field>
          <Field label="客户类型">
            <Select name="type" defaultValue={customer?.type ?? "individual"} options={TYPE_OPTIONS} />
          </Field>
        </FieldGrid>
        <FieldGrid columns={2}>
          <Field label="邮箱" hint="邮箱与手机号至少填一项">
            <TextInput name="email" type="email" defaultValue={customer?.email ?? ""} />
          </Field>
          <Field label="手机号">
            <TextInput name="phone" defaultValue={customer?.phone ?? ""} />
          </Field>
        </FieldGrid>
        <FieldGrid columns={3}>
          <Field label="国家 / 地区">
            <TextInput name="country" defaultValue={customer?.country ?? "中国 CN"} />
          </Field>
          <Field label="省 / 直辖市">
            <TextInput name="province" defaultValue={customer?.province ?? ""} />
          </Field>
          <Field label="城市">
            <TextInput name="city" defaultValue={customer?.city ?? ""} />
          </Field>
        </FieldGrid>
        <Field label="地址">
          <TextInput name="address" defaultValue={customer?.address ?? ""} />
        </Field>
        <FieldGrid columns={2}>
          <Field label="来源">
            <Select name="source" defaultValue={customer?.source ?? ""} options={SOURCE_OPTIONS} />
          </Field>
          <Field label="生日" hint="用于生日关怀">
            <TextInput name="birthday" type="date" defaultValue={customer?.birthday ?? ""} />
          </Field>
        </FieldGrid>
        <Field label="备注">
          <TextArea name="remark" rows={2} defaultValue={customer?.remark ?? ""} />
        </Field>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <SubmitButton>{editing ? "保存" : "创建客户"}</SubmitButton>
        </ModalFooter>
      </ActionForm>
    </Modal>
  );
}

/** 客户详情抽屉：消费记录、积分流水、跟进、标签。原来这个模块连详情页都没有。 */
export function CustomerDetailModal({
  customer,
  tags,
  onClose,
}: {
  customer: Customer | null;
  tags: CustomerTag[];
  onClose: () => void;
}) {
  const viewer = useViewer();
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [tab, setTab] = useState<"orders" | "points" | "follow" | "tags">("orders");

  const canAdjustPoints = can(viewer, "crm", "调整积分");
  const canEdit = can(viewer, "crm", "修改客户");
  const canDelete = can(viewer, "crm", "删除客户");

  const load = () => {
    if (!customer) return;
    void fetchCustomerDetailAction(customer.id).then(setDetail);
  };

  // 切换到另一位客户时清空上一位的明细：按 React 的「prop 变化时调整 state」写法
  // 在渲染期重置，而不是在 effect 里 setState（后者会多跑一轮渲染）。
  const [shownFor, setShownFor] = useState(customer);
  if (customer !== shownFor) {
    setShownFor(customer);
    setDetail(null);
    setTab("orders");
  }

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    void fetchCustomerDetailAction(customer.id).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  if (!customer) return null;

  const tabStyle = (on: boolean): React.CSSProperties => ({
    padding: "6px 12px",
    borderRadius: 7,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontFamily: "inherit",
    background: on ? "var(--card)" : "transparent",
    color: on ? "var(--ink)" : "var(--muted)",
    boxShadow: on ? "0 1px 2px rgba(0,0,0,.07)" : "none",
  });

  return (
    <Modal open onClose={onClose} title={customer.name} subtitle={`${customer.country} · ${customer.level}`} width={720}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { label: "累计消费", value: fmtCurrency(customer.total_spent) },
            { label: "订单数", value: fmtNumber(customer.orders_count) },
            { label: "积分余额", value: fmtNumber(customer.points) },
            { label: "成长值", value: fmtNumber(customer.growth) },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--bg)",
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.label}</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{s.value}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12.5, color: "#4a514c", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span>
            邮箱：{viewer.canSeeFullContact ? customer.email : maskEmail(customer.email)}
          </span>
          <span>
            手机：{viewer.canSeeFullContact ? customer.phone : maskPhone(customer.phone)}
          </span>
          <span>最近下单：{fmtDate(customer.last_order_at)}</span>
          <span>最近跟进：{fmtDate(customer.last_contacted_at)}</span>
        </div>

        <div style={{ display: "flex", gap: 2, background: "var(--bg)", padding: 3, borderRadius: 9, width: "fit-content" }}>
          <button style={tabStyle(tab === "orders")} onClick={() => setTab("orders")}>
            消费记录
          </button>
          <button style={tabStyle(tab === "points")} onClick={() => setTab("points")}>
            积分流水
          </button>
          <button style={tabStyle(tab === "follow")} onClick={() => setTab("follow")}>
            跟进
          </button>
          <button style={tabStyle(tab === "tags")} onClick={() => setTab("tags")}>
            标签
          </button>
        </div>

        {!detail && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>加载中…</span>}

        {detail && tab === "orders" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detail.orders.length === 0 ? (
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>该客户还没有订单</span>
            ) : (
              detail.orders.map((o) => (
                <div
                  key={o.order_no}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--line)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{o.order_no}</span>
                  <span style={{ color: "var(--muted)" }}>{fmtDate(o.created_at)}</span>
                  <span style={{ fontWeight: 700 }}>{fmtCurrency(o.amount)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {detail && tab === "points" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {canAdjustPoints && (
              <ActionForm
                action={adjustPointsAction}
                hidden={{ customer_id: customer.id, type: "adjust" }}
                onSuccess={load}
                resetOnSuccess
              >
                <FieldGrid columns={3}>
                  <Field label="调整数量" hint="正数增加，负数扣减" required>
                    <TextInput name="change" type="number" placeholder="例如 100 或 -50" />
                  </Field>
                  <Field label="原因" required span={2}>
                    <TextInput name="reason" placeholder="例如：活动补发 / 兑换扣减" />
                  </Field>
                </FieldGrid>
                <div>
                  <SubmitButton variant="secondary">调整积分</SubmitButton>
                </div>
              </ActionForm>
            )}
            {detail.points.length === 0 ? (
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>暂无积分流水</span>
            ) : (
              detail.points.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "7px 0",
                    borderBottom: "1px solid var(--line)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ color: "#4a514c" }}>{p.reason ?? p.type}</span>
                  <span style={{ color: "var(--muted)" }}>{fmtDateTime(p.created_at)}</span>
                  <span style={{ fontWeight: 700, color: p.change >= 0 ? "#16894f" : "#c0392b", width: 70, textAlign: "right" }}>
                    {p.change >= 0 ? "+" : ""}
                    {p.change}
                  </span>
                  <span style={{ color: "var(--muted)", width: 60, textAlign: "right" }}>
                    余 {p.balance_after}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {detail && tab === "follow" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {canEdit && (
              <ActionForm
                action={addFollowUpAction}
                hidden={{ customer_id: customer.id }}
                onSuccess={load}
                resetOnSuccess
              >
                <FieldGrid columns={2}>
                  <Field label="跟进方式">
                    <Select
                      name="channel"
                      defaultValue="note"
                      options={[
                        { value: "note", label: "备注" },
                        { value: "call", label: "电话" },
                        { value: "wechat", label: "微信" },
                        { value: "email", label: "邮件" },
                        { value: "visit", label: "拜访" },
                      ]}
                    />
                  </Field>
                  <Field label="下次跟进时间">
                    <TextInput name="next_at" type="datetime-local" />
                  </Field>
                </FieldGrid>
                <Field label="跟进内容" required>
                  <TextArea name="content" rows={2} />
                </Field>
                <div>
                  <SubmitButton variant="secondary">记录跟进</SubmitButton>
                </div>
              </ActionForm>
            )}
            {detail.followUps.length === 0 ? (
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>暂无跟进记录</span>
            ) : (
              detail.followUps.map((f) => (
                <div key={f.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 12.5, color: "#2c322e" }}>{f.content}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {f.operator_name ?? "系统"} · {fmtDateTime(f.created_at)}
                    {f.next_at ? ` · 下次 ${fmtDate(f.next_at)}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {detail && tab === "tags" && (
          <ActionForm action={setCustomerTagsAction} hidden={{ customer_id: customer.id }} onSuccess={load}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tags.length === 0 && (
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>还没有标签，先在「客户标签」页创建。</span>
              )}
              {tags.map((t) => (
                <label
                  key={t.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    cursor: "pointer",
                    fontSize: 12.5,
                  }}
                >
                  <input
                    type="checkbox"
                    name="tag_id"
                    value={t.id}
                    defaultChecked={detail.tagIds.includes(t.id)}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <Chip tone={{ text: t.name, color: t.color, bg: t.bg }} />
                </label>
              ))}
            </div>
            {tags.length > 0 && (
              <div>
                <SubmitButton variant="secondary">保存标签</SubmitButton>
              </div>
            )}
          </ActionForm>
        )}

        {canDelete && (
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 12, color: "#c0392b", cursor: "pointer" }}>停用该客户</summary>
            <ActionForm
              action={deleteCustomerAction}
              hidden={{ id: customer.id }}
              onSuccess={onClose}
              style={{ marginTop: 10 }}
            >
              <Field label="停用原因" required>
                <TextInput name="reason" placeholder="例如：客户要求删除资料" />
              </Field>
              <div>
                <ConfirmSubmit message={`确认停用客户「${customer.name}」？历史订单会保留。`} variant="secondary">
                  确认停用
                </ConfirmSubmit>
              </div>
            </ActionForm>
          </details>
        )}
      </div>
    </Modal>
  );
}

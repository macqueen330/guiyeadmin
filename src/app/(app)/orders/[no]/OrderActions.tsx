"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
} from "@/components/ui/Form";
import { useDict } from "@/components/shell/DictProvider";
import { useViewer } from "@/components/shell/AdminProvider";
import { can } from "@/lib/auth/permissions";
import {
  addOrderNoteAction,
  cancelOrderAction,
  changeOrderAmountAction,
  updateOrderItemsAction,
  updateOrderShippingAction,
  updateOrderStatusAction,
} from "../actions";
import type { Order, OrderItem, Warehouse } from "@/lib/types";

// 订单详情页的操作区。
//
// 原来这一整页**没有一个 <button>**：不能改单、取消、确认收款、发货、
// 编辑地址、换仓、加备注。履约时间轴只能看，不能推进。

export function OrderActions({
  order,
  items,
  warehouses,
}: {
  order: Order;
  items: OrderItem[];
  warehouses: Pick<Warehouse, "id" | "name">[];
}) {
  const dict = useDict();
  const viewer = useViewer();
  const [modal, setModal] = useState<null | "amount" | "shipping" | "items" | "cancel" | "note">(null);
  const close = () => setModal(null);

  const canEdit = can(viewer, "orders", "修改订单");
  const canReview = can(viewer, "orders", "审核订单");
  const canCancel = can(viewer, "orders", "取消订单");
  const canChangeAmount = can(viewer, "orders", "修改订单金额");

  const payOptions = dict.filterOptions("pay_status").slice(1);
  const fulfillOptions = dict.filterOptions("fulfill_status").slice(1);
  const settleOptions = dict.filterOptions("settle_status").slice(1);

  const cancelled = Boolean(order.cancelled_at);

  return (
    <Card padding="18px 22px">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>订单操作</span>
        {cancelled && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#c0392b" }}>该订单已取消</span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {/* ---- 三条状态线的直接推进 ---- */}
        {canReview && (
          <ActionForm action={updateOrderStatusAction} hidden={{ order_no: order.order_no, field: "pay_status" }}>
            <FieldGrid columns={2}>
              <Field label="支付状态">
                <Select name="value" defaultValue={order.pay_status} options={payOptions} />
              </Field>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <SubmitButton variant="secondary">更新支付状态</SubmitButton>
              </div>
            </FieldGrid>
          </ActionForm>
        )}

        {canEdit && (
          <ActionForm action={updateOrderStatusAction} hidden={{ order_no: order.order_no, field: "fulfill_status" }}>
            <FieldGrid columns={2}>
              <Field label="履约状态">
                <Select name="value" defaultValue={order.fulfill_status} options={fulfillOptions} />
              </Field>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <SubmitButton variant="secondary">更新履约状态</SubmitButton>
              </div>
            </FieldGrid>
          </ActionForm>
        )}

        {canEdit && (
          <ActionForm action={updateOrderStatusAction} hidden={{ order_no: order.order_no, field: "settle_status" }}>
            <FieldGrid columns={2}>
              <Field label="结算状态">
                <Select name="value" defaultValue={order.settle_status} options={settleOptions} />
              </Field>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <SubmitButton variant="secondary">更新结算状态</SubmitButton>
              </div>
            </FieldGrid>
          </ActionForm>
        )}

        <div style={{ height: 1, background: "var(--line)" }} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canEdit && (
            <Button variant="secondary" icon="edit" onClick={() => setModal("shipping")}>
              收货 / 换仓
            </Button>
          )}
          {canEdit && order.pay_status === "unpaid" && (
            <Button variant="secondary" icon="box" onClick={() => setModal("items")}>
              编辑明细
            </Button>
          )}
          {canChangeAmount && (
            <Button variant="secondary" icon="dollar" onClick={() => setModal("amount")}>
              修改金额
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" icon="file" onClick={() => setModal("note")}>
              添加备注
            </Button>
          )}
          {canCancel && !cancelled && (
            <Button
              variant="secondary"
              icon="alert"
              style={{ color: "#c0392b", borderColor: "#f3d3ce" }}
              onClick={() => setModal("cancel")}
            >
              取消订单
            </Button>
          )}
        </div>
      </div>

      {/* ---- 收货信息 / 换仓 ---- */}
      <Modal open={modal === "shipping"} onClose={close} title="修改收货信息 / 发货仓">
        <ActionForm
          action={updateOrderShippingAction}
          hidden={{ order_no: order.order_no }}
          onSuccess={close}
        >
          <FieldGrid columns={2}>
            <Field label="省 / 直辖市">
              <TextInput name="province" defaultValue={order.province ?? ""} />
            </Field>
            <Field label="城市">
              <TextInput name="city" defaultValue={order.city ?? ""} />
            </Field>
          </FieldGrid>
          <Field label="详细地址">
            <TextInput name="address" defaultValue={order.address ?? ""} />
          </Field>
          <FieldGrid columns={2}>
            <Field label="联系电话">
              <TextInput name="contact_phone" defaultValue={order.contact_phone ?? ""} />
            </Field>
            <Field label="发货仓">
              <Select
                name="warehouse_id"
                defaultValue={order.warehouse_id ?? ""}
                options={[
                  { value: "", label: "保持不变" },
                  ...warehouses.map((w) => ({ value: w.id, label: w.name })),
                ]}
              />
            </Field>
          </FieldGrid>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={close}>
              取消
            </Button>
            <SubmitButton>保存</SubmitButton>
          </ModalFooter>
        </ActionForm>
      </Modal>

      {/* ---- 明细数量 ---- */}
      <Modal
        open={modal === "items"}
        onClose={close}
        title="编辑商品明细"
        subtitle="数量填 0 表示删除该行；应付金额会自动重算"
      >
        <ActionForm action={updateOrderItemsAction} hidden={{ order_no: order.order_no }} onSuccess={close}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((it) => (
              <div
                key={it.id}
                style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10, alignItems: "center" }}
              >
                <input type="hidden" name="item_id" value={it.id} />
                <span style={{ fontSize: 12.5 }}>
                  {it.product_name}
                  <span style={{ color: "var(--muted)" }}> · {it.sku_code}</span>
                </span>
                <TextInput name="item_qty" type="number" min={0} defaultValue={it.qty} />
              </div>
            ))}
            {items.length === 0 && (
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>该订单还没有明细行。</span>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={close}>
              取消
            </Button>
            <SubmitButton>保存明细</SubmitButton>
          </ModalFooter>
        </ActionForm>
      </Modal>

      {/* ---- 修改金额（走审批阈值）---- */}
      <Modal
        open={modal === "amount"}
        onClose={close}
        title="修改订单金额"
        subtitle="超过审批阈值时会自动生成审批单，而不是直接改数"
      >
        <ActionForm action={changeOrderAmountAction} hidden={{ order_no: order.order_no }} onSuccess={close}>
          <FieldGrid columns={2}>
            <Field label="新的应付金额" required>
              <TextInput name="amount" type="number" step="0.01" min={0} defaultValue={order.amount} />
            </Field>
            <Field label="当前应付">
              <div style={{ height: 38, display: "flex", alignItems: "center", fontSize: 13 }}>
                {order.amount}
              </div>
            </Field>
          </FieldGrid>
          <Field label="修改原因" required>
            <TextArea name="reason" rows={2} placeholder="例如：客户协商减免运费" />
          </Field>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={close}>
              取消
            </Button>
            <ConfirmSubmit message={`确认把订单 ${order.order_no} 的金额改掉？该操作会留痕。`}>
              提交
            </ConfirmSubmit>
          </ModalFooter>
        </ActionForm>
      </Modal>

      {/* ---- 备注 ---- */}
      <Modal open={modal === "note"} onClose={close} title="添加订单备注">
        <ActionForm action={addOrderNoteAction} hidden={{ order_no: order.order_no }} onSuccess={close}>
          <Field label="备注内容" required>
            <TextArea name="note" rows={3} />
          </Field>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={close}>
              取消
            </Button>
            <SubmitButton>保存备注</SubmitButton>
          </ModalFooter>
        </ActionForm>
      </Modal>

      {/* ---- 取消订单 ---- */}
      <Modal open={modal === "cancel"} onClose={close} title="取消订单" subtitle="已收款的订单需要先发起退款">
        <ActionForm action={cancelOrderAction} hidden={{ order_no: order.order_no }} onSuccess={close}>
          <Field label="取消原因" required>
            <TextArea name="reason" rows={3} placeholder="例如：客户取消 / 无货" />
          </Field>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={close}>
              返回
            </Button>
            <ConfirmSubmit message={`确认取消订单 ${order.order_no}？`}>确认取消</ConfirmSubmit>
          </ModalFooter>
        </ActionForm>
      </Modal>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  ActionForm,
  Field,
  FieldGrid,
  Modal,
  ModalFooter,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useDict } from "@/components/shell/DictProvider";
import { fmtCurrency } from "@/lib/tokens";
import { createOrderAction } from "./actions";
import type { Customer, PriceTier, Product, Warehouse } from "@/lib/types";

// 新建订单。原来「新建订单」按钮只是 setOpen(true) 展开一个菜单，
// 菜单里 5 个订单类型的 onClick 只做 setOpen(false) —— 什么也不会发生。

export interface OrderFormRefs {
  customers: Pick<Customer, "id" | "name" | "country" | "province" | "city" | "phone">[];
  products: Pick<Product, "id" | "name" | "sku_code" | "price">[];
  warehouses: Pick<Warehouse, "id" | "name">[];
  priceTiers: PriceTier[];
}

interface Line {
  key: number;
  productId: string;
  qty: number;
  price: number;
}

export function OrderCreateModal({
  open,
  onClose,
  refs,
  defaultType = "retail",
}: {
  open: boolean;
  onClose: () => void;
  refs: OrderFormRefs;
  defaultType?: string;
}) {
  const dict = useDict();
  const [lines, setLines] = useState<Line[]>([{ key: 1, productId: "", qty: 1, price: 0 }]);
  const [freight, setFreight] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState("");

  const productById = useMemo(
    () => new Map(refs.products.map((p) => [p.id, p])),
    [refs.products],
  );
  const customer = refs.customers.find((c) => c.id === customerId);

  const goods = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const total = Math.max(0, goods + freight - discount);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((ls) => [...ls, { key: Math.max(0, ...ls.map((l) => l.key)) + 1, productId: "", qty: 1, price: 0 }]);

  const removeLine = (key: number) =>
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.key !== key)));

  const reset = () => {
    setLines([{ key: 1, productId: "", qty: 1, price: 0 }]);
    setFreight(0);
    setDiscount(0);
    setCustomerId("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建订单"
      subtitle="保存后订单号自动生成，状态由支付 / 履约 / 结算三条线派生"
      width={720}
    >
      <ActionForm
        action={createOrderAction}
        onSuccess={() => {
          reset();
          onClose();
        }}
      >
        <FieldGrid columns={3}>
          <Field label="客户" required span={2}>
            <Select
              name="customer_id"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={[
                { value: "", label: "选择已有客户（可留空手填）" },
                ...refs.customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.country}` })),
              ]}
            />
          </Field>
          <Field label="订单类型" required>
            <Select name="order_type" defaultValue={defaultType} options={dict.filterOptions("order_type").slice(1)} />
          </Field>
        </FieldGrid>

        <FieldGrid columns={3}>
          <Field label="客户名称" required hint="留空则使用上面选中的客户">
            <TextInput name="customer_name" defaultValue="" key={customerId} placeholder={customer?.name ?? "客户名称"} />
          </Field>
          <Field label="国家 / 地区">
            <TextInput name="country" defaultValue={customer?.country ?? "中国 CN"} key={`c-${customerId}`} />
          </Field>
          <Field label="联系电话">
            <TextInput name="contact_phone" defaultValue={customer?.phone ?? ""} key={`p-${customerId}`} />
          </Field>
        </FieldGrid>

        <FieldGrid columns={3}>
          <Field label="下单渠道">
            <Select
              name="order_channel"
              defaultValue="backend"
              options={dict.filterOptions("order_channel").slice(1)}
            />
          </Field>
          <Field label="客户来源">
            <Select
              name="customer_source"
              defaultValue="organic"
              options={dict.filterOptions("customer_source").slice(1)}
            />
          </Field>
          <Field label="支付方式">
            <Select
              name="payment_method"
              defaultValue="unpaid"
              options={dict.filterOptions("payment_method").slice(1)}
            />
          </Field>
        </FieldGrid>

        <FieldGrid columns={3}>
          <Field label="发货仓">
            <Select
              name="warehouse_id"
              options={[
                { value: "", label: "稍后分配" },
                ...refs.warehouses.map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
          </Field>
          <Field label="省 / 直辖市">
            <TextInput name="province" defaultValue={customer?.province ?? ""} key={`pr-${customerId}`} />
          </Field>
          <Field label="城市">
            <TextInput name="city" defaultValue={customer?.city ?? ""} key={`ci-${customerId}`} />
          </Field>
        </FieldGrid>

        <Field label="收货地址">
          <TextInput name="address" placeholder="街道 / 门牌" />
        </Field>

        {/* ---- 商品明细 ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>商品明细</span>
            <button
              type="button"
              onClick={addLine}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                border: "1px solid var(--line)",
                background: "var(--card)",
                borderRadius: 8,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                color: "#3a403c",
              }}
            >
              <Icon name="plus" size={12} /> 添加一行
            </button>
          </div>

          {lines.map((l) => (
            <div
              key={l.key}
              style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 34px", gap: 8, alignItems: "center" }}
            >
              <Select
                name="item_product_id"
                value={l.productId}
                onChange={(e) => {
                  const p = productById.get(e.target.value);
                  setLine(l.key, { productId: e.target.value, price: p ? p.price : 0 });
                }}
                options={[
                  { value: "", label: "选择商品" },
                  ...refs.products.map((p) => ({ value: p.id, label: `${p.name}（${p.sku_code}）` })),
                ]}
              />
              <TextInput
                name="item_qty"
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) => setLine(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
              />
              <TextInput
                name="item_price"
                type="number"
                step="0.01"
                min={0}
                value={l.price}
                onChange={(e) => setLine(l.key, { price: Number(e.target.value) || 0 })}
              />
              <button
                type="button"
                onClick={() => removeLine(l.key)}
                aria-label="删除该行"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  borderRadius: 8,
                  height: 38,
                  cursor: lines.length === 1 ? "not-allowed" : "pointer",
                  color: "var(--muted)",
                  opacity: lines.length === 1 ? 0.4 : 1,
                }}
                disabled={lines.length === 1}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <FieldGrid columns={3}>
          <Field label="运费">
            <TextInput
              name="freight_fee"
              type="number"
              step="0.01"
              value={freight}
              onChange={(e) => setFreight(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="优惠">
            <TextInput
              name="discount"
              type="number"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="应付合计">
            <div
              style={{
                height: 38,
                display: "flex",
                alignItems: "center",
                fontSize: 16,
                fontWeight: 800,
                color: "var(--accent)",
              }}
            >
              {fmtCurrency(total, { decimals: 2 })}
            </div>
          </Field>
        </FieldGrid>

        <Field label="备注">
          <TextArea name="remark" rows={2} />
        </Field>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <SubmitButton>创建订单</SubmitButton>
        </ModalFooter>
      </ActionForm>
    </Modal>
  );
}

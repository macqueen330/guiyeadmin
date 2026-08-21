"use client";

import { useState } from "react";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ActionForm,
  ExportForm,
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
import { fmtCurrency, fmtDate, fmtDateTime, fmtNumber, fmtPercent, ratio, type Tone } from "@/lib/tokens";
import {
  createInventoryMoveAction,
  createProductAction,
  exportInventoryAction,
  savePriceTierAction,
  setProductPriceAction,
  toggleProductStatusAction,
  updateProductAction,
} from "./actions";
import type {
  InventoryMove,
  PriceTier,
  ProductCategory,
  ProductPrice,
  Warehouse,
} from "@/lib/types";

export interface InventoryRowView {
  id: string;
  name: string;
  sku_code: string;
  category: string;
  category_id: string | null;
  price: number;
  cost: number;
  safety_stock: number;
  status: "active" | "draft" | "archived";
  unit: string;
  spec: string | null;
  sellable: number;
  locked: number;
  transit: number;
  low: boolean;
  urgent: boolean;
  /** 缺口 = 安全库存 − 可售（可配置为是否计入在途） */
  gap: number;
}

const statusTone: Record<InventoryRowView["status"], Tone> = {
  active: { text: "上架", color: "#16894f", bg: "#e9f5ef" },
  draft: { text: "草稿", color: "#6b716d", bg: "#f1f2f0" },
  archived: { text: "下架", color: "#c0392b", bg: "#fdf0ef" },
};

const statusOptions = Object.entries(statusTone).map(([value, t]) => ({ value, label: t.text }));

export function InventoryView({
  rows,
  view = "products",
  tiers,
  prices,
  categories,
  warehouses,
  moves,
  countTransit,
  query,
}: {
  rows: InventoryRowView[];
  view?: string;
  tiers: PriceTier[];
  /** SKU × 档位的真实价格（product_prices），缺失时回落到档位默认倍率 */
  prices: ProductPrice[];
  categories: ProductCategory[];
  warehouses: Pick<Warehouse, "id" | "name">[];
  moves: InventoryMove[];
  countTransit: boolean;
  /** 全局搜索跳转过来时的初始关键词 */
  query?: string;
}) {
  const viewer = useViewer();
  const [productModal, setProductModal] = useState<InventoryRowView | "new" | null>(null);
  const [priceTarget, setPriceTarget] = useState<InventoryRowView | null>(null);
  const [tierModal, setTierModal] = useState<PriceTier | "new" | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  const canCreate = can(viewer, "inventory", "新建商品");
  const canEdit = can(viewer, "inventory", "修改商品");
  const canPrice = can(viewer, "inventory", "修改价格");
  const canStock = can(viewer, "inventory", "调整库存");
  const canSeeCost = can(viewer, "inventory", "查看成本");

  // 档位价：优先取 product_prices 里的真实价格；没有维护过的档位才回落到
  // 「零售价 × price_tiers.default_factor」，并在界面上标注「按默认倍率」。
  const priceFor = (row: InventoryRowView, tier: PriceTier) => {
    const hit = prices.find(
      (p) => p.product_id === row.id && p.tier_id === tier.id && p.min_qty <= 1,
    );
    if (hit) return { value: hit.price, derived: false };
    return { value: Math.round(row.price * tier.default_factor * 100) / 100, derived: true };
  };

  const nameCol: Column<InventoryRowView> = {
    key: "name",
    header: "商品",
    render: (r) => (
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
        <span style={{ fontWeight: 600, color: "#2c322e" }}>{r.name}</span>
        {r.spec && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{r.spec}</span>}
      </div>
    ),
  };
  const skuCol: Column<InventoryRowView> = {
    key: "sku_code",
    header: "SKU",
    render: (r) => (
      <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{r.sku_code}</span>
    ),
  };

  function numCol(
    key: string,
    header: string,
    pick: (r: InventoryRowView) => number,
    opts: { low?: boolean; muted?: boolean } = {},
  ): Column<InventoryRowView> {
    return {
      key,
      header,
      align: "right",
      render: (r) => (
        <span
          style={{
            color: opts.low && r.low ? "#c0392b" : opts.muted ? "var(--muted)" : undefined,
            fontWeight: opts.low ? 700 : 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtNumber(pick(r))}
        </span>
      ),
    };
  }

  const statusCol: Column<InventoryRowView> = {
    key: "status",
    header: "状态",
    align: "center",
    render: (r) => <StatusTag tone={statusTone[r.status]} />,
  };

  const actionCol: Column<InventoryRowView> = {
    key: "actions",
    header: "操作",
    align: "right",
    render: (r) => (
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        {canEdit && (
          <Button
            variant="secondary"
            style={{ height: 28, padding: "0 10px", fontSize: 12 }}
            onClick={() => setProductModal(r)}
          >
            编辑
          </Button>
        )}
        {can(viewer, "inventory", "商品上下架") && (
          <ActionForm
            action={toggleProductStatusAction}
            hidden={{ id: r.id, status: r.status === "active" ? "archived" : "active" }}
            style={{ gap: 0 }}
          >
            <SubmitButton variant="secondary" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
              {r.status === "active" ? "下架" : "上架"}
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    ),
  };

  const COLUMNS: Record<string, Column<InventoryRowView>[]> = {
    products: [
      nameCol,
      skuCol,
      {
        key: "category",
        header: "分类",
        render: (r) => <Chip tone={{ text: r.category || "未分类", color: "#4a514c", bg: "var(--bg)" }} />,
      },
      {
        key: "price",
        header: "零售价",
        align: "right",
        render: (r) => (
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {fmtCurrency(r.price, { decimals: 2 })}
          </span>
        ),
      },
      ...(canSeeCost
        ? [
            {
              key: "cost",
              header: "成本",
              align: "right" as const,
              render: (r: InventoryRowView) => (
                <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtCurrency(r.cost, { decimals: 2 })}
                </span>
              ),
            },
            {
              key: "margin",
              header: "毛利率",
              align: "right" as const,
              // 原实现没有 price = 0 的保护，会渲染出 Infinity% / NaN%。
              render: (r: InventoryRowView) => (
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmtPercent(ratio(r.price - r.cost, r.price))}
                </span>
              ),
            },
          ]
        : []),
      numCol("sellable", "可售", (r) => r.sellable, { low: true }),
      statusCol,
      actionCol,
    ],
    pricing: [
      nameCol,
      skuCol,
      ...tiers
        .filter((t) => t.is_active)
        .map(
          (t): Column<InventoryRowView> => ({
            key: t.id,
            header: t.name,
            align: "right",
            render: (r) => {
              const { value, derived } = priceFor(r, t);
              return (
                <span
                  title={derived ? `未单独定价，按默认倍率 ×${t.default_factor}` : "已单独定价"}
                  style={{
                    fontWeight: derived ? 500 : 700,
                    color: derived ? "var(--muted)" : "#2c322e",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtCurrency(value, { decimals: 2 })}
                  {derived && <span style={{ fontSize: 10, marginLeft: 3 }}>*</span>}
                </span>
              );
            },
          }),
        ),
      {
        key: "actions",
        header: "操作",
        align: "right",
        render: (r) =>
          canPrice ? (
            <Button
              variant="secondary"
              style={{ height: 28, padding: "0 10px", fontSize: 12 }}
              onClick={() => setPriceTarget(r)}
            >
              设置档位价
            </Button>
          ) : null,
      },
    ],
    stock: [
      nameCol,
      skuCol,
      numCol("sellable", "可售", (r) => r.sellable, { low: true }),
      numCol("locked", "锁定", (r) => r.locked, { muted: true }),
      numCol("transit", "在途", (r) => r.transit, { muted: true }),
      numCol("safety", "安全库存", (r) => r.safety_stock, { muted: true }),
      {
        key: "gap",
        header: "缺口",
        align: "right",
        render: (r) =>
          r.gap > 0 ? (
            <span style={{ color: "#c0392b", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmtNumber(r.gap)}
            </span>
          ) : (
            <span style={{ color: "var(--muted)" }}>—</span>
          ),
      },
      statusCol,
    ],
    alerts: [
      nameCol,
      skuCol,
      numCol("sellable", "可售", (r) => r.sellable, { low: true }),
      numCol("transit", "在途", (r) => r.transit, { muted: true }),
      numCol("safety", "安全库存", (r) => r.safety_stock, { muted: true }),
      {
        key: "gap",
        // 缺口口径由 inventory.count_transit 决定，直接写在表头，
        // 避免「为什么这个 SKU 不算缺货」要去翻设置才知道。
        header: countTransit ? "补货缺口（含在途）" : "补货缺口（不含在途）",
        align: "right",
        render: (r) => (
          <span style={{ color: "#c0392b", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {fmtNumber(Math.max(0, r.gap))}
          </span>
        ),
      },
      {
        key: "level",
        header: "预警级别",
        align: "center",
        // 原来只有一档（低于安全库存）；现在按 inventory.urgent_ratio 分紧急 / 一般。
        render: (r) => (
          <StatusTag
            tone={
              r.urgent
                ? { text: "紧急", color: "#c0392b", bg: "#fdf0ef" }
                : { text: "一般", color: "#b45309", bg: "#fff7ec" }
            }
          />
        ),
      },
    ],
  };

  // ---- 入库出库 ----
  if (view === "moves") {
    const moveColumns: Column<InventoryMove>[] = [
      {
        key: "move_no",
        header: "单据号",
        render: (m) => (
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{m.move_no}</span>
        ),
      },
      {
        key: "type",
        header: "类型",
        render: (m) => (
          <Chip
            tone={
              {
                in: { text: "入库", color: "#16894f", bg: "#e9f5ef" },
                out: { text: "出库", color: "#c2703d", bg: "#fff5ec" },
                transfer: { text: "调拨", color: "#2b6cb0", bg: "#eef4ff" },
                adjust: { text: "盘点", color: "#8a6fb0", bg: "#f4f0fa" },
              }[m.type]
            }
          />
        ),
      },
      {
        key: "product",
        header: "商品",
        render: (m) => {
          const p = rows.find((r) => r.id === m.product_id);
          return <span style={{ color: "#2c322e" }}>{p ? `${p.name}（${p.sku_code}）` : m.product_id}</span>;
        },
      },
      {
        key: "warehouse",
        header: "仓库",
        render: (m) => {
          const w = warehouses.find((x) => x.id === m.warehouse_id);
          const to = m.to_warehouse_id ? warehouses.find((x) => x.id === m.to_warehouse_id) : null;
          return (
            <span style={{ color: "#4a514c" }}>
              {w?.name ?? m.warehouse_id}
              {to ? ` → ${to.name}` : ""}
            </span>
          );
        },
      },
      {
        key: "qty",
        header: "数量",
        align: "right",
        render: (m) => (
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtNumber(m.qty)}</span>
        ),
      },
      {
        key: "stock",
        header: "变动前 → 后",
        align: "right",
        render: (m) => (
          <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
            {m.before_sellable ?? "—"} → {m.after_sellable ?? "—"}
          </span>
        ),
      },
      { key: "reason", header: "原因", render: (m) => <span style={{ color: "#4a514c" }}>{m.reason ?? "—"}</span> },
      {
        key: "operator",
        header: "经办人 / 时间",
        render: (m) => (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
            <span style={{ fontSize: 12.5 }}>{m.operator_name ?? "—"}</span>
            <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{fmtDateTime(m.occurred_at)}</span>
          </div>
        ),
      },
    ];

    return (
      <>
        <FilterableTable
          rows={moves}
          columns={moveColumns}
          filters={[
            {
              key: "type",
              label: "类型",
              options: [
                { value: "in", label: "入库" },
                { value: "out", label: "出库" },
                { value: "transfer", label: "调拨" },
                { value: "adjust", label: "盘点" },
              ],
              match: (m, v) => m.type === v,
            },
          ]}
          searchText={(m) => `${m.move_no} ${m.reason ?? ""} ${m.ref_no ?? ""}`}
          searchPlaceholder="搜索单据号 / 原因"
          empty="还没有出入库记录。库存的每一次变动都会在这里留下单据。"
          rightAction={
            canStock ? (
              <Button variant="primary" icon="plus" onClick={() => setMoveOpen(true)}>
                新建单据
              </Button>
            ) : null
          }
        />
        <MoveModal
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          rows={rows}
          warehouses={warehouses}
        />
      </>
    );
  }

  const data =
    view === "alerts" ? rows.filter((r) => r.low) : view === "pricing" ? rows : rows;

  const filters: FilterDef<InventoryRowView>[] = [
    {
      key: "category",
      label: "分类",
      options: categories.map((c) => ({ value: c.name, label: c.name })),
      match: (r, v) => r.category === v,
    },
    ...(view === "products"
      ? [
          {
            key: "status",
            label: "状态",
            options: statusOptions,
            match: (r: InventoryRowView, v: string) => r.status === v,
          },
        ]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {view === "pricing" && (
        <Card padding="14px 20px">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>
              标 <b>*</b> 的价格未单独维护，按档位默认倍率由零售价推算；点「设置档位价」写入真实价格
              （支持阶梯量价与生效时间，历史价格保留可追溯）。
            </span>
            {canPrice && (
              <Button
                variant="secondary"
                icon="plus"
                style={{ marginLeft: "auto" }}
                onClick={() => setTierModal("new")}
              >
                新增价格档位
              </Button>
            )}
          </div>
          {tiers.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {tiers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => canPrice && setTierModal(t)}
                  style={{
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    borderRadius: 8,
                    padding: "5px 10px",
                    fontSize: 11.5,
                    fontFamily: "inherit",
                    cursor: canPrice ? "pointer" : "default",
                    color: t.is_active ? "#3a403c" : "var(--muted)",
                  }}
                >
                  {t.name} · ×{t.default_factor}
                  {!t.is_active && " · 已停用"}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <FilterableTable
        rows={data}
        columns={COLUMNS[view] ?? COLUMNS.products}
        filters={filters}
        searchText={(r) => `${r.name} ${r.sku_code} ${r.category}`}
        searchPlaceholder="搜索商品 / SKU / 分类"
        initialQuery={query}
        empty={view === "alerts" ? "全部 SKU 都高于安全库存" : "还没有商品"}
        rightAction={
          <>
            <ExportForm action={exportInventoryAction} label="导出" reason="库存导出" />
            {canCreate && view !== "pricing" && (
              <Button variant="primary" icon="plus" onClick={() => setProductModal("new")}>
                新增商品
              </Button>
            )}
          </>
        }
      />

      <ProductModal
        target={productModal}
        categories={categories}
        onClose={() => setProductModal(null)}
      />
      <PriceModal
        row={priceTarget}
        tiers={tiers}
        prices={prices}
        onClose={() => setPriceTarget(null)}
      />
      <TierModal target={tierModal} onClose={() => setTierModal(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProductModal({
  target,
  categories,
  onClose,
}: {
  target: InventoryRowView | "new" | null;
  categories: ProductCategory[];
  onClose: () => void;
}) {
  const editing = target && target !== "new" ? target : null;
  if (!target) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "编辑商品" : "新增商品"}
      subtitle={editing?.sku_code}
      width={640}
    >
      <ActionForm
        action={editing ? updateProductAction : createProductAction}
        hidden={{ id: editing?.id, price_changed: editing ? "true" : "false" }}
        onSuccess={onClose}
      >
        <FieldGrid columns={2}>
          <Field label="SKU 编码" required>
            <TextInput name="sku_code" defaultValue={editing?.sku_code ?? ""} />
          </Field>
          <Field label="商品名称" required>
            <TextInput name="name" defaultValue={editing?.name ?? ""} />
          </Field>
        </FieldGrid>
        <FieldGrid columns={3}>
          <Field label="分类">
            <Select
              name="category_id"
              defaultValue={editing?.category_id ?? ""}
              options={[
                { value: "", label: "未分类" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </Field>
          <Field label="单位">
            <TextInput name="unit" defaultValue={editing?.unit ?? "瓶"} />
          </Field>
          <Field label="规格">
            <TextInput name="spec" defaultValue={editing?.spec ?? ""} />
          </Field>
        </FieldGrid>
        <FieldGrid columns={4}>
          <Field label="零售价" required>
            <TextInput name="price" type="number" step="0.01" defaultValue={editing?.price ?? ""} />
          </Field>
          <Field label="成本">
            <TextInput name="cost" type="number" step="0.01" defaultValue={editing?.cost ?? ""} />
          </Field>
          <Field label="安全库存">
            <TextInput name="safety_stock" type="number" defaultValue={editing?.safety_stock ?? 0} />
          </Field>
          <Field label="税率" hint="0.13 = 13%">
            <TextInput name="tax_rate" type="number" step="0.01" defaultValue={0.13} />
          </Field>
        </FieldGrid>
        <FieldGrid columns={3}>
          <Field label="状态">
            <Select name="status" defaultValue={editing?.status ?? "draft"} options={statusOptions} />
          </Field>
          <Field label="条码">
            <TextInput name="barcode" />
          </Field>
          <Field label="排序">
            <TextInput name="sort" type="number" defaultValue={0} />
          </Field>
        </FieldGrid>
        <Field label="商品描述">
          <TextArea name="description" rows={2} />
        </Field>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <SubmitButton>{editing ? "保存" : "创建商品"}</SubmitButton>
        </ModalFooter>
      </ActionForm>
    </Modal>
  );
}

function PriceModal({
  row,
  tiers,
  prices,
  onClose,
}: {
  row: InventoryRowView | null;
  tiers: PriceTier[];
  prices: ProductPrice[];
  onClose: () => void;
}) {
  if (!row) return null;
  const mine = prices.filter((p) => p.product_id === row.id);

  return (
    <Modal
      open
      onClose={onClose}
      title="设置档位价"
      subtitle={`${row.name} · 零售价 ${fmtCurrency(row.price, { decimals: 2 })}`}
      width={600}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ActionForm action={setProductPriceAction} hidden={{ product_id: row.id }} onSuccess={onClose}>
          <FieldGrid columns={2}>
            <Field label="价格档位" required>
              <Select
                name="tier_id"
                options={tiers
                  .filter((t) => t.is_active)
                  .map((t) => ({ value: t.id, label: `${t.name}（默认 ×${t.default_factor}）` }))}
              />
            </Field>
            <Field label="价格" required>
              <TextInput name="price" type="number" step="0.01" min={0.01} />
            </Field>
          </FieldGrid>
          <FieldGrid columns={3}>
            <Field label="起订量" hint="阶梯量价">
              <TextInput name="min_qty" type="number" min={1} defaultValue={1} />
            </Field>
            <Field label="生效时间">
              <TextInput name="valid_from" type="datetime-local" />
            </Field>
            <Field label="失效时间" hint="留空表示长期有效">
              <TextInput name="valid_to" type="datetime-local" />
            </Field>
          </FieldGrid>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              取消
            </Button>
            <SubmitButton>保存价格</SubmitButton>
          </ModalFooter>
        </ActionForm>

        {mine.length > 0 && (
          <div>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>已维护的档位价</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {mine.map((p) => {
                const tier = tiers.find((t) => t.id === p.tier_id);
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      fontSize: 12.5,
                      padding: "6px 0",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <span>{tier?.name ?? p.tier_id}</span>
                    <span style={{ color: "var(--muted)" }}>≥{p.min_qty} 件</span>
                    <span style={{ fontWeight: 700 }}>{fmtCurrency(p.price, { decimals: 2 })}</span>
                    <span style={{ color: "var(--muted)" }}>{fmtDate(p.valid_from)} 起</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TierModal({ target, onClose }: { target: PriceTier | "new" | null; onClose: () => void }) {
  const editing = target && target !== "new" ? target : null;
  if (!target) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "编辑价格档位" : "新增价格档位"}
      subtitle="默认倍率用于未单独定价的 SKU —— 原来这些倍率写死在组件里"
    >
      <ActionForm action={savePriceTierAction} hidden={{ id: editing?.id }} onSuccess={onClose}>
        <FieldGrid columns={2}>
          <Field label="档位代码" required hint="英文，如 member / dealer">
            <TextInput name="code" defaultValue={editing?.code ?? ""} />
          </Field>
          <Field label="档位名称" required>
            <TextInput name="name" defaultValue={editing?.name ?? ""} />
          </Field>
        </FieldGrid>
        <FieldGrid columns={3}>
          <Field label="默认倍率" required hint="相对零售价">
            <TextInput
              name="default_factor"
              type="number"
              step="0.01"
              min={0.01}
              max={5}
              defaultValue={editing?.default_factor ?? 1}
            />
          </Field>
          <Field label="币种">
            <TextInput name="currency" defaultValue={editing?.currency ?? "CNY"} />
          </Field>
          <Field label="排序">
            <TextInput name="sort" type="number" defaultValue={editing?.sort ?? 0} />
          </Field>
        </FieldGrid>
        <div style={{ display: "flex", gap: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <Toggle name="requires_approval" defaultChecked={editing?.requires_approval ?? false} />
            改价需审批
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <Toggle name="is_active" defaultChecked={editing?.is_active ?? true} />
            启用
          </label>
        </div>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <SubmitButton>保存档位</SubmitButton>
        </ModalFooter>
      </ActionForm>
    </Modal>
  );
}

function MoveModal({
  open,
  onClose,
  rows,
  warehouses,
}: {
  open: boolean;
  onClose: () => void;
  rows: InventoryRowView[];
  warehouses: Pick<Warehouse, "id" | "name">[];
}) {
  const [type, setType] = useState("in");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建出入库单据"
      subtitle="库存只能通过单据变动，每一次变动都会留下前后数量与经办人"
    >
      <ActionForm action={createInventoryMoveAction} onSuccess={onClose} resetOnSuccess>
        <FieldGrid columns={2}>
          <Field label="单据类型" required>
            <Select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { value: "in", label: "入库（采购 / 退货入库）" },
                { value: "out", label: "出库（销售 / 领用）" },
                { value: "transfer", label: "调拨（仓间转移）" },
                { value: "adjust", label: "盘点（直接设为盘后数量）" },
              ]}
            />
          </Field>
          <Field label="数量" required hint={type === "adjust" ? "填盘点后的实际数量" : undefined}>
            <TextInput name="qty" type="number" min={1} />
          </Field>
        </FieldGrid>
        <FieldGrid columns={2}>
          <Field label="商品" required>
            <Select
              name="product_id"
              options={rows.map((r) => ({ value: r.id, label: `${r.name}（${r.sku_code}）` }))}
            />
          </Field>
          <Field label={type === "transfer" ? "调出仓库" : "仓库"} required>
            <Select name="warehouse_id" options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
          </Field>
        </FieldGrid>
        {type === "transfer" && (
          <Field label="调入仓库" required>
            <Select
              name="to_warehouse_id"
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </Field>
        )}
        <FieldGrid columns={2}>
          <Field label="原因 / 备注">
            <TextInput name="reason" placeholder="例如：采购到货 / 破损报废" />
          </Field>
          <Field label="关联单号">
            <TextInput name="ref_no" placeholder="订单号 / 采购单号" />
          </Field>
        </FieldGrid>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <SubmitButton>提交单据</SubmitButton>
        </ModalFooter>
      </ActionForm>
    </Modal>
  );
}

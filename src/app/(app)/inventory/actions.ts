"use server";

import { revalidatePath } from "next/cache";
import {
  bool,
  dec,
  int,
  optStr,
  runAction,
  str,
  type ActionResult,
} from "@/lib/actions/common";
import { canActDirectly, createApprovalRequest } from "@/lib/data/approvals";
import { getCurrentAdmin } from "@/lib/auth/context";

// 商品与库存的写入路径。
//
// 原状：「新增商品」「新增价格策略」「导出」三个按钮无 onClick；六档价格是
// 「零售价 × 写死倍率」渲染时算的（products 表只有 price / cost 两列）；
// 「入库出库」是一个 ModulePlaceholder 空壳，库存没有任何合法变动来源。

const MODULE = "inventory";

function refresh() {
  revalidatePath("/inventory");
  revalidatePath("/");
  revalidatePath("/analytics");
}

// ---------------------------------------------------------------------------
// 商品
// ---------------------------------------------------------------------------

function productPatch(fd: FormData): Record<string, unknown> {
  return {
    sku_code: str(fd, "sku_code"),
    name: str(fd, "name"),
    category: str(fd, "category"),
    category_id: optStr(fd, "category_id"),
    price: dec(fd, "price"),
    cost: dec(fd, "cost"),
    safety_stock: int(fd, "safety_stock"),
    status: str(fd, "status", "draft"),
    unit: str(fd, "unit", "瓶"),
    spec: optStr(fd, "spec"),
    barcode: optStr(fd, "barcode"),
    tax_rate: dec(fd, "tax_rate"),
    image_url: optStr(fd, "image_url"),
    description: optStr(fd, "description"),
    weight_g: fd.get("weight_g") ? int(fd, "weight_g") : null,
    sort: int(fd, "sort"),
  };
}

export async function createProductAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  return runAction(
    {
      module: MODULE,
      permission: "新建商品",
      success: "商品已创建",
      audit: () => ({
        action: "create_product",
        module: "商品与库存",
        detail: `新建商品 ${str(fd, "name")}（${str(fd, "sku_code")}）`,
        targetName: str(fd, "sku_code"),
      }),
    },
    async ({ sb }) => {
      const patch = productPatch(fd);
      if (!patch.sku_code) throw new Error("请填写 SKU 编码");
      if (!patch.name) throw new Error("请填写商品名称");
      if (Number(patch.price) <= 0) throw new Error("零售价必须大于 0");

      const { data: category } = patch.category_id
        ? await sb.from("product_categories").select("name").eq("id", patch.category_id).maybeSingle()
        : { data: null };
      if (category) patch.category = String(category.name);

      const { error } = await sb.from("products").insert(patch);
      if (error) {
        throw new Error(
          error.code === "23505" ? `SKU 编码 ${patch.sku_code} 已存在` : `创建失败：${error.message}`,
        );
      }
      refresh();
    },
  );
}

export async function updateProductAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = str(fd, "id");
  const newPrice = dec(fd, "price");

  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };

  // 改价走审批阈值（approval_rules.price_change）。
  const priceChanged = str(fd, "price_changed") === "true";
  if (priceChanged) {
    const gate = await canActDirectly(me.level, "price_change", newPrice);
    if (!gate.allowed) {
      await createApprovalRequest({
        actionKey: "price_change",
        title: `修改商品 ${str(fd, "name")} 零售价为 ${newPrice}`,
        amount: newPrice,
        payload: Object.fromEntries(fd.entries()) as Record<string, unknown>,
        requiredLevel: gate.decision.level ?? "L1",
        requesterId: me.id,
        requesterName: me.name,
      });
      revalidatePath("/settings");
      return { ok: false, error: `${gate.reason}，已自动提交审批单` };
    }
  }

  return runAction(
    {
      module: MODULE,
      permission: priceChanged ? "修改价格" : "修改商品",
      success: "商品已保存",
      audit: () => ({
        action: "update_product",
        module: "商品与库存",
        detail: `修改商品 ${str(fd, "name")}`,
        targetId: id,
        targetName: str(fd, "sku_code"),
        after: productPatch(fd),
      }),
    },
    async ({ sb }) => {
      if (!id) throw new Error("缺少商品 ID");
      const patch = productPatch(fd);
      const { error } = await sb.from("products").update(patch).eq("id", id);
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh();
    },
  );
}

export async function toggleProductStatusAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = str(fd, "id");
  const status = str(fd, "status");
  return runAction(
    {
      module: MODULE,
      permission: "商品上下架",
      success: status === "active" ? "商品已上架" : "商品已下架",
      audit: () => ({
        action: "toggle_product_status",
        module: "商品与库存",
        detail: `商品 ${id} 状态改为 ${status}`,
        targetId: id,
      }),
    },
    async ({ sb }) => {
      const { error } = await sb.from("products").update({ status }).eq("id", id);
      if (error) throw new Error(`操作失败：${error.message}`);
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 价格档位与 SKU 定价（取代 InventoryView 里的 ×0.92 / ×0.78 …）
// ---------------------------------------------------------------------------

export async function savePriceTierAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  return runAction(
    {
      module: MODULE,
      permission: "修改价格",
      success: "价格档位已保存",
      audit: () => ({
        action: id ? "update_price_tier" : "create_price_tier",
        module: "商品与库存",
        detail: `${id ? "修改" : "新建"}价格档位 ${name}`,
        targetId: id,
        targetName: name,
      }),
    },
    async ({ sb }) => {
      if (!name) throw new Error("请填写档位名称");
      const factor = dec(fd, "default_factor", 1);
      if (factor <= 0 || factor > 5) throw new Error("默认倍率应在 0–5 之间");
      const row = {
        code: str(fd, "code"),
        name,
        sort: int(fd, "sort"),
        currency: str(fd, "currency", "CNY"),
        default_factor: factor,
        requires_approval: bool(fd, "requires_approval"),
        is_active: bool(fd, "is_active"),
      };
      if (!row.code) throw new Error("请填写档位代码");
      const { error } = id
        ? await sb.from("price_tiers").update(row).eq("id", id)
        : await sb.from("price_tiers").insert(row);
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh();
    },
  );
}

/** 给某个 SKU 在某个档位上设一个真实价格（支持阶梯量价与生效时间）。 */
export async function setProductPriceAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const productId = str(fd, "product_id");
  const tierId = str(fd, "tier_id");
  const price = dec(fd, "price");

  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };

  const gate = await canActDirectly(me.level, "price_change", price);
  if (!gate.allowed) {
    await createApprovalRequest({
      actionKey: "price_change",
      title: `设置 SKU 档位价 ${price}`,
      amount: price,
      payload: { productId, tierId, price, minQty: int(fd, "min_qty", 1) },
      requiredLevel: gate.decision.level ?? "L1",
      requesterId: me.id,
      requesterName: me.name,
    });
    revalidatePath("/settings");
    return { ok: false, error: `${gate.reason}，已自动提交审批单` };
  }

  return runAction(
    {
      module: MODULE,
      permission: "修改价格",
      success: "档位价已保存",
      audit: () => ({
        action: "set_product_price",
        module: "商品与库存",
        detail: `SKU ${productId} 档位 ${tierId} 价格设为 ${price}`,
        targetId: productId,
        after: { tierId, price },
      }),
    },
    async ({ sb, me: actor }) => {
      if (price <= 0) throw new Error("价格必须大于 0");
      const minQty = Math.max(1, int(fd, "min_qty", 1));
      const validFrom = optStr(fd, "valid_from") ?? new Date().toISOString();

      // 同一 (SKU, 档位, 起订量) 的旧价格失效，再插入新价格 —— 保留历史可追溯。
      await sb
        .from("product_prices")
        .update({ is_active: false, valid_to: validFrom })
        .eq("product_id", productId)
        .eq("tier_id", tierId)
        .eq("min_qty", minQty)
        .eq("is_active", true);

      const { error } = await sb.from("product_prices").insert({
        product_id: productId,
        tier_id: tierId,
        price,
        currency: str(fd, "currency", "CNY"),
        min_qty: minQty,
        valid_from: validFrom,
        valid_to: optStr(fd, "valid_to"),
        is_active: true,
        created_by: actor.id,
      });
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 出入库单据（库存唯一合法变动来源）
// ---------------------------------------------------------------------------

export async function createInventoryMoveAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const type = str(fd, "type");
  const qty = int(fd, "qty");

  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };

  // 大批量调整走审批（approval_rules.stock_adjust 用数量作为「金额」维度）。
  const gate = await canActDirectly(me.level, "stock_adjust", qty);
  if (!gate.allowed) {
    await createApprovalRequest({
      actionKey: "stock_adjust",
      title: `${type} ${qty} 件`,
      amount: qty,
      payload: Object.fromEntries(fd.entries()) as Record<string, unknown>,
      requiredLevel: gate.decision.level ?? "L1",
      requesterId: me.id,
      requesterName: me.name,
    });
    revalidatePath("/settings");
    return { ok: false, error: `${gate.reason}，已自动提交审批单` };
  }

  return runAction(
    {
      module: MODULE,
      permission: "调整库存",
      success: "出入库单据已生成，库存已更新",
      audit: () => ({
        action: "inventory_move",
        module: "商品与库存",
        detail: `${type} · ${str(fd, "product_id")} · ${qty} 件`,
        after: Object.fromEntries(fd.entries()),
      }),
    },
    async ({ sb, me: actor }) => {
      if (!["in", "out", "transfer", "adjust"].includes(type)) throw new Error("未知的单据类型");
      if (qty <= 0) throw new Error("数量必须大于 0");

      const { error } = await sb.rpc("gy_apply_inventory_move", {
        p_type: type,
        p_product_id: str(fd, "product_id"),
        p_warehouse_id: str(fd, "warehouse_id"),
        p_qty: qty,
        p_to_warehouse_id: optStr(fd, "to_warehouse_id"),
        p_reason: optStr(fd, "reason"),
        p_ref_no: optStr(fd, "ref_no"),
        p_operator_id: actor.id,
        p_operator_name: actor.name,
      });
      if (error) throw new Error(error.message.replace(/^.*?:\s*/, ""));
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 商品分类
// ---------------------------------------------------------------------------

export async function saveProductCategoryAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  return runAction(
    {
      module: MODULE,
      permission: "修改商品",
      success: "分类已保存",
      audit: () => ({
        action: id ? "update_category" : "create_category",
        module: "商品与库存",
        detail: `${id ? "修改" : "新建"}商品分类 ${name}`,
        targetId: id,
        targetName: name,
      }),
    },
    async ({ sb }) => {
      if (!name) throw new Error("请填写分类名称");
      const row = {
        name,
        code: str(fd, "code"),
        sort: int(fd, "sort"),
        tax_rate: dec(fd, "tax_rate"),
        is_active: bool(fd, "is_active"),
      };
      if (!row.code) throw new Error("请填写分类代码");
      const { error } = id
        ? await sb.from("product_categories").update(row).eq("id", id)
        : await sb.from("product_categories").insert(row);
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------

export async function exportInventoryAction(
  _prev: ActionResult<{ csv: string; filename: string }> | null,
  _fd: FormData,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  return runAction<{ csv: string; filename: string }>(
    {
      module: MODULE,
      permission: "查看商品",
      success: (r) => `已生成 ${r.filename}`,
      audit: (r) => ({
        action: "export_inventory",
        module: "商品与库存",
        detail: `导出库存 ${r.filename}`,
      }),
    },
    async ({ sb }) => {
      const cols = [
        "sku_code",
        "product_name",
        "warehouse_name",
        "sellable",
        "locked",
        "transit",
        "safety_stock",
      ];
      const { data, error } = await sb.from("inventory_view").select(cols.join(",")).limit(10000);
      if (error) throw new Error(`导出失败：${error.message}`);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      const csv = [
        cols.join(","),
        ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
      return { csv, filename: `inventory-${new Date().toISOString().slice(0, 10)}.csv` };
    },
  );
}

"use server";

import { revalidatePath } from "next/cache";
import {
  dec,
  list,
  optStr,
  mustAffect,
  runAction,
  str,
  type ActionResult,
} from "@/lib/actions/common";
import { canActDirectly, createApprovalRequest } from "@/lib/data/approvals";
import { getCurrentAdmin } from "@/lib/auth/context";
import { loadSettings } from "@/lib/data/settings";
import { buildCsv, csvFilename, type CsvColumn } from "@/lib/csv";

// 订单中心的写入路径。原来这个模块里 13 个可点控件（新建订单、5 个订单类型、
// 6 个批量操作、行内「收款确认 / 处理异常 / 发货」）没有一个带 onClick，
// 订单详情页更是一个 <button> 都没有。

const MODULE = "orders";

function refresh(orderNo?: string) {
  revalidatePath("/orders");
  revalidatePath("/");
  revalidatePath("/logistics");
  revalidatePath("/finance");
  if (orderNo) revalidatePath(`/orders/${orderNo}`);
}

// ---------------------------------------------------------------------------
// 新建订单
// ---------------------------------------------------------------------------

export async function createOrderAction(
  _prev: ActionResult<{ orderNo: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ orderNo: string }>> {
  return runAction<{ orderNo: string }>(
    {
      module: MODULE,
      permission: "新建订单",
      success: (r) => `订单 ${r.orderNo} 已创建`,
      audit: (r) => ({
        action: "create_order",
        module: "订单中心",
        detail: `新建订单 ${r.orderNo}`,
        targetName: r.orderNo,
      }),
    },
    async ({ sb, me }) => {
      const customerId = optStr(fd, "customer_id");
      let customerName = str(fd, "customer_name");
      let country = optStr(fd, "country");
      let phone = optStr(fd, "contact_phone");

      // 弹窗上写着「留空则使用上面选中的客户」，所以这里必须真的回填。
      // 原来只读了 customer_id 却从不使用它，选了客户再留空姓名会直接被驳回，
      // 与界面承诺的行为不符。
      if (customerId) {
        const { data: c } = await sb
          .from("customers")
          .select("name,country,phone")
          .eq("id", customerId)
          .maybeSingle();
        if (c) {
          const row = c as Record<string, unknown>;
          if (!customerName) customerName = String(row.name ?? "");
          if (!country) country = (row.country as string) ?? null;
          if (!phone) phone = (row.phone as string) ?? null;
        }
      }
      if (!customerName) throw new Error("请选择客户或填写客户名称");

      // 明细：三个平行数组（product_id[] / qty[] / price[]）
      const productIds = list(fd, "item_product_id");
      const qtys = list(fd, "item_qty").map((v) => Math.max(1, Number(v) || 1));
      const prices = list(fd, "item_price").map((v) => Number(v) || 0);
      if (productIds.length === 0) throw new Error("请至少添加一个商品明细");

      const { data: products, error: prodErr } = await sb
        .from("products")
        .select("id,name,sku_code,price,cost")
        .in("id", productIds);
      if (prodErr) throw new Error(`读取商品失败：${prodErr.message}`);
      const byId = new Map(
        ((products ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]),
      );

      const items = productIds.map((pid, i) => {
        const p = byId.get(pid);
        if (!p) throw new Error(`商品 ${pid} 不存在`);
        return {
          product_id: pid,
          product_name: String(p.name),
          sku_code: String(p.sku_code),
          qty: qtys[i] ?? 1,
          price: prices[i] ?? (Number(p.price) || 0),
          cost: Number(p.cost) || 0,
        };
      });

      const goods = items.reduce((s, it) => s + it.qty * it.price, 0);
      const freight = dec(fd, "freight_fee");
      const discount = dec(fd, "discount");
      const tax = dec(fd, "tax");
      const amount = Math.max(0, goods + freight + tax - discount);

      const { data: order, error } = await sb
        .from("orders")
        .insert({
          customer_id: customerId,
          customer_name: customerName,
          country: country || "中国 CN",
          province: optStr(fd, "province"),
          city: optStr(fd, "city"),
          address: optStr(fd, "address"),
          contact_phone: phone,
          order_type: str(fd, "order_type", "retail"),
          order_channel: str(fd, "order_channel", "backend"),
          customer_source: str(fd, "customer_source", "organic"),
          payment_method: str(fd, "payment_method", "unpaid"),
          warehouse_id: optStr(fd, "warehouse_id"),
          ship_from: str(fd, "ship_from", ""),
          currency: str(fd, "currency", "CNY"),
          goods_amount: goods,
          freight_fee: freight,
          discount,
          tax,
          amount,
          amount_received: 0,
          pay_status: "unpaid",
          fulfill_status: "assign",
          settle_status: "unsettled",
          remark: optStr(fd, "remark"),
          owner_admin_id: me.id,
          created_by: me.id,
        })
        .select("id,order_no")
        .single();
      if (error || !order) throw new Error(`创建订单失败：${error?.message ?? "未知错误"}`);

      const { error: itemErr } = await sb
        .from("order_items")
        .insert(items.map((it) => ({ ...it, order_id: order.id })));
      if (itemErr) {
        await sb.from("orders").delete().eq("id", order.id);
        throw new Error(`保存订单明细失败：${itemErr.message}`);
      }

      refresh(String(order.order_no));
      return { orderNo: String(order.order_no) };
    },
  );
}

// ---------------------------------------------------------------------------
// 状态推进（收款确认 / 发货 / 签收 / 处理异常）
// ---------------------------------------------------------------------------

export async function updateOrderStatusAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const orderNo = str(fd, "order_no");
  const field = str(fd, "field"); // pay_status | fulfill_status | settle_status
  const value = str(fd, "value");
  const note = optStr(fd, "note");

  return runAction(
    {
      module: MODULE,
      permission: field === "pay_status" ? "审核订单" : "修改订单",
      success: `订单 ${orderNo} 已更新`,
      audit: () => ({
        action: `order_${field}`,
        module: "订单中心",
        detail: `${orderNo}：${field} → ${value}${note ? `（${note}）` : ""}`,
        targetName: orderNo,
        after: { [field]: value },
      }),
    },
    async ({ sb, me }) => {
      if (!["pay_status", "fulfill_status", "settle_status"].includes(field)) {
        throw new Error("不支持的状态字段");
      }
      const { data: order, error: readErr } = await sb
        .from("orders")
        .select("id,order_no,amount,amount_received,pay_status,fulfill_status,settle_status")
        .eq("order_no", orderNo)
        .maybeSingle();
      if (readErr || !order) throw new Error("订单不存在");

      const patch: Record<string, unknown> = { [field]: value };
      // 收款确认：实收补齐为应付，并把待分配推进到备货中。
      if (field === "pay_status" && value === "paid") {
        patch.amount_received = Number(order.amount) || 0;
        if (order.fulfill_status === "assign") patch.fulfill_status = "prep";
      }
      if (field === "fulfill_status" && value === "signed") {
        patch.settle_status =
          order.settle_status === "unsettled" ? "reconciling" : order.settle_status;
      }

      await mustAffect(sb.from("orders").update(patch).eq("id", order.id).select("id"), "更新订单状态");

      if (note) {
        await sb.from("order_events").insert({
          order_id: order.id,
          order_no: orderNo,
          event_type: "note",
          note,
          operator_id: me.id,
          operator_name: me.name,
        });
      }
      refresh(orderNo);
    },
  );
}

/** 批量操作（原来 6 个批量按钮渲染成 <span>，连 button 都不是）。 */
export async function bulkUpdateOrdersAction(
  _prev: ActionResult<{ count: number }> | null,
  fd: FormData,
): Promise<ActionResult<{ count: number }>> {
  const orderNos = list(fd, "order_no");
  const field = str(fd, "field");
  const value = str(fd, "value");

  return runAction<{ count: number }>(
    {
      module: MODULE,
      permission: "修改订单",
      success: (r) => `已更新 ${r.count} 笔订单`,
      audit: (r) => ({
        action: "bulk_update_orders",
        module: "订单中心",
        detail: `批量将 ${r.count} 笔订单的 ${field} 改为 ${value}`,
        after: { orderNos, field, value },
      }),
    },
    async ({ sb }) => {
      if (orderNos.length === 0) throw new Error("请先勾选订单");
      if (!["pay_status", "fulfill_status", "settle_status"].includes(field)) {
        throw new Error("不支持的批量字段");
      }
      const { error, count } = await sb
        .from("orders")
        .update({ [field]: value }, { count: "exact" })
        .in("order_no", orderNos);
      if (error) throw new Error(`批量更新失败：${error.message}`);
      refresh();
      return { count: count ?? orderNos.length };
    },
  );
}

// ---------------------------------------------------------------------------
// 修改订单金额（走审批阈值）
// ---------------------------------------------------------------------------

export async function changeOrderAmountAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const orderNo = str(fd, "order_no");
  const newAmount = dec(fd, "amount");
  const reason = str(fd, "reason");

  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };

  const gate = await canActDirectly(me.level, "order_amount_change", newAmount);
  if (!gate.allowed) {
    await createApprovalRequest({
      actionKey: "order_amount_change",
      title: `修改订单 ${orderNo} 金额为 ${newAmount}`,
      amount: newAmount,
      payload: { orderNo, newAmount, reason },
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
      permission: "修改订单金额",
      success: "订单金额已修改",
      audit: () => ({
        action: "change_order_amount",
        module: "订单中心",
        detail: `${orderNo} 金额改为 ${newAmount}：${reason}`,
        targetName: orderNo,
        after: { amount: newAmount },
      }),
    },
    async ({ sb, me: actor }) => {
      if (!reason) throw new Error("修改金额必须填写原因");
      const { data: order } = await sb
        .from("orders")
        .select("id,amount")
        .eq("order_no", orderNo)
        .maybeSingle();
      if (!order) throw new Error("订单不存在");
      await mustAffect(
        sb.from("orders").update({ amount: newAmount }).eq("id", order.id).select("id"),
        "修改订单金额",
      );
      await sb.from("order_events").insert({
        order_id: order.id,
        order_no: orderNo,
        event_type: "amount_change",
        from_value: String(order.amount),
        to_value: String(newAmount),
        note: reason,
        operator_id: actor.id,
        operator_name: actor.name,
      });
      refresh(orderNo);
    },
  );
}

// ---------------------------------------------------------------------------
// 取消订单 / 备注
// ---------------------------------------------------------------------------

export async function cancelOrderAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const orderNo = str(fd, "order_no");
  const reason = str(fd, "reason");
  return runAction(
    {
      module: MODULE,
      permission: "取消订单",
      success: `订单 ${orderNo} 已取消`,
      audit: () => ({
        action: "cancel_order",
        module: "订单中心",
        detail: `取消 ${orderNo}：${reason}`,
        targetName: orderNo,
      }),
    },
    async ({ sb, me }) => {
      if (!reason) throw new Error("取消订单必须填写原因");
      const { data: order } = await sb
        .from("orders")
        .select("id,pay_status")
        .eq("order_no", orderNo)
        .maybeSingle();
      if (!order) throw new Error("订单不存在");
      if (["paid", "partial_refund"].includes(String(order.pay_status))) {
        throw new Error("该订单已收款，请先发起退款再取消");
      }
      const { data, error } = await sb
        .from("orders")
        .update({ cancelled_at: new Date().toISOString(), fulfill_status: "fulfill_exception" })
        .eq("id", order.id)
        .select("id");
      if (error) throw new Error(`取消失败：${error.message}`);
      if (((data ?? []) as unknown[]).length === 0) throw new Error("取消失败：订单不存在或无权修改");
      await sb.from("order_events").insert({
        order_id: order.id,
        order_no: orderNo,
        event_type: "cancelled",
        note: reason,
        operator_id: me.id,
        operator_name: me.name,
      });
      refresh(orderNo);
    },
  );
}

export async function addOrderNoteAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const orderNo = str(fd, "order_no");
  const note = str(fd, "note");
  return runAction(
    {
      module: MODULE,
      permission: "修改订单",
      success: "备注已添加",
      audit: () => ({
        action: "order_note",
        module: "订单中心",
        detail: `${orderNo}：${note}`,
        targetName: orderNo,
      }),
    },
    async ({ sb, me }) => {
      if (!note) throw new Error("备注内容不能为空");
      const { data: order } = await sb
        .from("orders")
        .select("id")
        .eq("order_no", orderNo)
        .maybeSingle();
      if (!order) throw new Error("订单不存在");
      await sb.from("order_events").insert({
        order_id: order.id,
        order_no: orderNo,
        event_type: "note",
        note,
        operator_id: me.id,
        operator_name: me.name,
      });
      refresh(orderNo);
    },
  );
}

/** 修改收货地址 / 换仓。 */
export async function updateOrderShippingAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const orderNo = str(fd, "order_no");
  return runAction(
    {
      module: MODULE,
      permission: "修改订单",
      success: "发货信息已更新",
      audit: () => ({
        action: "update_order_shipping",
        module: "订单中心",
        detail: `更新 ${orderNo} 的收货信息 / 发货仓`,
        targetName: orderNo,
      }),
    },
    async ({ sb }) => {
      const patch: Record<string, unknown> = {
        province: optStr(fd, "province"),
        city: optStr(fd, "city"),
        address: optStr(fd, "address"),
        contact_phone: optStr(fd, "contact_phone"),
      };
      const warehouseId = optStr(fd, "warehouse_id");
      if (warehouseId) {
        const { data: wh } = await sb
          .from("warehouses")
          .select("id,name")
          .eq("id", warehouseId)
          .maybeSingle();
        if (!wh) throw new Error("仓库不存在");
        patch.warehouse_id = wh.id;
        patch.ship_from = wh.name;
      }
      await mustAffect(sb.from("orders").update(patch).eq("order_no", orderNo).select("id"), "保存订单信息");
      refresh(orderNo);
    },
  );
}

/** 明细数量调整（未支付订单才允许）。 */
export async function updateOrderItemsAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const orderNo = str(fd, "order_no");
  return runAction(
    {
      module: MODULE,
      permission: "修改订单",
      success: "订单明细已更新",
      audit: () => ({
        action: "update_order_items",
        module: "订单中心",
        detail: `更新 ${orderNo} 的商品明细`,
        targetName: orderNo,
      }),
    },
    async ({ sb }) => {
      const { data: order } = await sb
        .from("orders")
        .select("id,pay_status,freight_fee,discount,tax")
        .eq("order_no", orderNo)
        .maybeSingle();
      if (!order) throw new Error("订单不存在");
      if (String(order.pay_status) !== "unpaid") {
        throw new Error("已发起支付的订单不能直接改明细，请走「修改订单金额」审批");
      }

      const itemIds = list(fd, "item_id");
      const qtys = list(fd, "item_qty").map((v) => Math.max(0, Number(v) || 0));
      let goods = 0;
      for (let i = 0; i < itemIds.length; i++) {
        const qty = qtys[i] ?? 0;
        if (qty === 0) {
          await sb.from("order_items").delete().eq("id", itemIds[i]);
          continue;
        }
        const { data: row } = await sb
          .from("order_items")
          .select("price")
          .eq("id", itemIds[i])
          .maybeSingle();
        await sb.from("order_items").update({ qty }).eq("id", itemIds[i]);
        goods += qty * (Number(row?.price) || 0);
      }
      const amount =
        goods + (Number(order.freight_fee) || 0) + (Number(order.tax) || 0) - (Number(order.discount) || 0);
      await sb
        .from("orders")
        .update({ goods_amount: goods, amount: Math.max(0, amount) })
        .eq("id", order.id);
      refresh(orderNo);
    },
  );
}

/** 首页 / 列表页的「导出」按钮：生成 CSV 内容并留痕（超阈值需审批）。 */
export async function exportOrdersAction(
  _prev: ActionResult<{ csv: string; filename: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const reason = str(fd, "reason", "运营导出");
  return runAction<{ csv: string; filename: string }>(
    {
      module: MODULE,
      permission: "导出订单",
      success: (r) => `已生成 ${r.filename}`,
      audit: (r) => ({
        action: "export_orders",
        module: "订单中心",
        detail: `导出订单：${reason}（${r.filename}）`,
      }),
    },
    async ({ sb, me }) => {
      const COLS: CsvColumn<Record<string, unknown>>[] = [
        { key: "order_no", label: "订单号" },
        { key: "customer_name", label: "客户" },
        { key: "country", label: "国家 / 地区" },
        { key: "province", label: "省 / 直辖市" },
        { key: "order_type", label: "订单类型" },
        { key: "order_channel", label: "下单渠道" },
        { key: "payment_method", label: "支付方式" },
        { key: "amount", label: "应付金额" },
        { key: "amount_received", label: "实收金额" },
        { key: "pay_status", label: "支付状态" },
        { key: "fulfill_status", label: "履约状态" },
        { key: "settle_status", label: "结算状态" },
        { key: "created_at", label: "下单时间" },
      ];
      const { data, error } = await sb
        .from("orders")
        .select(COLS.map((c) => c.key).join(","))
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw new Error(`导出失败：${error.message}`);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];

      // 超过阈值的导出需要审批（security.export_approval_rows）。
      const { security } = await loadSettings();
      if (rows.length > security.exportApprovalRows) {
        const gate = await canActDirectly(me.level, "export_orders", rows.length);
        if (!gate.allowed) throw new Error(gate.reason ?? "导出行数超过阈值，需要审批");
      }

      return { csv: buildCsv(rows, COLS), filename: csvFilename("orders") };
    },
  );
}

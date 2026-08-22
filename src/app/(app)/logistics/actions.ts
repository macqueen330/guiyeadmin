"use server";

import { revalidatePath } from "next/cache";
import { dec, int, mustAffect, optStr, runAction, str, type ActionResult } from "@/lib/actions/common";
import {
  getCarrierByCode,
  persistTrackingEvents,
  providerForCarrier,
  resolveCarrierCredentials,
} from "@/lib/logistics/registry";
import type { ShipmentEvent } from "@/lib/types";
import { getDb } from "@/lib/data/db";
import { getCurrentAdmin } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { buildCsv, csvFilename, type CsvColumn } from "@/lib/csv";

// 仓储物流的写入路径。
//
// 原状：整个模块只有一个无 onClick 的「导出物流」按钮；运单状态无法推进；
// 「仓库管理」只渲染一个只读分布条 —— 没有仓库列表、地址、联系人、启用开关，
// 仓库改名需要写一条 SQL 迁移。
//
// 物流公司 API 尚未接入时（carriers.api_provider 为空），运单号与轨迹人工维护；
// 接入后同一套界面会自动改用 API 下单与轨迹同步（见 src/lib/logistics/）。

const MODULE = "logistics";

function refresh() {
  revalidatePath("/logistics");
  revalidatePath("/orders");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// 运单
// ---------------------------------------------------------------------------

export async function createShipmentAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const orderNo = str(fd, "order_no");
  return runAction(
    {
      module: MODULE,
      permission: "填写物流",
      success: "运单已登记，订单状态已推进到已发货",
      audit: () => ({
        action: "create_shipment",
        module: "仓储物流",
        detail: `订单 ${orderNo} 登记运单 ${str(fd, "tracking_no")}`,
        targetName: orderNo,
      }),
    },
    async ({ sb }) => {
      const trackingNo = str(fd, "tracking_no");
      const carrierId = str(fd, "carrier_id");
      if (!trackingNo) throw new Error("请填写物流单号");
      if (!carrierId) throw new Error("请选择承运商");

      const { data: order } = await sb
        .from("orders")
        .select("id,order_no,country,province,city,address,warehouse_id")
        .eq("order_no", orderNo)
        .maybeSingle();
      if (!order) throw new Error("订单不存在");

      const { data: carrier } = await sb
        .from("carriers")
        .select("id,name")
        .eq("id", carrierId)
        .maybeSingle();
      if (!carrier) throw new Error("承运商不存在");

      const destination =
        str(fd, "destination") ||
        [order.province, order.city, order.address].filter(Boolean).join(" ") ||
        String(order.country ?? "");

      const { data: shipment, error } = await sb
        .from("shipments")
        .insert({
          order_id: order.id,
          order_no: order.order_no,
          carrier_id: carrier.id,
          carrier: String(carrier.name),
          tracking_no: trackingNo,
          destination,
          status: "preparing",
          warehouse_id: order.warehouse_id,
          freight_cost: dec(fd, "freight_cost"),
          weight_g: fd.get("weight_g") ? int(fd, "weight_g") : null,
          shipped_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !shipment) throw new Error(`登记运单失败：${error?.message ?? "未知错误"}`);

      await sb.from("shipment_events").insert({
        shipment_id: shipment.id,
        status: "preparing",
        description: "运单已创建",
        source: "manual",
      });
      // 履约状态推进到已发货，与订单中心保持一致。
      await sb.from("orders").update({ fulfill_status: "shipped" }).eq("id", order.id);
      refresh();
    },
  );
}

export async function updateShipmentStatusAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = str(fd, "shipment_id");
  const status = str(fd, "status");
  return runAction(
    {
      module: MODULE,
      permission: status === "exception" ? "处理物流异常" : "填写物流",
      success: "运单状态已更新",
      audit: () => ({
        action: "update_shipment",
        module: "仓储物流",
        detail: `运单 ${id} 状态改为 ${status}`,
        targetId: id,
        after: { status },
      }),
    },
    async ({ sb, me }) => {
      const patch: Record<string, unknown> = {
        status,
        exception: status === "exception" ? str(fd, "exception") : null,
        updated_at: new Date().toISOString(),
      };
      if (status === "delivered") patch.delivered_at = new Date().toISOString();

      const { data: shipment, error } = await sb
        .from("shipments")
        .update(patch)
        .eq("id", id)
        .select("order_id,order_no")
        .single();
      if (error) throw new Error(`更新失败：${error.message}`);

      await sb.from("shipment_events").insert({
        shipment_id: id,
        status,
        description: optStr(fd, "note") ?? `人工更新为 ${status}`,
        source: "manual",
      });

      // 签收 / 异常同步回订单履约状态。
      if (shipment?.order_id) {
        if (status === "delivered") {
          await sb.from("orders").update({ fulfill_status: "signed" }).eq("id", shipment.order_id);
        } else if (status === "exception") {
          await sb
            .from("orders")
            .update({ fulfill_status: "fulfill_exception" })
            .eq("id", shipment.order_id);
          await sb.from("order_events").insert({
            order_id: shipment.order_id,
            order_no: String(shipment.order_no),
            event_type: "note",
            note: `物流异常：${str(fd, "exception")}`,
            operator_id: me.id,
            operator_name: me.name,
          });
        }
      }
      refresh();
    },
  );
}

/** 人工补录一条轨迹（承运商未接入 API 时的日常操作）。 */
export async function addTrackingEventAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const shipmentId = str(fd, "shipment_id");
  return runAction(
    {
      module: MODULE,
      permission: "填写物流",
      success: "轨迹已补录",
      audit: () => ({
        action: "add_tracking_event",
        module: "仓储物流",
        detail: `运单 ${shipmentId} 补录轨迹：${str(fd, "description")}`,
        targetId: shipmentId,
      }),
    },
    async ({ sb }) => {
      const description = str(fd, "description");
      if (!description) throw new Error("请填写轨迹描述");
      const { error } = await sb.from("shipment_events").insert({
        shipment_id: shipmentId,
        status: str(fd, "status", "in_transit"),
        location: optStr(fd, "location"),
        description,
        occurred_at: optStr(fd, "occurred_at") ?? new Date().toISOString(),
        source: "manual",
      });
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh();
    },
  );
}

/**
 * 主动向承运商 API 拉取最新轨迹。
 * 未接入 API 的承运商会返回明确的「未接入」提示，而不是假装同步成功。
 */
export async function syncTrackingAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const shipmentId = str(fd, "shipment_id");
  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };
  if (!can(me, MODULE, "填写物流")) return { ok: false, error: "没有「填写物流」权限" };

  const sb = await getDb();
  if (!sb) return { ok: false, error: "数据库未配置" };

  const { data: shipment } = await sb
    .from("shipments")
    .select("id,tracking_no,carrier_id")
    .eq("id", shipmentId)
    .maybeSingle();
  if (!shipment) return { ok: false, error: "运单不存在" };

  const { data: carrierRow } = await sb
    .from("carriers")
    .select("code")
    .eq("id", shipment.carrier_id)
    .maybeSingle();
  const carrier = carrierRow ? await getCarrierByCode(String(carrierRow.code)) : null;
  if (!carrier) return { ok: false, error: "该运单没有关联承运商" };

  const provider = providerForCarrier(carrier);
  const creds = resolveCarrierCredentials(carrier);
  const missing = provider.missingRequirements(carrier, creds);
  if (missing.length > 0) {
    return { ok: false, error: `${carrier.name} 未接入 API：${missing.join("；")}` };
  }

  try {
    const result = await provider.queryTracking(String(shipment.tracking_no), carrier, creds);
    const added = await persistTrackingEvents(
      String(shipment.id),
      result.events,
      result.status,
      "carrier_api",
    );
    refresh();
    return { ok: true, message: `同步完成，新增 ${added} 条轨迹` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function fetchShipmentEventsAction(shipmentId: string): Promise<ShipmentEvent[]> {
  const me = await getCurrentAdmin();
  if (!me || !can(me, MODULE, "查看发货订单")) return [];
  const sb = await getDb();
  if (!sb) return [];
  const { data } = await sb
    .from("shipment_events")
    .select("*")
    .eq("shipment_id", shipmentId)
    .order("occurred_at", { ascending: false });
  return (data ?? []) as ShipmentEvent[];
}

// ---------------------------------------------------------------------------
// 仓库（改名 / 停用不该再写 SQL 迁移）
// ---------------------------------------------------------------------------

export async function saveWarehouseAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  return runAction(
    {
      module: MODULE,
      permission: "分配仓库",
      success: "仓库已保存",
      audit: () => ({
        action: id ? "update_warehouse" : "create_warehouse",
        module: "仓储物流",
        detail: `${id ? "修改" : "新建"}仓库 ${name}`,
        targetId: id,
        targetName: name,
      }),
    },
    async ({ sb }) => {
      if (!name) throw new Error("请填写仓库名称");
      const row = {
        name,
        code: str(fd, "code"),
        region: str(fd, "region", "中国"),
        address: optStr(fd, "address"),
        contact: optStr(fd, "contact"),
        phone: optStr(fd, "phone"),
        type: str(fd, "type", "own"),
        is_active: str(fd, "is_active") !== "false",
        sort: int(fd, "sort"),
      };
      if (!row.code) throw new Error("请填写仓库编码");

      if (id) {
        await mustAffect(sb.from("warehouses").update(row).eq("id", id).select("id"), "保存仓库");
        // 仓库改名后同步订单上的冗余显示字段，避免两处名字不一致。
        await sb.from("orders").update({ ship_from: name }).eq("warehouse_id", id);
      } else {
        const { error } = await sb
          .from("warehouses")
          .insert({ id: `wh-${row.code.toLowerCase()}`, ...row });
        if (error) throw new Error(`创建失败：${error.message}`);
      }
      refresh();
      revalidatePath("/inventory");
    },
  );
}

// ---------------------------------------------------------------------------
// 承运商（物流公司 API 接入位）
// ---------------------------------------------------------------------------

export async function saveCarrierAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  return runAction(
    {
      module: MODULE,
      permission: "处理物流异常",
      success: "承运商已保存",
      audit: () => ({
        action: id ? "update_carrier" : "create_carrier",
        module: "仓储物流",
        detail: `${id ? "修改" : "新建"}承运商 ${name}`,
        targetId: id,
        targetName: name,
      }),
    },
    async ({ sb }) => {
      if (!name) throw new Error("请填写承运商名称");
      const row = {
        code: str(fd, "code"),
        name,
        region: optStr(fd, "region"),
        contact: optStr(fd, "contact"),
        phone: optStr(fd, "phone"),
        tracking_url_template: optStr(fd, "tracking_url_template"),
        service_levels: str(fd, "service_levels")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        // API 接入位：留空表示尚未接入，界面会如实标注「人工录单」。
        api_provider: optStr(fd, "api_provider"),
        api_base_url: optStr(fd, "api_base_url"),
        api_credential_env: optStr(fd, "api_credential_env"),
        webhook_secret_env: optStr(fd, "webhook_secret_env"),
        is_active: str(fd, "is_active") !== "false",
        sort: int(fd, "sort"),
      };
      if (!row.code) throw new Error("请填写承运商代码");

      const configText = str(fd, "api_config");
      let apiConfig: unknown = {};
      if (configText) {
        try {
          apiConfig = JSON.parse(configText);
        } catch {
          throw new Error("API 配置必须是合法的 JSON");
        }
      }

      const { error } = id
        ? await sb.from("carriers").update({ ...row, api_config: apiConfig }).eq("id", id)
        : await sb.from("carriers").insert({ ...row, api_config: apiConfig });
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh();
    },
  );
}

export async function exportShipmentsAction(
  _prev: ActionResult<{ csv: string; filename: string }> | null,
  _fd: FormData,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  return runAction<{ csv: string; filename: string }>(
    {
      module: MODULE,
      permission: "查看发货订单",
      success: (r) => `已生成 ${r.filename}`,
      audit: (r) => ({ action: "export_shipments", module: "仓储物流", detail: `导出 ${r.filename}` }),
    },
    async ({ sb }) => {
      const COLS: CsvColumn<Record<string, unknown>>[] = [
        { key: "order_no", label: "订单号" },
        { key: "carrier", label: "承运商" },
        { key: "tracking_no", label: "物流单号" },
        { key: "destination", label: "目的地" },
        { key: "status", label: "运单状态" },
        { key: "exception", label: "异常说明" },
        { key: "freight_cost", label: "运费" },
        { key: "shipped_at", label: "发出时间" },
        { key: "delivered_at", label: "送达时间" },
      ];
      const { data, error } = await sb
        .from("shipments")
        .select(COLS.map((c) => c.key).join(","))
        .limit(10000);
      if (error) throw new Error(`导出失败：${error.message}`);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      return { csv: buildCsv(rows, COLS), filename: csvFilename("shipments") };
    },
  );
}

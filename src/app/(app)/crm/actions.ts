"use server";

import { revalidatePath } from "next/cache";
import {
  bool,
  dec,
  int,
  list,
  optStr,
  runAction,
  str,
  type ActionResult,
} from "@/lib/actions/common";
import { canActDirectly } from "@/lib/data/approvals";
import { loadSettings } from "@/lib/data/settings";
import { getDb } from "@/lib/data/db";
import { getCurrentAdmin } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getFollowUps, getPointsLedger } from "@/lib/data/queries";
import type { CustomerFollowUp, PointsEntry } from "@/lib/types";

// 客户中心（用户）的写入路径。
//
// 原来这个模块：3 个按钮无 onClick、没有客户详情页、积分与成长值是渲染时
// `total_spent / 10` 和 `orders_count * 100` 算出来的（数据库里根本没有这两列，
// 也就无法手工调增/扣减/冻结/过期/兑换），手机号与邮箱明文展示给所有等级。
//
// 现在：客户 CRUD + 会员等级 + 积分流水 + 标签 + 跟进记录，全部落库；
// 手机号按查看者等级脱敏（security.mask_phone_min_level）。

const MODULE = "crm";

function refresh(customerId?: string) {
  revalidatePath("/crm");
  revalidatePath("/");
  if (customerId) revalidatePath(`/crm/${customerId}`);
}

// ---------------------------------------------------------------------------
// 新建 / 编辑客户
// ---------------------------------------------------------------------------

function customerPatch(fd: FormData): Record<string, unknown> {
  return {
    name: str(fd, "name"),
    country: str(fd, "country", "中国 CN"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    type: str(fd, "type", "individual"),
    province: optStr(fd, "province"),
    city: optStr(fd, "city"),
    address: optStr(fd, "address"),
    birthday: optStr(fd, "birthday"),
    source: optStr(fd, "source"),
    remark: optStr(fd, "remark"),
  };
}

export async function createCustomerAction(
  _prev: ActionResult<{ id: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(
    {
      module: MODULE,
      permission: "新建客户",
      success: "客户已创建",
      audit: (r) => ({
        action: "create_customer",
        module: "客户中心",
        detail: `新建客户 ${str(fd, "name")}`,
        targetId: r.id,
        targetName: str(fd, "name"),
      }),
    },
    async ({ sb, me }) => {
      const patch = customerPatch(fd);
      if (!patch.name) throw new Error("请填写客户姓名");
      if (!patch.email && !patch.phone) throw new Error("邮箱与手机号至少填写一项");

      // 起始等级取门槛最低的那一档，之后由订单汇总触发器自动升级。
      const { data: tier } = await sb
        .from("membership_tiers")
        .select("id,name")
        .eq("is_active", true)
        .order("sort")
        .limit(1)
        .maybeSingle();

      const { data, error } = await sb
        .from("customers")
        .insert({
          ...patch,
          level: tier?.name ?? "新客",
          tier_id: tier?.id ?? null,
          orders_count: 0,
          total_spent: 0,
          points: 0,
          growth: 0,
          status: "active",
          owner_admin_id: me.id,
          last_contacted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`创建失败：${error?.message ?? "未知错误"}`);
      refresh();
      return { id: String(data.id) };
    },
  );
}

export async function updateCustomerAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = str(fd, "id");
  return runAction(
    {
      module: MODULE,
      permission: "修改客户",
      success: "客户资料已保存",
      audit: () => ({
        action: "update_customer",
        module: "客户中心",
        detail: `修改客户 ${str(fd, "name")}`,
        targetId: id,
        targetName: str(fd, "name"),
        after: customerPatch(fd),
      }),
    },
    async ({ sb }) => {
      if (!id) throw new Error("缺少客户 ID");
      const patch = customerPatch(fd);
      if (!patch.name) throw new Error("请填写客户姓名");
      const { error } = await sb.from("customers").update(patch).eq("id", id);
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh(id);
    },
  );
}

/** 软删除。物理删除会让历史订单失去归属，因此只标记 deleted_at。 */
export async function deleteCustomerAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = str(fd, "id");
  const reason = str(fd, "reason");
  return runAction(
    {
      module: MODULE,
      permission: "删除客户",
      success: "客户已停用",
      audit: () => ({
        action: "delete_customer",
        module: "客户中心",
        detail: `停用客户 ${id}：${reason}`,
        targetId: id,
      }),
    },
    async ({ sb }) => {
      if (!reason) throw new Error("停用客户必须填写原因");
      const { count } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", id)
        .not("pay_status", "in", "(refunded)")
        .in("fulfill_status", ["assign", "prep", "wait_ship", "shipped"]);
      if ((count ?? 0) > 0) throw new Error(`该客户还有 ${count} 笔未完成订单，不能停用`);
      const { error } = await sb
        .from("customers")
        .update({ deleted_at: new Date().toISOString(), status: "disabled", remark: reason })
        .eq("id", id);
      if (error) throw new Error(`停用失败：${error.message}`);
      refresh();
    },
  );
}

/** 客户归属调整（谁负责跟进）。 */
export async function reassignCustomerAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = str(fd, "id");
  const ownerId = optStr(fd, "owner_admin_id");
  return runAction(
    {
      module: MODULE,
      permission: "修改客户归属",
      success: "客户归属已调整",
      audit: () => ({
        action: "reassign_customer",
        module: "客户中心",
        detail: `客户 ${id} 归属改为 ${ownerId ?? "未分配"}`,
        targetId: id,
        after: { owner_admin_id: ownerId },
      }),
    },
    async ({ sb }) => {
      const { error } = await sb.from("customers").update({ owner_admin_id: ownerId }).eq("id", id);
      if (error) throw new Error(`调整失败：${error.message}`);
      refresh(id);
    },
  );
}

// ---------------------------------------------------------------------------
// 积分（真实流水，可增可减可过期）
// ---------------------------------------------------------------------------

export async function adjustPointsAction(
  _prev: ActionResult<{ balance: number }> | null,
  fd: FormData,
): Promise<ActionResult<{ balance: number }>> {
  const customerId = str(fd, "customer_id");
  const change = int(fd, "change");
  const reason = str(fd, "reason");
  const type = str(fd, "type", "adjust");

  return runAction<{ balance: number }>(
    {
      module: MODULE,
      permission: "调整积分",
      success: (r) => `积分已调整，当前余额 ${r.balance}`,
      audit: (r) => ({
        action: "adjust_points",
        module: "客户中心",
        detail: `客户 ${customerId} 积分 ${change > 0 ? "+" : ""}${change}：${reason}`,
        targetId: customerId,
        after: { change, balance: r.balance },
      }),
    },
    async ({ sb, me }) => {
      if (!change) throw new Error("请填写非零的调整数量");
      if (!reason) throw new Error("调整积分必须填写原因");

      const settings = await loadSettings();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + settings.crm.pointsExpireMonths);

      const { data, error } = await sb.rpc("gy_apply_points", {
        p_customer_id: customerId,
        p_change: change,
        p_type: type,
        p_reason: reason,
        p_ref_no: optStr(fd, "ref_no"),
        p_operator_id: me.id,
        p_operator_name: me.name,
      });
      if (error) throw new Error(`调整失败：${error.message}`);
      refresh(customerId);
      return { balance: Number(data) || 0 };
    },
  );
}

// ---------------------------------------------------------------------------
// 跟进记录（首页「超 N 天未跟进」依赖 last_contacted_at）
// ---------------------------------------------------------------------------

export async function addFollowUpAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const customerId = str(fd, "customer_id");
  const content = str(fd, "content");
  const nextAt = optStr(fd, "next_at");
  return runAction(
    {
      module: MODULE,
      permission: "修改客户",
      success: "跟进记录已保存",
      audit: () => ({
        action: "add_follow_up",
        module: "客户中心",
        detail: `客户 ${customerId} 新增跟进：${content.slice(0, 40)}`,
        targetId: customerId,
      }),
    },
    async ({ sb, me }) => {
      if (!content) throw new Error("请填写跟进内容");
      const now = new Date().toISOString();
      const { error } = await sb.from("customer_follow_ups").insert({
        customer_id: customerId,
        channel: str(fd, "channel", "note"),
        content,
        next_at: nextAt,
        operator_id: me.id,
        operator_name: me.name,
      });
      if (error) throw new Error(`保存失败：${error.message}`);
      await sb
        .from("customers")
        .update({ last_contacted_at: now, next_follow_up_at: nextAt })
        .eq("id", customerId);
      refresh(customerId);
    },
  );
}

// ---------------------------------------------------------------------------
// 标签
// ---------------------------------------------------------------------------

export async function setCustomerTagsAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const customerId = str(fd, "customer_id");
  const tagIds = list(fd, "tag_id");
  return runAction(
    {
      module: MODULE,
      permission: "修改客户",
      success: "标签已更新",
      audit: () => ({
        action: "set_customer_tags",
        module: "客户中心",
        detail: `客户 ${customerId} 标签更新为 ${tagIds.length} 个`,
        targetId: customerId,
        after: { tagIds },
      }),
    },
    async ({ sb }) => {
      await sb.from("customer_tag_links").delete().eq("customer_id", customerId);
      if (tagIds.length > 0) {
        const { error } = await sb
          .from("customer_tag_links")
          .insert(tagIds.map((tag_id) => ({ customer_id: customerId, tag_id })));
        if (error) throw new Error(`保存标签失败：${error.message}`);
      }
      refresh(customerId);
    },
  );
}

export async function createCustomerTagAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const name = str(fd, "name");
  return runAction(
    {
      module: MODULE,
      permission: "修改客户",
      success: "标签已创建",
      audit: () => ({ action: "create_customer_tag", module: "客户中心", detail: `新建标签 ${name}` }),
    },
    async ({ sb }) => {
      if (!name) throw new Error("请填写标签名称");
      const { error } = await sb.from("customer_tags").insert({
        name,
        color: str(fd, "color", "#5b6470"),
        bg: str(fd, "bg", "#eef0f2"),
        sort: int(fd, "sort"),
      });
      if (error) throw new Error(`创建失败：${error.message}`);
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 会员等级
// ---------------------------------------------------------------------------

export async function upsertMembershipTierAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  return runAction(
    {
      module: MODULE,
      permission: "修改客户",
      success: "会员等级已保存",
      audit: () => ({
        action: id ? "update_membership_tier" : "create_membership_tier",
        module: "客户中心",
        detail: `${id ? "修改" : "新建"}会员等级 ${name}`,
        targetId: id,
        targetName: name,
      }),
    },
    async ({ sb }) => {
      if (!name) throw new Error("请填写等级名称");
      const row = {
        code: str(fd, "code"),
        name,
        min_spent: dec(fd, "min_spent"),
        min_orders: int(fd, "min_orders"),
        discount_rate: dec(fd, "discount_rate", 1),
        points_per_currency: dec(fd, "points_per_currency", 0.1),
        growth_per_order: int(fd, "growth_per_order", 100),
        color: str(fd, "color", "#5b6470"),
        bg: str(fd, "bg", "#eef0f2"),
        sort: int(fd, "sort"),
        is_active: bool(fd, "is_active"),
      };
      if (!row.code) throw new Error("请填写等级代码");
      const { error } = id
        ? await sb.from("membership_tiers").update(row).eq("id", id)
        : await sb.from("membership_tiers").insert(row);
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 导出（含手机号 / 邮箱，超阈值需审批，全程留痕）
// ---------------------------------------------------------------------------

export async function exportCustomersAction(
  _prev: ActionResult<{ csv: string; filename: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const reason = str(fd, "reason", "运营导出");
  const includeContact = bool(fd, "include_contact");

  return runAction<{ csv: string; filename: string }>(
    {
      module: MODULE,
      permission: "导出客户",
      success: (r) => `已生成 ${r.filename}`,
      audit: (r) => ({
        action: "export_customers",
        module: "客户中心",
        detail: `导出客户（${includeContact ? "含" : "不含"}联系方式）：${reason} → ${r.filename}`,
      }),
    },
    async ({ sb, me }) => {
      const cols = includeContact
        ? "name,country,email,phone,type,level,orders_count,total_spent,points,last_order_at,created_at"
        : "name,country,type,level,orders_count,total_spent,points,last_order_at,created_at";
      const { data, error } = await sb
        .from("customers")
        .select(cols)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw new Error(`导出失败：${error.message}`);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];

      const settings = await loadSettings();
      if (rows.length > settings.security.exportApprovalRows) {
        const gate = await canActDirectly(me.level, "export_customers", rows.length);
        if (!gate.allowed) throw new Error(gate.reason ?? "导出行数超过阈值，需要审批");
      }
      if (includeContact && me.level === "L3") {
        throw new Error("三级管理员不可导出含联系方式的客户资料");
      }

      const header = cols.split(",");
      const csv = [
        header.join(","),
        ...rows.map((r) =>
          header.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","),
        ),
      ].join("\n");
      return { csv, filename: `customers-${new Date().toISOString().slice(0, 10)}.csv` };
    },
  );
}

// ---------------------------------------------------------------------------
// 客户详情按需取数（积分流水 / 跟进记录 / 标签）
// ---------------------------------------------------------------------------

export interface CustomerDetail {
  points: PointsEntry[];
  followUps: CustomerFollowUp[];
  tagIds: string[];
  orders: { order_no: string; amount: number; created_at: string; status: string }[];
}

export async function fetchCustomerDetailAction(customerId: string): Promise<CustomerDetail> {
  const me = await getCurrentAdmin();
  const empty: CustomerDetail = { points: [], followUps: [], tagIds: [], orders: [] };
  if (!me || !can(me, MODULE, "查看客户")) return empty;
  const sb = await getDb();
  if (!sb) return empty;

  const [points, followUps, links, orders] = await Promise.all([
    getPointsLedger(customerId, 30),
    getFollowUps(customerId, 20),
    sb.from("customer_tag_links").select("tag_id").eq("customer_id", customerId),
    sb
      .from("orders")
      .select("order_no,amount,created_at,status")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    points,
    followUps,
    tagIds: ((links.data ?? []) as { tag_id: string }[]).map((l) => l.tag_id),
    orders: ((orders.data ?? []) as Record<string, unknown>[]).map((o) => ({
      order_no: String(o.order_no),
      amount: Number(o.amount) || 0,
      created_at: String(o.created_at),
      status: String(o.status),
    })),
  };
}

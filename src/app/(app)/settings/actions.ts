"use server";

import { revalidatePath } from "next/cache";
import {
  bool,
  dec,
  int,
  list,
  optStr,
  requireSuperAdmin,
  runAction,
  str,
  type ActionResult,
} from "@/lib/actions/common";
import { writeSettings } from "@/lib/data/settings";
import { updateDictEntry } from "@/lib/data/dict";
import { decideApprovalRequest } from "@/lib/data/approvals";
import { getCurrentAdmin } from "@/lib/auth/context";
import { SETTING_KEYS } from "@/lib/settings";

// 系统设置的写入路径。
//
// 原状：安全策略页全是只读文字；消息通知的 5 条规则值是写死的 <OnValue text="已开启" />
// （组件结构上只能渲染开启态）；审批阈值存成中文字符串无法比较；业务字典写死在 tokens.ts。

const MODULE = "system";

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// 全局配置（安全策略 / 业务规则）
// ---------------------------------------------------------------------------

const BOOLEAN_KEYS = new Set([
  "security.password_require_mix",
  "security.new_device_otp",
  "security.force_2fa_l1",
  "inventory.count_transit",
  "analytics.vercel_enabled",
]);

const STRING_KEYS = new Set([
  "security.mask_phone_min_level",
  "finance.currency",
  "finance.currency_symbol",
]);

export async function saveSettingsAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const category = str(fd, "category");
  const isSecurity = category === "security";

  if (isSecurity) {
    try {
      await requireSuperAdmin("修改安全策略");
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  return runAction(
    {
      module: MODULE,
      permission: isSecurity ? "修改安全策略" : "设置通知规则",
      success: "配置已保存",
      audit: () => ({
        action: "update_settings",
        module: "系统设置",
        detail: `修改 ${category} 配置`,
        after: Object.fromEntries(fd.entries()),
      }),
    },
    async ({ me }) => {
      const updates: Record<string, unknown> = {};
      for (const key of Object.keys(SETTING_KEYS)) {
        if (!key.startsWith(`${category}.`)) continue;
        if (!fd.has(key)) continue;
        const raw = str(fd, key);
        if (BOOLEAN_KEYS.has(key)) updates[key] = raw === "true";
        else if (STRING_KEYS.has(key)) updates[key] = raw;
        else if (key === "analytics.product_diagnosis") {
          try {
            updates[key] = JSON.parse(raw);
          } catch {
            throw new Error("单品诊断阈值必须是合法 JSON");
          }
        } else {
          const n = Number(raw);
          if (!Number.isFinite(n)) throw new Error(`${key} 必须是数字`);
          updates[key] = n;
        }
      }
      if (Object.keys(updates).length === 0) throw new Error("没有需要保存的改动");
      await writeSettings(updates, me.id);
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 消息通知规则
// ---------------------------------------------------------------------------

export async function saveNotificationRuleAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const eventKey = str(fd, "event_key");
  return runAction(
    {
      module: MODULE,
      permission: "设置通知规则",
      success: "通知规则已保存",
      audit: () => ({
        action: "update_notification_rule",
        module: "系统设置",
        detail: `修改通知规则 ${eventKey}`,
        targetName: eventKey,
        after: Object.fromEntries(fd.entries()),
      }),
    },
    async ({ sb, me }) => {
      const channels = list(fd, "channels");
      const thresholdRaw = str(fd, "threshold");
      let threshold: unknown = {};
      if (thresholdRaw) {
        try {
          threshold = JSON.parse(thresholdRaw);
        } catch {
          throw new Error("触发条件必须是合法 JSON，例如 {\"days\":7}");
        }
      }
      const { error } = await sb
        .from("notification_rules")
        .update({
          enabled: bool(fd, "enabled"),
          channels: channels.length > 0 ? channels : ["inapp"],
          threshold,
          recipients: str(fd, "recipients")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          updated_by: me.id,
        })
        .eq("event_key", eventKey);
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 审批规则（金额可比较的 numeric，取代原来的中文区间字符串）
// ---------------------------------------------------------------------------

export async function saveApprovalRuleAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  return runAction(
    {
      module: MODULE,
      permission: "设置角色",
      success: "审批规则已保存",
      audit: () => ({
        action: id ? "update_approval_rule" : "create_approval_rule",
        module: "系统设置",
        detail: `${id ? "修改" : "新建"}审批规则 ${name}`,
        targetId: id,
        targetName: name,
      }),
    },
    async ({ sb, me }) => {
      if (!name) throw new Error("请填写规则名称");
      const min = dec(fd, "min_amount");
      const maxRaw = str(fd, "max_amount");
      const max = maxRaw === "" ? null : Number(maxRaw);
      if (max !== null && max <= min) throw new Error("上限必须大于下限");

      const row = {
        action_key: str(fd, "action_key"),
        name,
        min_amount: min,
        max_amount: max,
        currency: str(fd, "currency", "CNY"),
        required_level: str(fd, "required_level", "L2"),
        require_2fa: bool(fd, "require_2fa"),
        note: optStr(fd, "note"),
        enabled: bool(fd, "enabled"),
        sort: int(fd, "sort"),
        updated_by: me.id,
      };
      if (!row.action_key) throw new Error("请选择动作类型");

      const { error } = id
        ? await sb.from("approval_rules").update(row).eq("id", id)
        : await sb.from("approval_rules").insert(row);
      if (error) throw new Error(`保存失败：${error.message}`);
      refresh();
    },
  );
}

export async function decideApprovalAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = str(fd, "request_id");
  const approve = str(fd, "decision") === "approve";
  const note = optStr(fd, "note");

  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };

  return runAction(
    {
      module: MODULE,
      permission: "查看操作日志",
      success: approve ? "已通过审批" : "已驳回申请",
      audit: () => ({
        action: approve ? "approve_request" : "reject_request",
        module: "系统设置",
        detail: `${approve ? "通过" : "驳回"}审批单 ${id}${note ? `：${note}` : ""}`,
        targetId: id,
      }),
    },
    async () => {
      await decideApprovalRequest(id, approve, { id: me.id, name: me.name, level: me.level }, note ?? undefined);
      refresh();
    },
  );
}

// ---------------------------------------------------------------------------
// 业务字典（改名 / 配色 / 排序 / 停用）
// ---------------------------------------------------------------------------

export async function saveDictEntryAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = str(fd, "id");
  const label = str(fd, "label");
  return runAction(
    {
      module: MODULE,
      permission: "修改业务字典",
      success: "字典已更新",
      audit: () => ({
        action: "update_dictionary",
        module: "系统设置",
        detail: `字典项 ${id} 改为「${label}」`,
        targetId: id,
        after: { label, color: str(fd, "color"), is_active: bool(fd, "is_active") },
      }),
    },
    async ({ me }) => {
      if (!label) throw new Error("标签不能为空");
      await updateDictEntry(
        id,
        {
          label,
          color: str(fd, "color", "#5b6470"),
          bg: str(fd, "bg", "#eef0f2"),
          sort: int(fd, "sort"),
          is_active: bool(fd, "is_active"),
        },
        me.id,
      );
      refresh();
    },
  );
}

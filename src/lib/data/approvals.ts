import "server-only";

import { cache } from "react";
import { getDb, num, DataReadError } from "./db";
import type { AdminLevel, ApprovalRequest, ApprovalRule } from "@/lib/types";

// 审批阈值判定。
//
// 旧实现（rbac.ts REFUND_TIERS）把金额存成「¥500 – 5,000」这样的中文字符串，
// 无法与订单金额做任何比较 —— 注释还写着「阈值可在系统设置调整，不写死」。
// 现在阈值是 approval_rules 表里的 numeric，下面这个函数是真的在做判断。

export const listApprovalRules = cache(async (): Promise<ApprovalRule[]> => {
  const sb = await getDb();
  if (!sb) return [];
  const { data, error } = await sb
    .from("approval_rules")
    .select("*")
    .eq("enabled", true)
    .order("action_key")
    .order("min_amount");
  if (error) throw new DataReadError("approval_rules", error.message);
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as ApprovalRule),
    min_amount: num(r.min_amount),
    max_amount: r.max_amount === null ? null : num(r.max_amount),
  }));
});

export interface ApprovalDecision {
  /** 需要审批吗 */
  required: boolean;
  /** 需要的最低等级 */
  level: AdminLevel | null;
  requireTwoFactor: boolean;
  rule: ApprovalRule | null;
}

const LEVEL_RANK: Record<AdminLevel, number> = { L1: 3, L2: 2, L3: 1 };

/** 某个动作、某个金额，需要谁审批。 */
export async function approvalFor(
  actionKey: string,
  amount: number,
): Promise<ApprovalDecision> {
  const rules = (await listApprovalRules()).filter((r) => r.action_key === actionKey);
  const hit = rules.find(
    (r) => amount >= r.min_amount && (r.max_amount === null || amount < r.max_amount),
  );
  if (!hit) return { required: false, level: null, requireTwoFactor: false, rule: null };
  return {
    required: true,
    level: hit.required_level,
    requireTwoFactor: hit.require_2fa,
    rule: hit,
  };
}

/** 当前操作人能否直接执行，还是必须发起审批。 */
export async function canActDirectly(
  actorLevel: AdminLevel,
  actionKey: string,
  amount: number,
): Promise<{ allowed: boolean; decision: ApprovalDecision; reason?: string }> {
  const decision = await approvalFor(actionKey, amount);
  if (!decision.required || !decision.level) return { allowed: true, decision };
  if (LEVEL_RANK[actorLevel] >= LEVEL_RANK[decision.level]) {
    if (decision.requireTwoFactor) {
      return {
        allowed: false,
        decision,
        reason: `该金额需要二次验证，当前账号尚未开启（规则：${decision.rule?.name}）`,
      };
    }
    return { allowed: true, decision };
  }
  return {
    allowed: false,
    decision,
    reason: `该金额需要${decision.level === "L1" ? "一级" : "二级"}管理员审批（规则：${decision.rule?.name}）`,
  };
}

export interface CreateApprovalInput {
  actionKey: string;
  title: string;
  amount?: number | null;
  currency?: string;
  payload?: Record<string, unknown>;
  requiredLevel: AdminLevel;
  requesterId: string;
  requesterName: string;
}

export async function createApprovalRequest(
  input: CreateApprovalInput,
): Promise<ApprovalRequest | null> {
  const sb = await getDb();
  if (!sb) return null;
  const { data, error } = await sb
    .from("approval_requests")
    .insert({
      action_key: input.actionKey,
      title: input.title,
      amount: input.amount ?? null,
      currency: input.currency ?? "CNY",
      payload: input.payload ?? {},
      required_level: input.requiredLevel,
      requester_id: input.requesterId,
      requester_name: input.requesterName,
      status: "pending",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`发起审批失败：${error?.message ?? "未知错误"}`);
  return data as ApprovalRequest;
}

export async function decideApprovalRequest(
  id: string,
  approve: boolean,
  approver: { id: string; name: string; level: AdminLevel },
  note?: string,
): Promise<void> {
  const sb = await getDb();
  if (!sb) throw new Error("数据库未配置");

  const { data: row , error: rowErr } = await sb
    .from("approval_requests")
    .select("required_level,status")
    .eq("id", id)
    .maybeSingle();
  if (rowErr) throw new DataReadError("approval_requests", rowErr.message);
  if (!row) throw new Error("审批单不存在");
  if (row.status !== "pending") throw new Error("该审批单已处理");
  if (LEVEL_RANK[approver.level] < LEVEL_RANK[String(row.required_level) as AdminLevel]) {
    throw new Error("当前账号等级不足以审批该申请");
  }

  const { error } = await sb
    .from("approval_requests")
    .update({
      status: approve ? "approved" : "rejected",
      approver_id: approver.id,
      approver_name: approver.name,
      decision_note: note ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`审批失败：${error.message}`);
}

/** 当前登录人待办的审批数量（AdminMenu 的「我的审批」用）。 */
export async function countPendingApprovals(level: AdminLevel): Promise<number> {
  const sb = await getDb();
  if (!sb) return 0;
  const levels: AdminLevel[] = level === "L1" ? ["L1", "L2"] : level === "L2" ? ["L2"] : [];
  if (levels.length === 0) return 0;
  const { count } = await sb
    .from("approval_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .in("required_level", levels);
  return count ?? 0;
}

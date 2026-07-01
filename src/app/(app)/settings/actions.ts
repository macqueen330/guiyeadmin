"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentAdmin, isDemoMode } from "@/lib/auth/context";
import {
  getAdminById,
  insertAdmin,
  updateAdminRow,
  countActiveSuperAdmins,
} from "@/lib/auth/store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logAudit, actorFrom } from "@/lib/auth/audit";
import {
  manageError,
  createLevelError,
  scopeLabelFor,
} from "@/lib/auth/permissions";
import { ROLE_TEMPLATES } from "@/lib/rbac";
import type { Admin, AdminGrant, AdminLevel, AdminStatus, DataScope } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const ok = (message?: string): ActionResult => ({ ok: true, message });
const err = (error: string): ActionResult => ({ ok: false, error });

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// Authorization gate shared by every mutation: valid session, real (non-demo)
// mode, and admin-management rights. Returns the actor or an error result.
async function gate(): Promise<{ actor: Admin } | { fail: ActionResult }> {
  const actor = await getCurrentAdmin();
  if (!actor) return { fail: err("未登录或会话已失效，请重新登录") };
  if (isDemoMode()) return { fail: err("演示模式（未连接 Supabase）不支持账号写操作") };
  if (actor.level === "L3") return { fail: err("三级管理员无权管理账号") };
  return { actor };
}

function statusPatchFor(status: AdminStatus): Record<string, unknown> {
  // Any non-active status forces the target out immediately (epoch bump handled
  // by the caller). Re-activating clears the failure counters.
  if (status === "active") return { status, failed_attempts: 0, locked_until: null };
  return { status };
}

// ---- 创建管理员 ----
export async function createAdminAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const g = await gate();
  if ("fail" in g) return g.fail;
  const { actor } = g;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const dept = String(formData.get("dept") ?? "").trim();
  const level = String(formData.get("level") ?? "L3") as AdminLevel;
  const roleKey = String(formData.get("roleKey") ?? "");
  const scope = String(formData.get("scope") ?? "all") as DataScope;
  const scopeValues = String(formData.get("scopeValues") ?? "")
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const password = String(formData.get("password") ?? "");
  const status = (String(formData.get("status") ?? "active") as AdminStatus) === "pending" ? "pending" : "active";
  const twoFactor = formData.get("two_factor") === "on";
  const forceReset = formData.get("force_reset") !== "off";

  if (!name) return err("请填写姓名");
  if (!email) return err("请填写邮箱");
  if (!PASSWORD_RE.test(password)) return err("初始密码至少 8 位，且需同时包含字母和数字");

  const levelErr = createLevelError(actor, level);
  if (levelErr) return err(levelErr);

  const template = ROLE_TEMPLATES.find((r) => r.key === roleKey);
  const grants: Record<string, AdminGrant> = template ? { ...template.grants } : {};
  const role = template?.name ?? "自定义角色";
  const scopeLabel = scopeLabelFor(scope, scopeValues);

  const sb = getSupabaseAdmin();
  if (!sb) return err("服务未配置");

  // 1) Create the Auth user (password hashed & stored by Supabase Auth).
  const { data: created, error: authErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !created?.user) {
    const msg = authErr?.message ?? "";
    return err(/registered|exist/i.test(msg) ? "该邮箱已被注册" : `创建登录账号失败：${msg}`);
  }

  // 2) Insert the admin row; roll back the Auth user if it fails.
  try {
    const row = {
      id: `a-${randomUUID().slice(0, 8)}`,
      name,
      phone,
      email,
      level,
      role,
      dept,
      scope,
      scope_label: scopeLabel,
      status,
      last_login: "—",
      user_id: created.user.id,
      grants,
      scope_values: scopeValues,
      password_change_required: forceReset,
      two_factor: twoFactor,
      failed_attempts: 0,
      session_epoch: 0,
      created_by: actor.id,
    };
    const inserted = await insertAdmin(row);
    await logAudit({
      category: "operation",
      action: "create_admin",
      actor: actorFrom(actor),
      target_id: inserted?.id,
      target_name: name,
      module: "系统设置",
      detail: `创建 ${level} 管理员「${name}」（${role}）`,
      after: { level, role, scope: scopeLabel, status },
    });
    revalidatePath("/settings");
    return ok(`管理员「${name}」已创建`);
  } catch (e) {
    await sb.auth.admin.deleteUser(created.user.id).catch(() => {});
    return err(`保存管理员失败：${(e as Error).message}`);
  }
}

// ---- 编辑管理员（资料 / 等级 / 角色 / 权限 / 数据范围）----
export async function updateAdminAction(input: {
  id: string;
  name?: string;
  phone?: string;
  dept?: string;
  role?: string;
  level?: AdminLevel;
  scope?: DataScope;
  scopeValues?: string[];
  grants?: Record<string, AdminGrant>;
}): Promise<ActionResult> {
  const g = await gate();
  if ("fail" in g) return g.fail;
  const { actor } = g;

  const target = await getAdminById(input.id);
  if (!target) return err("管理员不存在");

  const manageErr = manageError(actor, target.level);
  if (manageErr) return err(manageErr);

  const newLevel = input.level ?? target.level;
  if (newLevel !== target.level) {
    if (target.id === actor.id) return err("不可修改自己的管理等级");
    const lvlErr = createLevelError(actor, newLevel);
    if (lvlErr) return err(lvlErr);
    if (target.level === "L1" && newLevel !== "L1" && (await countActiveSuperAdmins()) <= 1) {
      return err("最后一个超级管理员不可降级");
    }
  }

  const scope = input.scope ?? target.scope;
  const scopeValues = input.scopeValues ?? target.scope_values ?? [];
  const patch: Record<string, unknown> = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
    ...(input.dept !== undefined ? { dept: input.dept.trim() } : {}),
    ...(input.role !== undefined ? { role: input.role.trim() } : {}),
    level: newLevel,
    scope,
    scope_values: scopeValues,
    scope_label: scopeLabelFor(scope, scopeValues),
    ...(input.grants !== undefined ? { grants: input.grants } : {}),
  };

  const before = { level: target.level, role: target.role, scope: target.scope_label, grants: target.grants };
  await updateAdminRow(target.id, patch);
  await logAudit({
    category: "operation",
    action: "update_admin",
    actor: actorFrom(actor),
    target_id: target.id,
    target_name: target.name,
    module: "系统设置",
    detail: `编辑管理员「${target.name}」的资料 / 权限`,
    before,
    after: { level: newLevel, role: patch.role ?? target.role, scope: patch.scope_label, grants: input.grants ?? target.grants },
  });
  revalidatePath("/settings");
  return ok("已保存");
}

// ---- 停用 / 启用 / 锁定 / 解锁 ----
export async function setStatusAction(id: string, status: AdminStatus): Promise<ActionResult> {
  const g = await gate();
  if ("fail" in g) return g.fail;
  const { actor } = g;

  const target = await getAdminById(id);
  if (!target) return err("管理员不存在");
  const manageErr = manageError(actor, target.level);
  if (manageErr) return err(manageErr);

  const deactivating = status !== "active";
  if (deactivating && target.id === actor.id) return err("不可停用 / 锁定自己的账号");
  if (deactivating && target.level === "L1" && (await countActiveSuperAdmins()) <= 1) {
    return err("最后一个超级管理员不可被停用");
  }

  const patch = statusPatchFor(status);
  // Non-active status invalidates the current session immediately.
  if (deactivating) patch.session_epoch = (target.session_epoch ?? 0) + 1;

  await updateAdminRow(target.id, patch);
  await logAudit({
    category: "operation",
    action: "set_status",
    actor: actorFrom(actor),
    target_id: target.id,
    target_name: target.name,
    module: "系统设置",
    detail: `将管理员「${target.name}」状态改为 ${status}`,
    before: { status: target.status },
    after: { status },
  });
  revalidatePath("/settings");
  return ok("状态已更新");
}

// ---- 重置密码 ----
export async function resetPasswordAction(id: string, newPassword: string): Promise<ActionResult> {
  const g = await gate();
  if ("fail" in g) return g.fail;
  const { actor } = g;

  const target = await getAdminById(id);
  if (!target) return err("管理员不存在");
  const manageErr = manageError(actor, target.level);
  if (manageErr) return err(manageErr);
  if (!PASSWORD_RE.test(newPassword)) return err("新密码至少 8 位，且需同时包含字母和数字");
  if (!target.user_id) return err("该账号未关联登录账号");

  const sb = getSupabaseAdmin();
  if (!sb) return err("服务未配置");
  const { error: e } = await sb.auth.admin.updateUserById(target.user_id, { password: newPassword });
  if (e) return err(`重置密码失败：${e.message}`);

  await updateAdminRow(target.id, { password_change_required: true });
  await logAudit({
    category: "operation",
    action: "reset_password",
    actor: actorFrom(actor),
    target_id: target.id,
    target_name: target.name,
    module: "系统设置",
    detail: `重置管理员「${target.name}」的登录密码`,
  });
  revalidatePath("/settings");
  return ok("密码已重置，该账号下次登录需修改密码");
}

// ---- 强制退出（会话失效）----
export async function forceLogoutAction(id: string): Promise<ActionResult> {
  const g = await gate();
  if ("fail" in g) return g.fail;
  const { actor } = g;

  const target = await getAdminById(id);
  if (!target) return err("管理员不存在");
  const manageErr = manageError(actor, target.level);
  if (manageErr) return err(manageErr);

  await updateAdminRow(target.id, { session_epoch: (target.session_epoch ?? 0) + 1 });
  await logAudit({
    category: "operation",
    action: "force_logout",
    actor: actorFrom(actor),
    target_id: target.id,
    target_name: target.name,
    module: "系统设置",
    detail: `强制退出管理员「${target.name}」的所有会话`,
  });
  revalidatePath("/settings");
  return ok(`已强制退出「${target.name}」`);
}

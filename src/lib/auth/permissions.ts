// Permission resolution — turns the static RBAC config (src/lib/rbac.ts) plus a
// given admin's persisted grants into concrete allow/deny answers. Pure &
// dependency-free so the SAME logic runs on the server (authorization) and on
// the client (menu/button visibility). The server is always the source of truth;
// client checks are only for UX.

import {
  PERMISSION_MODULES,
  ROLE_TEMPLATES,
  grantedActions,
  DATA_SCOPE_LABEL,
} from "@/lib/rbac";
import type { Admin, AdminGrant, AdminLevel, DataScope } from "@/lib/types";

// The subset of an admin needed to evaluate permissions. Works for both the full
// Admin row (server) and the trimmed viewer passed to the client.
export type PermActor = Pick<Admin, "level" | "role"> & {
  grants?: Record<string, AdminGrant>;
};

// Sidebar/route key → permission module key.
export const NAV_TO_MODULE: Record<string, string> = {
  home: "home",
  orders: "orders",
  inventory: "inventory",
  logistics: "logistics",
  crm: "crm",
  channel: "channel",
  brand: "brand",
  finance: "finance",
  payments: "finance",
  analytics: "analytics",
  settings: "system",
};

// The effective module→grant map for an admin:
//  * L1 (超级管理员) always gets everything.
//  * otherwise use the admin's persisted grants (editable at runtime),
//  * falling back to the role template matched by role name (for seed data).
export function effectiveGrants(actor: PermActor): Record<string, AdminGrant> {
  if (actor.level === "L1") {
    return Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, "all"]));
  }
  if (actor.grants && Object.keys(actor.grants).length > 0) return actor.grants;
  const tpl = ROLE_TEMPLATES.find((r) => r.name === actor.role);
  return tpl?.grants ?? {};
}

// Can this admin perform `action` in `moduleKey`? (e.g. can(admin,"orders","审核订单"))
export function can(actor: PermActor, moduleKey: string, action: string): boolean {
  const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey);
  if (!mod) return false;
  const grant = effectiveGrants(actor)[moduleKey];
  return grantedActions(mod, grant).has(action);
}

// Does the admin have any access to a module (used for menu / page gating)?
export function canViewModule(actor: PermActor, moduleKey: string): boolean {
  const grant = effectiveGrants(actor)[moduleKey];
  if (!grant) return false;
  if (grant === "all" || grant === "view") return true;
  return Array.isArray(grant) && grant.length > 0;
}

// Sidebar keys the admin is allowed to see. 首页 is always visible.
export function visibleNavKeys(actor: PermActor): string[] {
  const keys = Object.keys(NAV_TO_MODULE).filter((navKey) => {
    if (navKey === "home") return true;
    if (navKey === "settings") return canManageAdmins(actor) || canViewModule(actor, "system");
    return canViewModule(actor, NAV_TO_MODULE[navKey]);
  });
  return keys;
}

// 管理员管理（创建 / 编辑 / 停用 / 权限 / 日志）：
//  * 三级管理员完全不可进入；
//  * 一级与二级可进入（二级仅能管理三级，具体在 assertCanManage 中限制）。
export function canManageAdmins(actor: Pick<Admin, "level">): boolean {
  return actor.level !== "L3";
}

// 是否可查看某模块的敏感信息（金额 / 手机号 / 成本等）。
export function canSeeSensitive(actor: PermActor, moduleKey: string): boolean {
  if (actor.level === "L1") return true;
  const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey);
  if (!mod) return false;
  const granted = grantedActions(mod, effectiveGrants(actor)[moduleKey]);
  return mod.actions.some((a) => a.sensitive && granted.has(a.name));
}

// ---- 数据范围 ----

export interface ScopeSpec {
  scope: DataScope;
  values: string[];
}

export function scopeOf(admin: Admin): ScopeSpec {
  if (admin.level === "L1") return { scope: "all", values: [] };
  return { scope: admin.scope, values: admin.scope_values ?? [] };
}

export function scopeLabelFor(scope: DataScope, values: string[]): string {
  const base = DATA_SCOPE_LABEL[scope] ?? "全部数据";
  if (scope === "all" || values.length === 0) return base;
  return `${base}（${values.join(" / ")}）`;
}

// ---- 管理员管理授权 ----
// Who may create/edit/disable whom. Returns an error string or null (allowed).
//  * 三级管理员：完全不可管理任何账号。
//  * 二级管理员：只能管理三级管理员。
//  * 一级管理员：可管理所有账号。
export function manageError(
  actor: Pick<Admin, "level">,
  targetLevel: AdminLevel,
): string | null {
  if (!canManageAdmins(actor)) return "无管理员管理权限";
  if (actor.level === "L2" && targetLevel !== "L3") {
    return "二级管理员只能创建 / 管理三级管理员";
  }
  return null;
}

// 创建某等级账号是否允许（一级账号只能由一级创建）。
export function createLevelError(
  actor: Pick<Admin, "level">,
  targetLevel: AdminLevel,
): string | null {
  const base = manageError(actor, targetLevel);
  if (base) return base;
  if (targetLevel === "L1" && actor.level !== "L1") {
    return "一级管理员只能由现有一级管理员创建";
  }
  return null;
}

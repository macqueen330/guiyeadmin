import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { getAdminByUserId } from "./store";
import {
  visibleNavKeys,
  canManageAdmins,
  effectiveGrants,
} from "./permissions";
import type { Admin, AdminGrant, AdminLevel, AdminStatus, DataScope } from "@/lib/types";

// httpOnly cookie carrying the session epoch captured at login. Compared against
// the admin row's session_epoch on every request — a mismatch means the account
// was force-logged-out (epoch bumped), so the session is rejected immediately.
export const EPOCH_COOKIE = "gy-epoch";

// 注意：这里曾经有一个 DEMO_ADMIN 常量 —— 环境变量缺失时它会把访客直接变成
// 「演示管理员 / L1 / scope:all」的超级管理员，proxy.ts 也一并短路。
// 生产环境一次配置失误就等于开放一个无鉴权的超管入口，因此已彻底移除：
// 配置缺失 = 拒绝服务，而不是降级放行。

/** 系统是否已完成配置。未配置时任何人都无法进入控制台。 */
export function isSystemConfigured(): boolean {
  return isAuthConfigured;
}

/** 缺失的环境变量名，登录页用来提示部署者（不泄露任何取值）。 */
export function missingEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

// Allowed to enter the console. Everything else (pending/suspended/locked/
// resigned/closed) is denied at login and on every subsequent request.
function statusAllowsAccess(admin: Admin): boolean {
  if (admin.deleted_at) return false;
  if (admin.status !== "active") return false;
  if (admin.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
    return false;
  }
  return true;
}

// Resolve the current admin from the Supabase session. `cache` dedupes it across
// the layout + page + data layer within a single request. Returns null when there
// is no valid, active, non-force-logged-out session — or when the project isn't
// configured at all.
export const getCurrentAdmin = cache(async (): Promise<Admin | null> => {
  if (!isAuthConfigured) return null;

  const sb = await getSupabaseServer();
  if (!sb) return null;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const admin = await getAdminByUserId(user.id);
  if (!admin || !statusAllowsAccess(admin)) return null;

  // Force-logout / session-epoch check.
  const jar = await cookies();
  const cookieEpoch = jar.get(EPOCH_COOKIE)?.value;
  if (String(admin.session_epoch ?? 0) !== (cookieEpoch ?? "")) return null;

  return admin;
});

// Redirect to /login unless there is a valid session. Use in the authed layout.
export async function requireAdmin(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

/**
 * Server-side gate for a module. Use at the top of every page under (app) that
 * isn't universally visible — the sidebar hiding a link is UX, not authorization.
 */
export async function requireModule(moduleKey: string): Promise<Admin> {
  const admin = await requireAdmin();
  const { canViewModule } = await import("./permissions");
  if (!canViewModule(admin, moduleKey)) redirect("/?denied=" + encodeURIComponent(moduleKey));
  return admin;
}

/**
 * Assert a specific action, for Server Actions. Throws (caught by the action and
 * returned as an error message) rather than redirecting.
 */
export async function assertCan(moduleKey: string, action: string): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("未登录或会话已失效");
  const { can } = await import("./permissions");
  if (!can(admin, moduleKey, action)) {
    throw new Error(`没有「${action}」权限`);
  }
  return admin;
}

// ---- Client-safe viewer ----
// Only non-secret identity + resolved capability flags are sent to the browser.
// The server still re-checks every action; the viewer is purely for UX.
export interface Viewer {
  id: string;
  name: string;
  email: string;
  level: AdminLevel;
  role: string;
  dept: string;
  status: AdminStatus;
  scope: DataScope;
  scopeLabel: string;
  visibleNav: string[];
  canManageAdmins: boolean;
  grants: Record<string, AdminGrant>;
  /** 是否可以看到完整手机号 / 邮箱（由 security.mask_phone_min_level 决定） */
  canSeeFullContact: boolean;
}

export function viewerFor(admin: Admin, canSeeFullContact = false): Viewer {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    level: admin.level,
    role: admin.role,
    dept: admin.dept,
    status: admin.status,
    scope: admin.scope,
    scopeLabel: admin.scope_label,
    visibleNav: visibleNavKeys(admin),
    canManageAdmins: canManageAdmins(admin),
    grants: effectiveGrants(admin),
    canSeeFullContact,
  };
}

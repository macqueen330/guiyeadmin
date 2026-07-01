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
import type { Admin, AdminGrant, AdminLevel, DataScope } from "@/lib/types";

// httpOnly cookie carrying the session epoch captured at login. Compared against
// the admin row's session_epoch on every request — a mismatch means the account
// was force-logged-out (epoch bumped), so the session is rejected immediately.
export const EPOCH_COOKIE = "gy-epoch";

// Stand-in identity used when Supabase auth isn't configured (demo mode), so the
// existing dashboard still renders for preview/build without a database.
export const DEMO_ADMIN: Admin = {
  id: "demo-super",
  name: "演示管理员",
  phone: "138 0000 0000",
  email: "demo@guiye.com",
  level: "L1",
  role: "超级管理员",
  dept: "管理层",
  scope: "all",
  scope_label: "全部数据",
  status: "active",
  last_login: "演示模式",
  session_epoch: 0,
};

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
// is no valid, active, non-force-logged-out session.
export const getCurrentAdmin = cache(async (): Promise<Admin | null> => {
  if (!isAuthConfigured) return DEMO_ADMIN;

  const sb = await getSupabaseServer();
  if (!sb) return DEMO_ADMIN;

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

export function isDemoMode(): boolean {
  return !isAuthConfigured;
}

// ---- Client-safe viewer ----
// Only non-secret identity + resolved capability flags are sent to the browser.
// The server still re-checks every action; the viewer is purely for UX.
export interface Viewer {
  id: string;
  name: string;
  level: AdminLevel;
  role: string;
  dept: string;
  scope: DataScope;
  scopeLabel: string;
  visibleNav: string[];
  canManageAdmins: boolean;
  grants: Record<string, AdminGrant>;
  isDemo: boolean;
}

export function viewerFor(admin: Admin): Viewer {
  return {
    id: admin.id,
    name: admin.name,
    level: admin.level,
    role: admin.role,
    dept: admin.dept,
    scope: admin.scope,
    scopeLabel: admin.scope_label,
    visibleNav: visibleNavKeys(admin),
    canManageAdmins: canManageAdmins(admin),
    grants: effectiveGrants(admin),
    isDemo: isDemoMode(),
  };
}

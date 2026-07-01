"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { getAdminByEmail, updateAdminRow } from "./store";
import { getCurrentAdmin, EPOCH_COOKIE } from "./context";
import { logAudit, actorFrom } from "./audit";
import type { Admin } from "@/lib/types";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 30;

export interface AuthState {
  error?: string;
}

// "YYYY-MM-DD HH:mm" in UTC — matches the existing last_login display style.
function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function setEpochCookie(jar: Awaited<ReturnType<typeof cookies>>, epoch: number) {
  jar.set(EPOCH_COOKIE, String(epoch), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

const STATUS_MESSAGE: Record<string, string> = {
  suspended: "账号已停用，请联系超级管理员",
  resigned: "账号已离职，无法登录",
  closed: "账号已注销，无法登录",
  pending: "账号待激活，请联系管理员激活后登录",
};

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isAuthConfigured) redirect("/"); // demo mode: no real auth

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/") || "/";
  if (!email || !password) return { error: "请输入邮箱和密码" };

  let admin = await getAdminByEmail(email);

  // Unknown email — keep the message generic to avoid account enumeration.
  if (!admin) {
    await logAudit({
      category: "auth",
      action: "login_fail",
      detail: `未知邮箱：${email}`,
      result: "fail",
    });
    return { error: "邮箱或密码错误" };
  }

  // Auto-unlock after the lock window elapses (锁定 30 分钟后自动解锁).
  if (admin.status === "locked") {
    const until = admin.locked_until ? new Date(admin.locked_until).getTime() : 0;
    if (until && until <= Date.now()) {
      admin = (await updateAdminRow(admin.id, {
        status: "active",
        failed_attempts: 0,
        locked_until: null,
      })) as Admin;
    } else {
      return { error: `账号已锁定，请 ${LOCK_MINUTES} 分钟后重试或联系超级管理员` };
    }
  }

  if (admin.status !== "active") {
    await logAudit({
      category: "auth",
      action: "login_fail",
      actor: actorFrom(admin),
      detail: `状态不允许登录：${admin.status}`,
      result: "denied",
    });
    return { error: STATUS_MESSAGE[admin.status] ?? "账号状态异常，无法登录" };
  }

  // Verify the password via Supabase Auth (passwords are hashed by Auth, never
  // stored in our tables). This also establishes the session cookies.
  const sb = await getSupabaseServer();
  if (!sb) return { error: "认证服务未配置" };
  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    const attempts = (admin.failed_attempts ?? 0) + 1;
    const willLock = attempts >= MAX_ATTEMPTS;
    await updateAdminRow(admin.id, {
      failed_attempts: attempts,
      ...(willLock
        ? {
            status: "locked",
            locked_until: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString(),
          }
        : {}),
    });
    await logAudit({
      category: "auth",
      action: "login_fail",
      actor: actorFrom(admin),
      detail: willLock ? "连续错误达上限，账号已锁定" : `密码错误（第 ${attempts} 次）`,
      result: willLock ? "denied" : "fail",
    });
    return {
      error: willLock
        ? `密码连续错误 ${MAX_ATTEMPTS} 次，账号已锁定 ${LOCK_MINUTES} 分钟`
        : `邮箱或密码错误（还可尝试 ${MAX_ATTEMPTS - attempts} 次）`,
    };
  }

  // Success — reset counters, refresh last_login, capture the session epoch.
  await updateAdminRow(admin.id, {
    failed_attempts: 0,
    locked_until: null,
    last_login: stamp(),
  });
  const jar = await cookies();
  setEpochCookie(jar, admin.session_epoch ?? 0);
  await logAudit({
    category: "auth",
    action: "login_success",
    actor: actorFrom(admin),
    result: "success",
  });

  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}

async function doSignOut(reason: string | null, action: string): Promise<never> {
  const admin = await getCurrentAdmin();
  const sb = await getSupabaseServer();
  if (sb) await sb.auth.signOut();
  const jar = await cookies();
  jar.delete(EPOCH_COOKIE);
  if (admin) {
    await logAudit({ category: "auth", action, actor: actorFrom(admin), result: "success" });
  }
  redirect(reason ? `/login?reason=${reason}` : "/login");
}

export async function signOutAction(): Promise<void> {
  await doSignOut(null, "logout");
}

// Called by the client idle watcher after 30 min of inactivity.
export async function signOutIdleAction(): Promise<void> {
  await doSignOut("idle", "logout_idle");
}

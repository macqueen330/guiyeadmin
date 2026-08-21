"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAuthConfigured } from "@/lib/supabase/config";
import { loadSettingsUnauthenticated } from "@/lib/data/settings";
import { getAdminByEmail, updateAdminRow } from "./store";
import { getCurrentAdmin, EPOCH_COOKIE } from "./context";
import { logAudit, actorFrom, requestMeta } from "./audit";
import type { Admin } from "@/lib/types";

// 锁定次数 / 锁定时长 / 会话有效期不再是本文件里的常量：
// 它们存在 app_settings（security.*），系统设置页可改，登录页与安全策略页读同一份。

export interface AuthState {
  error?: string;
}

// "YYYY-MM-DD HH:mm" in UTC — kept for the legacy `last_login` display column.
function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function setEpochCookie(
  jar: Awaited<ReturnType<typeof cookies>>,
  epoch: number,
  sessionHours: number,
) {
  jar.set(EPOCH_COOKIE, String(epoch), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * sessionHours,
  });
}

const STATUS_MESSAGE: Record<string, string> = {
  suspended: "账号已停用，请联系超级管理员",
  resigned: "账号已离职，无法登录",
  closed: "账号已注销，无法登录",
  pending: "账号待激活，请联系管理员激活后登录",
};

async function recordSession(adminId: string, epoch: number): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  try {
    const meta = await requestMeta();
    await sb.from("admin_sessions").insert({
      admin_id: adminId,
      session_epoch: epoch,
      ip: meta.ip,
      device: meta.device,
      user_agent: meta.ua,
    });
  } catch {
    // best-effort：会话记录失败不应阻断登录
  }
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isAuthConfigured) {
    return { error: "系统尚未配置数据库，无法登录。请先在部署环境中设置 Supabase 环境变量。" };
  }

  const { security } = await loadSettingsUnauthenticated();
  const maxAttempts = security.maxLoginAttempts;
  const lockMinutes = security.lockMinutes;

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

  // Auto-unlock after the lock window elapses.
  if (admin.status === "locked") {
    const until = admin.locked_until ? new Date(admin.locked_until).getTime() : 0;
    if (until && until <= Date.now()) {
      admin = (await updateAdminRow(admin.id, {
        status: "active",
        failed_attempts: 0,
        locked_until: null,
      })) as Admin;
    } else {
      return { error: `账号已锁定，请 ${lockMinutes} 分钟后重试或联系超级管理员` };
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
    const willLock = attempts >= maxAttempts;
    await updateAdminRow(admin.id, {
      failed_attempts: attempts,
      ...(willLock
        ? {
            status: "locked",
            locked_until: new Date(Date.now() + lockMinutes * 60_000).toISOString(),
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
        ? `密码连续错误 ${maxAttempts} 次，账号已锁定 ${lockMinutes} 分钟`
        : `邮箱或密码错误（还可尝试 ${maxAttempts - attempts} 次）`,
    };
  }

  // Success — reset counters, refresh last_login, capture the session epoch.
  const now = new Date();
  await updateAdminRow(admin.id, {
    failed_attempts: 0,
    locked_until: null,
    last_login: stamp(now),
    last_login_at: now.toISOString(),
  });
  const jar = await cookies();
  setEpochCookie(jar, admin.session_epoch ?? 0, security.sessionHours);
  await recordSession(admin.id, admin.session_epoch ?? 0);
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
    const service = getSupabaseAdmin();
    if (service) {
      const meta = await requestMeta();
      await service
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
        .eq("admin_id", admin.id)
        .eq("user_agent", meta.ua)
        .is("revoked_at", null);
    }
    await logAudit({ category: "auth", action, actor: actorFrom(admin), result: "success" });
  }
  redirect(reason ? `/login?reason=${reason}` : "/login");
}

export async function signOutAction(): Promise<void> {
  await doSignOut(null, "logout");
}

// Called by the client idle watcher after the configured idle timeout.
export async function signOutIdleAction(): Promise<void> {
  await doSignOut("idle", "logout_idle");
}

/**
 * 强制下线本人的其它设备：自增 session_epoch，所有旧 Cookie 立即失效，
 * 再把当前设备的 epoch 重新写回，避免把自己也踢掉。
 */
export async function revokeOtherSessionsAction(): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "数据库未配置" };

  const nextEpoch = (me.session_epoch ?? 0) + 1;
  await updateAdminRow(me.id, { session_epoch: nextEpoch });

  const meta = await requestMeta();
  await sb
    .from("admin_sessions")
    .update({ revoked_at: new Date().toISOString(), revoked_by: me.id })
    .eq("admin_id", me.id)
    .is("revoked_at", null);
  await sb.from("admin_sessions").insert({
    admin_id: me.id,
    session_epoch: nextEpoch,
    ip: meta.ip,
    device: meta.device,
    user_agent: meta.ua,
  });

  const { security } = await loadSettingsUnauthenticated();
  const jar = await cookies();
  setEpochCookie(jar, nextEpoch, security.sessionHours);

  await logAudit({
    category: "auth",
    action: "revoke_sessions",
    actor: actorFrom(me),
    detail: "强制下线其它设备",
    result: "success",
  });
  return { ok: true };
}

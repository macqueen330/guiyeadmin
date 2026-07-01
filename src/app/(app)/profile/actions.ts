"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin, isDemoMode } from "@/lib/auth/context";
import { updateAdminRow } from "@/lib/auth/store";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logAudit, actorFrom } from "@/lib/auth/audit";

export interface ProfileResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// 编辑本人基本资料（仅姓名 / 手机号 / 部门；等级、角色、权限由管理员管理，不可自改）。
export async function updateOwnProfileAction(
  _prev: ProfileResult,
  formData: FormData,
): Promise<ProfileResult> {
  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };
  if (isDemoMode()) return { ok: false, error: "演示模式（未连接 Supabase）不支持保存" };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const dept = String(formData.get("dept") ?? "").trim();
  if (!name) return { ok: false, error: "姓名不能为空" };

  await updateAdminRow(me.id, { name, phone, dept });
  await logAudit({
    category: "operation",
    action: "update_profile",
    actor: actorFrom(me),
    target_id: me.id,
    target_name: name,
    module: "个人中心",
    detail: "修改本人基本资料",
    before: { name: me.name, phone: me.phone, dept: me.dept },
    after: { name, phone, dept },
  });
  revalidatePath("/profile");
  return { ok: true, message: "资料已保存" };
}

// 修改本人密码：先用旧密码验证，再更新（Supabase Auth 加密存储）。
export async function changeOwnPasswordAction(
  _prev: ProfileResult,
  formData: FormData,
): Promise<ProfileResult> {
  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };
  if (isDemoMode()) return { ok: false, error: "演示模式（未连接 Supabase）不支持修改密码" };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!current || !next) return { ok: false, error: "请填写当前密码与新密码" };
  if (next !== confirm) return { ok: false, error: "两次输入的新密码不一致" };
  if (!PASSWORD_RE.test(next)) return { ok: false, error: "新密码至少 8 位，且需同时包含字母和数字" };

  // Verify the current password.
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "认证服务未配置" };
  const { error: signInErr } = await sb.auth.signInWithPassword({ email: me.email, password: current });
  if (signInErr) {
    await logAudit({ category: "auth", action: "change_password", actor: actorFrom(me), detail: "当前密码校验失败", result: "fail" });
    return { ok: false, error: "当前密码不正确" };
  }

  // Update via the Auth Admin API, then clear the force-change flag.
  const admin = getSupabaseAdmin();
  if (!admin || !me.user_id) return { ok: false, error: "服务未配置" };
  const { error: updErr } = await admin.auth.admin.updateUserById(me.user_id, { password: next });
  if (updErr) return { ok: false, error: `修改密码失败：${updErr.message}` };

  await updateAdminRow(me.id, { password_change_required: false });
  await logAudit({ category: "auth", action: "change_password", actor: actorFrom(me), detail: "本人修改登录密码", result: "success" });
  revalidatePath("/profile");
  return { ok: true, message: "密码已更新" };
}

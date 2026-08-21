"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth/context";
import { updateAdminRow } from "@/lib/auth/store";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logAudit, actorFrom } from "@/lib/auth/audit";
import { loadSettings } from "@/lib/data/settings";
import { validatePassword } from "@/lib/settings";
import { revokeOtherSessionsAction } from "@/lib/auth/actions";
import type { ActionResult } from "@/lib/actions/types";

// 个人中心的写入路径。
//
// 原状：这里用 isDemoMode() 挡住保存 —— 而 isDemoMode 为真时整个系统正跑在
// DEMO_ADMIN 超管身份下。演示模式已经整体移除，未配置就进不来，不需要再判。
// 密码规则原来是本文件里一条写死的正则（8 位 + 字母数字），与系统设置页展示的
// 阈值互不相干；现在统一读 app_settings.security.*。

export type ProfileResult = ActionResult;

// 编辑本人基本资料（仅姓名 / 手机号 / 部门；等级、角色、权限由管理员管理，不可自改）。
export async function updateOwnProfileAction(
  _prev: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const dept = String(formData.get("dept") ?? "").trim();
  if (!name) return { ok: false, error: "姓名不能为空" };
  if (phone && !/^[\d+\-() ]{6,20}$/.test(phone)) {
    return { ok: false, error: "手机号格式不正确" };
  }

  try {
    await updateAdminRow(me.id, { name, phone, dept });
  } catch (e) {
    return { ok: false, error: `保存失败：${(e as Error).message}` };
  }

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
  revalidatePath("/", "layout");
  return { ok: true, message: "资料已保存" };
}

// 修改本人密码：先用旧密码验证，再更新（Supabase Auth 加密存储）。
export async function changeOwnPasswordAction(
  _prev: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  const me = await getCurrentAdmin();
  if (!me) return { ok: false, error: "未登录或会话已失效" };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!current || !next) return { ok: false, error: "请填写当前密码与新密码" };
  if (next !== confirm) return { ok: false, error: "两次输入的新密码不一致" };
  if (next === current) return { ok: false, error: "新密码不能与当前密码相同" };

  const { security } = await loadSettings();
  const weak = validatePassword(next, security);
  if (weak) return { ok: false, error: weak };

  // Verify the current password.
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "认证服务未配置" };
  const { error: signInErr } = await sb.auth.signInWithPassword({
    email: me.email,
    password: current,
  });
  if (signInErr) {
    await logAudit({
      category: "auth",
      action: "change_password",
      actor: actorFrom(me),
      detail: "当前密码校验失败",
      result: "fail",
    });
    return { ok: false, error: "当前密码不正确" };
  }

  // Update via the Auth Admin API, then clear the force-change flag.
  const admin = getSupabaseAdmin();
  if (!admin || !me.user_id) return { ok: false, error: "服务未配置" };
  const { error: updErr } = await admin.auth.admin.updateUserById(me.user_id, {
    password: next,
  });
  if (updErr) return { ok: false, error: `修改密码失败：${updErr.message}` };

  await updateAdminRow(me.id, { password_change_required: false });
  await logAudit({
    category: "auth",
    action: "change_password",
    actor: actorFrom(me),
    detail: "本人修改登录密码",
    result: "success",
  });
  revalidatePath("/profile");
  return { ok: true, message: "密码已更新" };
}

/** 强制下线其它设备。表单包装，便于 useActionState 使用。 */
export async function revokeSessionsFormAction(
  _prev: ProfileResult | null,
  _fd: FormData,
): Promise<ProfileResult> {
  const r = await revokeOtherSessionsAction();
  if (!r.ok) return { ok: false, error: r.error ?? "操作失败" };
  revalidatePath("/profile");
  return { ok: true, message: "其它设备已全部下线" };
}

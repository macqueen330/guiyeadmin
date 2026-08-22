import "server-only";

import { getCurrentAdmin } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { logAudit, actorFrom } from "@/lib/auth/audit";
import { getDb } from "@/lib/data/db";
import type { Admin } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// 所有业务写操作的统一入口。
//
// 之前整个「运营控制台」能写进数据库的只有登录、登出、改本人资料、改本人密码 ——
// 约 45 个按钮点了没有任何反应。现在每个写操作都走这里：
//   鉴权 → 执行 → 审计 → 失效缓存，缺一不可。

export type { ActionResult } from "./types";
import type { ActionResult } from "./types";

export const ok = <T>(message?: string, data?: T): ActionResult<T> => ({ ok: true, message, data });
export const fail = <T = void>(error: string): ActionResult<T> => ({ ok: false, error });

export interface AuthorizedContext {
  me: Admin;
  sb: SupabaseClient;
}

/**
 * 校验登录 + 模块动作权限，返回可写的数据库客户端。
 * 权限不足或未配置数据库时抛错，由 runAction 统一转成 ActionResult。
 */
export async function authorize(moduleKey: string, action: string): Promise<AuthorizedContext> {
  const me = await getCurrentAdmin();
  if (!me) throw new Error("未登录或会话已失效，请重新登录");
  if (!can(me, moduleKey, action)) throw new Error(`没有「${action}」权限`);
  const sb = await getDb();
  if (!sb) throw new Error("数据库未配置，无法保存");
  return { me, sb };
}

export async function requireSuperAdmin(action: string): Promise<Admin> {
  const me = await getCurrentAdmin();
  if (!me) throw new Error("未登录或会话已失效，请重新登录");
  if (me.level !== "L1") throw new Error(`「${action}」仅一级管理员可操作`);
  return me;
}

export interface AuditSpec {
  action: string;
  module: string;
  detail?: string;
  targetId?: string | null;
  targetName?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * 包装一个写操作：统一 try/catch、统一审计、统一错误文案。
 * `fn` 抛出的 Error.message 会原样显示给管理员，所以写人话。
 */
export async function runAction<T>(
  opts: {
    module: string;
    permission: string;
    audit: (result: T) => AuditSpec;
    /** 成功后展示给管理员的提示语 */
    success?: string | ((result: T) => string);
  },
  fn: (ctx: AuthorizedContext) => Promise<T>,
): Promise<ActionResult<T>> {
  let ctx: AuthorizedContext;
  try {
    ctx = await authorize(opts.module, opts.permission);
  } catch (e) {
    const me = await getCurrentAdmin();
    if (me) {
      await logAudit({
        category: "operation",
        action: opts.permission,
        actor: actorFrom(me),
        module: opts.module,
        detail: (e as Error).message,
        result: "denied",
      });
    }
    return fail((e as Error).message);
  }

  try {
    const result = await fn(ctx);
    const spec = opts.audit(result);
    await logAudit({
      category: "operation",
      action: spec.action,
      actor: actorFrom(ctx.me),
      module: spec.module,
      detail: spec.detail,
      target_id: spec.targetId,
      target_name: spec.targetName,
      before: spec.before,
      after: spec.after,
      result: "success",
    });
    const message =
      typeof opts.success === "function" ? opts.success(result) : (opts.success ?? "已保存");
    return ok<T>(message, result);
  } catch (e) {
    const message = (e as Error).message || "操作失败";
    await logAudit({
      category: "operation",
      action: opts.permission,
      actor: actorFrom(ctx.me),
      module: opts.module,
      detail: message,
      result: "fail",
    });
    return fail(message);
  }
}

// ---- FormData 取值助手（Server Action 的入参都是字符串）----


// ---------------------------------------------------------------------------
// 写入结果校验
// ---------------------------------------------------------------------------

/**
 * PostgREST 的 UPDATE / DELETE 命中 0 行时返回 204，**error 是 null**。
 * 只判断 error 的写法会在下面这些情况下谎报成功：
 *   * 行被 RLS 策略过滤掉（生产环境最常见）
 *   * 页面开了很久，行已被别人删除 / 软删除
 *   * id 拼错或前端传了空值
 * 症状就是「界面提示已保存，回头一看数据没变」。
 *
 * 所以所有针对单条记录的写入都要经过这里：带 select 拿回受影响的行，
 * 0 行一律当作失败。
 */
export async function mustAffect(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  what: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await q;
  if (error) throw new Error(`${what}失败：${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) {
    throw new Error(`${what}失败：没有匹配到记录（可能已被删除，或当前账号无权修改）。请刷新后重试。`);
  }
  return rows;
}

export function str(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return v === null ? fallback : String(v).trim();
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

export function int(fd: FormData, key: string, fallback = 0): number {
  const n = Number(str(fd, key));
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function dec(fd: FormData, key: string, fallback = 0): number {
  const n = Number(str(fd, key));
  return Number.isFinite(n) ? n : fallback;
}

export function bool(fd: FormData, key: string): boolean {
  const v = str(fd, key).toLowerCase();
  return v === "true" || v === "on" || v === "1" || v === "yes";
}

export function list(fd: FormData, key: string): string[] {
  return fd
    .getAll(key)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Admin, AdminSession } from "@/lib/types";

// Server-side data access for the admins table via the service-role client.
// RLS blocks anon/authenticated, so ALL reads/writes go through here AFTER the
// caller has been authorized in application code. Returns null / [] in demo mode.

// `*` 而不是逐列枚举：PostgREST 对任何一个不存在的列都会整条查询报错，
// 而 store 的失败会让 getCurrentAdmin() 返回 null（= 直接被登出）。列名清单
// 与迁移之间的任何一次不同步都会造成全站不可登录，风险远大于多取几列。
const COLS = "*";

/**
 * 解析管理员的有效模块权限：
 *   1) 本人 grants（后台单独授权，优先级最高）
 *   2) roles 表里 role_id 对应的角色（运行时可改）
 *   3) 什么都没有 → 交给 permissions.ts 用角色名匹配内置模板兜底
 * 旧实现只有第 3 步，且用中文显示名匹配 —— 角色改名就等于权限清零。
 */
async function withRoleGrants(admin: Admin | null): Promise<Admin | null> {
  if (!admin) return null;
  if (admin.grants && Object.keys(admin.grants).length > 0) return admin;
  if (!admin.role_id) return admin;
  const sb = getSupabaseAdmin();
  if (!sb) return admin;
  const { data } = await sb
    .from("roles")
    .select("grants,level,scope")
    .eq("id", admin.role_id)
    .maybeSingle();
  if (!data) return admin;
  return { ...admin, grants: (data.grants ?? {}) as Admin["grants"] };
}

export async function listAdmins(): Promise<Admin[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("admins")
    .select(COLS)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error || !data) return null;
  return data as unknown as Admin[];
}

export async function getAdminByUserId(userId: string): Promise<Admin | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("admins").select(COLS).eq("user_id", userId).maybeSingle();
  return withRoleGrants((data as unknown as Admin) ?? null);
}

export async function getAdminByEmail(email: string): Promise<Admin | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb
    .from("admins")
    .select(COLS)
    .ilike("email", email)
    .is("deleted_at", null)
    .maybeSingle();
  return withRoleGrants((data as unknown as Admin) ?? null);
}

export async function getAdminById(id: string): Promise<Admin | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("admins").select(COLS).eq("id", id).maybeSingle();
  return withRoleGrants((data as unknown as Admin) ?? null);
}

// Count of active super admins — used to protect the last L1 from being disabled.
export async function countActiveSuperAdmins(): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { count } = await sb
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("level", "L1")
    .eq("status", "active")
    .is("deleted_at", null);
  return count ?? 0;
}

export async function insertAdmin(row: Record<string, unknown>): Promise<Admin | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from("admins").insert(row).select(COLS).single();
  if (error) throw error;
  return data as unknown as Admin;
}

export async function updateAdminRow(
  id: string,
  patch: Record<string, unknown>,
): Promise<Admin | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("admins")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as Admin;
}

export interface AuditLog {
  id: string;
  category: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_level: string | null;
  target_id: string | null;
  target_name: string | null;
  module: string | null;
  detail: string | null;
  ip: string | null;
  device: string | null;
  result: string;
  created_at: string;
}

export async function listAuditLogs(
  category?: "auth" | "operation",
  limit = 100,
): Promise<AuditLog[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  let q = sb.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error || !data) return null;
  return data as AuditLog[];
}

// 本人的登录会话（个人中心 → 登录设备）。
// 原来这一页展示的是两条写死的 SAMPLE_AUTH（"macOS / Chrome"、"Windows / Edge"），
// 现在读 admin_sessions —— 登录时写入、退出 / 强制下线时标记 revoked_at。
export async function listSessionsByAdmin(
  adminId: string,
  limit = 20,
): Promise<AdminSession[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("admin_sessions")
    .select("*")
    .eq("admin_id", adminId)
    .order("signed_in_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as AdminSession[];
}

// Logs for a single admin (个人中心 → 登录设备 / 个人日志).
export async function listAuditLogsByActor(
  actorId: string,
  category?: "auth" | "operation",
  limit = 50,
): Promise<AuditLog[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  let q = sb
    .from("admin_audit_logs")
    .select("*")
    .eq("actor_id", actorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error || !data) return null;
  return data as AuditLog[];
}

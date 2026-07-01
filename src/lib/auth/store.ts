import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Admin } from "@/lib/types";

// Server-side data access for the admins table via the service-role client.
// RLS blocks anon/authenticated, so ALL reads/writes go through here AFTER the
// caller has been authorized in application code. Returns null / [] in demo mode.

const COLS =
  "id,name,phone,email,level,role,dept,scope,scope_label,status,last_login," +
  "user_id,grants,scope_values,password_change_required,two_factor," +
  "failed_attempts,locked_until,session_epoch,created_by,deleted_at,created_at,updated_at";

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
  return (data as unknown as Admin) ?? null;
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
  return (data as unknown as Admin) ?? null;
}

export async function getAdminById(id: string): Promise<Admin | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("admins").select(COLS).eq("id", id).maybeSingle();
  return (data as unknown as Admin) ?? null;
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

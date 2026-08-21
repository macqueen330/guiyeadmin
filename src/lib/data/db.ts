import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAuthConfigured } from "@/lib/supabase/config";
import { getCurrentAdmin } from "@/lib/auth/context";

// ---------------------------------------------------------------------------
// Single entry point for business-data access.
//
// 迁移 0008 之后，anon / authenticated 对所有业务表都是 0 条策略 —— 浏览器拿着
// anon key 什么也读不到。服务端改用 service_role 客户端，**但只在
// requireAdmin()/getCurrentAdmin() 通过之后**：应用层是唯一的授权边界。
//
// 与旧的 fetchTable() 的关键区别：
//   * 「查询成功但表为空」不再等同于「没连上数据库」—— 空集是合法答案，返回 []。
//   * 没有任何 mock 回退。数据库没配好就是没数据，界面显示空态而不是假数据。
// ---------------------------------------------------------------------------

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase 未配置：请设置 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
    this.name = "DatabaseNotConfiguredError";
  }
}

export const isDatabaseConfigured = isAuthConfigured;

/**
 * Service-role client for an authenticated admin. Returns null when the project
 * isn't configured or there is no valid session — callers render an empty state.
 */
export async function getDb(): Promise<SupabaseClient | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const me = await getCurrentAdmin();
  if (!me) return null;
  return sb;
}

/**
 * Service-role client WITHOUT an admin session. Only for endpoints that
 * authenticate by other means — payment/logistics webhooks (signature) and the
 * website analytics collector (public write-only). Never use in page code.
 */
export function getServiceDb(): SupabaseClient | null {
  return getSupabaseAdmin();
}

export interface OrderSpec {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

/**
 * Read a whole table. Returns [] for "no database" and for "table is empty" —
 * the caller cannot tell them apart on purpose; both mean "nothing to show".
 * Use isDatabaseConfigured when the distinction matters for messaging.
 */
export async function selectAll<T>(
  table: string,
  opts: { order?: OrderSpec; limit?: number; columns?: string } = {},
): Promise<T[]> {
  const sb = await getDb();
  if (!sb) return [];
  let q = sb.from(table).select(opts.columns ?? "*");
  if (opts.order) {
    q = q.order(opts.order.column, {
      ascending: opts.order.ascending ?? true,
      nullsFirst: opts.order.nullsFirst ?? false,
    });
  }
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    console.error(`[data] select ${table} failed:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

/**
 * PostgREST serialises `numeric` as a JSON string. Every aggregate in this app
 * sums money columns, so coerce at the boundary rather than string-concatenating.
 */
export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Coerce the listed keys of every row to numbers (see `num`). */
export function coerceNumbers<T extends Record<string, unknown>>(
  rows: T[],
  keys: (keyof T)[],
): T[] {
  return rows.map((row) => {
    const out = { ...row };
    for (const k of keys) out[k] = num(out[k]) as T[keyof T];
    return out;
  });
}

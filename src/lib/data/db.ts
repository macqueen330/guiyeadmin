import "server-only";

import { cache } from "react";
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
//   * 「查询失败」也不等同于「表为空」—— 读取出错一律抛 DataReadError，由
//     src/app/(app)/error.tsx 显示「数据读取失败 + 原因」。以前这里 return []，
//     结果是把表读不到、RLS 拒绝、网络抖动全都渲染成「暂无数据」，
//     和真的没有数据长得一模一样，故障可以无声无息地挂很久。
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
 * 一次数据库读取失败。**不要**把它降级成空集 —— 空集的意思是「确实没有数据」，
 * 而这个的意思是「不知道有没有数据」。两者在界面上必须长得不一样。
 */
export class DataReadError extends Error {
  readonly source: string;
  readonly reason: string;
  constructor(source: string, reason: string) {
    super(`读取 ${source} 失败：${reason}`);
    this.name = "DataReadError";
    this.source = source;
    this.reason = reason;
  }
}

export interface ReadFailure {
  source: string;
  reason: string;
}

/**
 * 请求级的读取失败登记。React 的 cache() 每个请求一份，所以这里天然是
 * 「本次渲染」的作用域，不会串到别的请求上。
 *
 * 生产环境下 Next 会把 Server Component 抛出的错误信息替换成通用文案（只留
 * digest），所以真正的原因不能指望 error.tsx 去显示 —— 得在服务端渲染进页面。
 * 允许降级的聚合读取（仪表盘的单张卡片）把失败登记在这里，组件再据此渲染
 * 「读取失败」而不是「暂无数据」。
 */
const readFailureStore = cache((): { list: ReadFailure[] } => ({ list: [] }));

export function recordReadFailure(source: string, reason: string): void {
  const store = readFailureStore();
  if (store.list.some((f) => f.source === source)) return; // 同一数据源只记一次
  store.list.push({ source, reason });
  console.error(`[data] 读取 ${source} 失败：${reason}`);
}

/** 本次请求中读取失败的数据源。组件用它把空态换成故障提示。 */
export function readFailures(): ReadFailure[] {
  return readFailureStore().list;
}

/** 这些数据源里有没有读挂的？用于「是真的没数据，还是没读到」的判断。 */
export function readFailed(...sources: string[]): ReadFailure | null {
  return readFailureStore().list.find((f) => sources.includes(f.source)) ?? null;
}

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
 * Read a whole table. Returns [] for "no database" and for "table is empty";
 * **throws** DataReadError when the query itself fails.
 *
 * 没配数据库和表是空的都返回 []（都等于「没有可显示的东西」），但查询失败会抛 ——
 * 那是「读不到」，不是「没有」。用 isDatabaseConfigured 区分前两者。
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
  if (error) throw new DataReadError(table, error.message);
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

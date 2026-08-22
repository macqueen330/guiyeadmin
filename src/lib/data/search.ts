import "server-only";

// 全局搜索。
//
// 顶栏那个搜索框原来是纯装饰：没有 value、没有 onChange、没有 form，
// 敲回车什么也不会发生。现在它跳到 /search?q=，由这里真的查数据库。
//
// 搜索在服务端用 PostgREST 的 ilike 完成（而不是把整表拉回来再 filter），
// 每类结果最多 20 条，并且严格受调用者的模块权限限制。

import { getDb, num } from "./db";
import { canViewModule } from "@/lib/auth/permissions";
import type { Admin } from "@/lib/types";

export interface SearchHit {
  kind: "order" | "customer" | "product" | "shipment";
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  href: string;
}

export interface SearchResults {
  q: string;
  groups: { key: string; label: string; hits: SearchHit[] }[];
  total: number;
  /** 因为没有对应模块权限而未参与检索的分类 */
  skipped: string[];
}

/** PostgREST 的 or() 里逗号是分隔符，百分号是通配 —— 先把用户输入清洗掉。 */
function sanitize(q: string): string {
  return q.replace(/[,()%*\\]/g, " ").trim();
}

const LIMIT = 20;

/**
 * PostgREST 的错误必须打出来。
 * 之前这里直接 `data ?? []`，结果 select 里写错一个列名（orders.channel，
 * 实际叫 order_channel）时整类结果静默变成 0 条，界面上看起来只是「没搜到」。
 */
function rows(
  label: string,
  res: { data: unknown[] | null; error: { message: string } | null },
): Record<string, unknown>[] {
  if (res.error) {
    console.error(`[search] ${label} 查询失败：${res.error.message}`);
    return [];
  }
  return (res.data ?? []) as Record<string, unknown>[];
}

export async function searchAll(rawQ: string, me: Admin): Promise<SearchResults> {
  const q = sanitize(rawQ).slice(0, 60);
  const empty: SearchResults = { q, groups: [], total: 0, skipped: [] };
  if (q.length < 1) return empty;

  const sb = await getDb();
  if (!sb) return empty;

  const like = `%${q}%`;
  const groups: SearchResults["groups"] = [];
  const skipped: string[] = [];

  // ---- 订单 ----
  if (canViewModule(me, "orders")) {
    const res = await sb
      .from("orders")
      .select("id,order_no,customer_name,order_channel,status,amount,currency,created_at")
      .or(`order_no.ilike.${like},customer_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    const hits = rows("订单", res).map((r) => {
      return {
        kind: "order" as const,
        id: String(r.id),
        title: String(r.order_no ?? ""),
        subtitle: String(r.customer_name ?? "—"),
        meta: `${String(r.currency ?? "CNY")} ${num(r.amount).toLocaleString()} · ${String(r.order_channel ?? "")}`,
        href: `/orders/${encodeURIComponent(String(r.order_no ?? ""))}`,
      };
    });
    if (hits.length > 0) groups.push({ key: "orders", label: "订单", hits });
  } else {
    skipped.push("订单");
  }

  // ---- 客户 ----
  if (canViewModule(me, "crm")) {
    const res = await sb
      .from("customers")
      .select("id,name,phone,email,city,type,orders_count,total_spent")
      .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},city.ilike.${like}`)
      .is("deleted_at", null)
      .limit(LIMIT);
    const hits = rows("客户", res).map((r) => {
      return {
        kind: "customer" as const,
        id: String(r.id),
        title: String(r.name ?? ""),
        subtitle: [r.city, r.type].filter(Boolean).join(" · ") || "—",
        meta: `${num(r.orders_count)} 单 · 累计 ${num(r.total_spent).toLocaleString()}`,
        href: `/crm?q=${encodeURIComponent(String(r.name ?? ""))}`,
      };
    });
    if (hits.length > 0) groups.push({ key: "customers", label: "客户", hits });
  } else {
    skipped.push("客户");
  }

  // ---- 商品 ----
  if (canViewModule(me, "inventory")) {
    const res = await sb
      .from("products")
      .select("id,sku_code,name,category,spec,price,status")
      .or(`sku_code.ilike.${like},name.ilike.${like},category.ilike.${like}`)
      .limit(LIMIT);
    const hits = rows("商品", res).map((r) => {
      return {
        kind: "product" as const,
        id: String(r.id),
        title: String(r.name ?? ""),
        subtitle: `${String(r.sku_code ?? "")} · ${String(r.spec ?? "—")}`,
        meta: `${String(r.category ?? "")} · ${num(r.price).toLocaleString()}`,
        href: `/inventory?q=${encodeURIComponent(String(r.sku_code ?? ""))}`,
      };
    });
    if (hits.length > 0) groups.push({ key: "products", label: "商品", hits });
  } else {
    skipped.push("商品");
  }

  // ---- 运单 ----
  if (canViewModule(me, "logistics")) {
    const res = await sb
      .from("shipments")
      .select("id,tracking_no,order_no,carrier,status,destination")
      .or(`tracking_no.ilike.${like},order_no.ilike.${like}`)
      .limit(LIMIT);
    const hits = rows("运单", res).map((r) => {
      return {
        kind: "shipment" as const,
        id: String(r.id),
        title: String(r.tracking_no ?? "（未填单号）"),
        subtitle: `${String(r.order_no ?? "")} · ${String(r.carrier ?? "")}`,
        meta: String(r.destination ?? "—"),
        href: `/logistics?q=${encodeURIComponent(String(r.tracking_no ?? r.order_no ?? ""))}`,
      };
    });
    if (hits.length > 0) groups.push({ key: "shipments", label: "运单", hits });
  } else {
    skipped.push("运单");
  }

  return {
    q,
    groups,
    total: groups.reduce((s, g) => s + g.hits.length, 0),
    skipped,
  };
}

// Connectivity / schema check for a Supabase project. Verifies which tables the
// dashboard can actually read (and thus won't fall back to mock data).
//
// Run with your project's env (anon key only — never the service_role key):
//   node --experimental-strip-types --env-file=.env.local scripts/db-check.mts
//
// Or inline:
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//     node --experimental-strip-types scripts/db-check.mts

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url || !key) {
  console.error("✗ 未检测到环境变量。\n  请设置 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY，\n  例如：cp .env.example .env.local 填入后，用 --env-file=.env.local 运行。");
  process.exit(1);
}

// Tables the read layer (src/lib/data/queries.ts) queries.
const TABLES = [
  "warehouses", "products", "inventory_view", "dealers", "customers",
  "orders", "order_items", "shipments", "settlements", "brand_assets",
  "system_users", "payments", "refunds", "admins",
];

// New columns added by migration 0002 — read layer needs these on `orders`.
const ORDER_NEW_COLS = ["order_type", "order_channel", "customer_source", "payment_method", "pay_status", "fulfill_status", "settle_status"];

const sb = createClient(url, key);

console.log(`\n连接 ${url}\n`);

let ok = 0;
let missing = 0;
for (const t of TABLES) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  if (error) {
    missing++;
    console.log(`  ✗ ${t.padEnd(16)} 读取失败 → 会回退 mock（${error.message}）`);
  } else {
    ok++;
    console.log(`  ✓ ${t.padEnd(16)} ${count ?? 0} 行`);
  }
}

// Check the split-status columns exist on orders.
const { error: colErr } = await sb.from("orders").select(ORDER_NEW_COLS.join(",")).limit(1);
console.log("");
if (colErr) {
  console.log(`  ⚠ orders 缺少拆分字段（${ORDER_NEW_COLS.join(" / ")}）\n     → 请运行 supabase/migrations/0002_orders_payments_admin.sql`);
} else {
  console.log("  ✓ orders 拆分字段齐全（0002 已应用）");
}

console.log(`\n结果：${ok}/${TABLES.length} 张表可读，${missing} 张会回退示例数据。\n`);

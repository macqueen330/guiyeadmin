// Schema / data check for a Supabase project.
//
// 迁移 0008 之后 anon 已经读不到任何业务表（这是刻意的），所以这个脚本改用
// service_role 连接 —— 它检查的是「后台服务端能不能读到数据」，不是「浏览器能不能」。
//
//   node --experimental-strip-types --env-file=.env.local scripts/db-check.mts
//
// 顺带验证 anon 确实被挡住：如果 anon 还能读 customers / payments，会显式报警。

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !serviceKey) {
  console.error(
    "✗ 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。\n" +
      "  cp .env.example .env.local 填好后用 --env-file=.env.local 运行。",
  );
  process.exit(1);
}

// 读取层（src/lib/data/*）会用到的对象。
const CORE_TABLES = [
  "warehouses", "products", "inventory", "inventory_view", "product_categories",
  "price_tiers", "product_prices", "dealers", "customers", "membership_tiers",
  "points_ledger", "customer_tags", "customer_follow_ups",
  "orders", "order_items", "order_events", "order_finance_view",
  "shipments", "shipment_events", "carriers", "logistics_webhook_events",
  "settlements", "payments", "refunds", "payment_gateways",
  "payment_webhook_events", "reconciliation_batches",
  "app_settings", "dictionaries", "notification_rules", "approval_rules",
  "approval_requests", "inventory_moves",
  "web_events", "web_event_types", "web_analytics_daily", "web_page_stats",
  "web_traffic_sources", "web_device_stats", "web_region_stats", "web_product_stats",
  "departments", "roles", "admins", "admin_sessions", "admin_audit_logs",
  "brand_assets",
];

// 必须存在的数据库函数（0007）。
const FUNCTIONS: [string, Record<string, unknown>][] = [
  ["gy_effective_price", { p_product_id: "__probe__", p_tier_code: "retail", p_qty: 1 }],
];

// 迁移 0005 把这些列换成了时间类型；仍是 text 就说明迁移没跑。
const TIME_COLUMNS: [string, string][] = [
  ["orders", "created_at"],
  ["customers", "last_order_at"],
  ["payments", "paid_at"],
  ["shipments", "shipped_at"],
];

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\n连接 ${url}\n`);
console.log("── 表 / 视图 ──────────────────────────────");

let ok = 0;
const missing: string[] = [];
let empty = 0;

for (const t of CORE_TABLES) {
  const { count, error } = await admin.from(t).select("*", { count: "exact", head: true });
  if (error) {
    missing.push(t);
    console.log(`  ✗ ${t.padEnd(26)} 不存在或不可读（${error.message}）`);
  } else {
    ok++;
    const n = count ?? 0;
    if (n === 0) empty++;
    console.log(`  ${n === 0 ? "·" : "✓"} ${t.padEnd(26)} ${n} 行${n === 0 ? "（空表 → 界面显示空态）" : ""}`);
  }
}

console.log("\n── 时间列类型（0005）─────────────────────");
for (const [table, col] of TIME_COLUMNS) {
  const { data, error } = await admin.from(table).select(col).limit(1);
  if (error) {
    console.log(`  ⚠ ${table}.${col} 无法检查：${error.message}`);
    continue;
  }
  const sample = (data ?? [])[0] as Record<string, unknown> | undefined;
  const value = sample?.[col];
  if (value === undefined || value === null) {
    console.log(`  · ${table}.${col} 暂无数据可判断`);
  } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    console.log(`  ✓ ${table}.${col} 已是时间类型`);
  } else {
    console.log(`  ✗ ${table}.${col} 仍是 text（"${value}"）→ 请运行 0005_cleanup_and_time_types.sql`);
  }
}

console.log("\n── 数据库函数（0007）─────────────────────");
for (const [fn, args] of FUNCTIONS) {
  const { error } = await admin.rpc(fn, args);
  if (error && /does not exist|not find/i.test(error.message)) {
    console.log(`  ✗ ${fn} 不存在 → 请运行 0007_functions_triggers.sql`);
  } else {
    console.log(`  ✓ ${fn}`);
  }
}

console.log("\n── RLS 收口检查（0008）───────────────────");
if (!anonKey) {
  console.log("  · 未提供 anon key，跳过");
} else {
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let leaks = 0;
  for (const t of ["customers", "payments", "refunds", "orders"]) {
    const { data, error } = await anon.from(t).select("*").limit(1);
    if (!error && data && data.length > 0) {
      leaks++;
      console.log(`  ✗ ${t.padEnd(12)} anon 仍可读取！→ 请运行 0008_rls_lockdown.sql`);
    } else {
      console.log(`  ✓ ${t.padEnd(12)} anon 已被拒绝`);
    }
  }
  if (leaks === 0) console.log("  所有敏感表都已对 anon 关闭。");
}

console.log(
  `\n结果：${ok}/${CORE_TABLES.length} 个对象可读` +
    (missing.length ? `，缺少 ${missing.length} 个：${missing.join(", ")}` : "") +
    `，其中 ${empty} 个为空表。\n`,
);
if (missing.length > 0) {
  console.log("按顺序执行：0005 → 0006 → 0007 → 0008 → seed_reference.sql →（可选）seed_samples.sql\n");
}

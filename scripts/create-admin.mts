// Bootstrap / manage a super admin (一级管理员) for the GUIYE console.
//
// Creates the Supabase Auth user AND the linked `admins` row so the account can
// log in. Requires the SERVICE ROLE key (never ship this to the browser).
//
// Usage (after applying migrations 0001–0003):
//   node --experimental-strip-types --env-file=.env.local scripts/create-admin.mts \
//     --email admin@guiye.com --password 'Guiye2026' --name 超级管理员
//
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const email = (arg("--email") ?? "").toLowerCase().trim();
const password = arg("--password") ?? "";
const name = arg("--name") ?? "超级管理员";
const level = (arg("--level") ?? "L1") as "L1" | "L2" | "L3";

if (!url || !serviceKey) {
  console.error("✗ 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
  console.error("  在 Supabase → Project Settings → API 复制 service_role key，写入 .env.local 后重试。");
  process.exit(1);
}
if (!email || !password) {
  console.error("✗ 用法：--email <邮箱> --password <至少8位含字母数字> [--name <姓名>] [--level L1|L2|L3]");
  process.exit(1);
}
if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
  console.error("✗ 密码至少 8 位，且需同时包含字母和数字。");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

console.log(`\n连接 ${url}\n创建 ${level} 管理员：${name} <${email}>\n`);

// 1) Auth user (idempotent-ish: reuse if already present).
let userId: string | undefined;
const { data: created, error: createErr } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr) {
  if (/registered|exist/i.test(createErr.message)) {
    const { data: list } = await sb.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (userId) {
      await sb.auth.admin.updateUserById(userId, { password });
      console.log("• Auth 用户已存在，已更新其密码。");
    }
  }
  if (!userId) {
    console.error("✗ 创建 Auth 用户失败：", createErr.message);
    process.exit(1);
  }
} else {
  userId = created.user?.id;
  console.log("• 已创建 Auth 用户。");
}

// 2) admins row (upsert by user_id).
const { data: existing } = await sb.from("admins").select("id").eq("user_id", userId).maybeSingle();

const row = {
  id: `a-${randomUUID().slice(0, 8)}`,
  name,
  phone: "",
  email,
  level,
  role: level === "L1" ? "超级管理员" : level === "L2" ? "业务管理员" : "操作员",
  dept: "管理层",
  scope: "all",
  scope_label: "全部数据",
  status: "active",
  last_login: "—",
  user_id: userId,
  grants: {},
  scope_values: [],
  password_change_required: false,
  two_factor: false,
  failed_attempts: 0,
  session_epoch: 0,
};

if (existing) {
  await sb.from("admins").update({ status: "active", level, name }).eq("id", (existing as { id: string }).id);
  console.log("• admins 记录已存在，已更新为启用。");
} else {
  const { error: insErr } = await sb.from("admins").insert(row);
  if (insErr) {
    console.error("✗ 写入 admins 失败：", insErr.message);
    process.exit(1);
  }
  console.log("• 已写入 admins 记录。");
}

console.log(`\n✓ 完成。现在可用 ${email} 登录 /login。\n`);

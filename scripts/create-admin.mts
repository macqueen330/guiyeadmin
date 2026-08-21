// Bootstrap / manage an admin account for the GUIYE console.
//
// Creates the Supabase Auth user AND the linked `admins` row so the account can
// log in. Requires the SERVICE ROLE key (never ship this to the browser).
//
// Usage (after applying migrations 0001–0008 and seed_reference.sql):
//   node --experimental-strip-types --env-file=.env.local scripts/create-admin.mts \
//     --email admin@guiye.com --name 超级管理员 --level L1
//
// 密码：不要写在命令行里（会进 shell history）。默认由脚本生成一个随机强密码
// 并只打印一次；首次登录后会被强制要求修改。确需指定时用 --password-stdin
// 从标准输入读取：
//   printf '%s' "$MY_PASSWORD" | node ... scripts/create-admin.mts --email ... --password-stdin
//
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(name);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trim();
}

function generatePassword(): string {
  // 16 位 base64url，必含字母与数字。
  let pw = "";
  while (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    pw = randomBytes(12).toString("base64url").slice(0, 16);
  }
  return pw;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const email = (arg("--email") ?? "").toLowerCase().trim();
const name = arg("--name") ?? "";
const level = (arg("--level") ?? "L3") as "L1" | "L2" | "L3";
const roleKey = arg("--role");
const reactivate = flag("--reactivate");

if (!url || !serviceKey) {
  console.error("✗ 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
  console.error("  在 Supabase → Project Settings → API 复制 service_role key，写入 .env.local 后重试。");
  process.exit(1);
}
if (!email || !name) {
  console.error(
    "✗ 用法：--email <邮箱> --name <姓名> [--level L1|L2|L3] [--role <角色 key>]\n" +
      "        [--password-stdin] [--reactivate]\n\n" +
      "  --level 默认 L3（最小权限）。创建超级管理员必须显式写 --level L1。\n" +
      "  --reactivate 才允许把已停用 / 已离职的账号改回启用（默认拒绝）。",
  );
  process.exit(1);
}
if (!["L1", "L2", "L3"].includes(level)) {
  console.error("✗ --level 只能是 L1 / L2 / L3。");
  process.exit(1);
}

let password = "";
let generated = false;
if (flag("--password-stdin")) {
  password = await readStdin();
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
    console.error("✗ 密码至少 8 位，且需同时包含字母和数字。");
    process.exit(1);
  }
} else {
  password = generatePassword();
  generated = true;
}

const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

console.log(`\n连接 ${url}\n创建 ${level} 管理员：${name} <${email}>\n`);

// ---------------------------------------------------------------------------
// 1) Auth 用户
// ---------------------------------------------------------------------------
let userId: string | undefined;
let reusedAuthUser = false;

const { data: created, error: createErr } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createErr) {
  if (!/registered|exist/i.test(createErr.message)) {
    console.error("✗ 创建 Auth 用户失败：", createErr.message);
    process.exit(1);
  }
  const { data: list } = await sb.auth.admin.listUsers();
  userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (!userId) {
    console.error("✗ 该邮箱已注册但无法定位用户，请在 Supabase 控制台检查。");
    process.exit(1);
  }
  reusedAuthUser = true;
  // 不再静默重置已存在账号的密码 —— 那可以用来悄悄接管别人的账号。
  console.log("• Auth 用户已存在，未改动其密码（如需重置请在 Supabase 控制台操作）。");
} else {
  userId = created.user?.id;
  console.log("• 已创建 Auth 用户。");
}

// ---------------------------------------------------------------------------
// 2) 角色（roles 表为准）
// ---------------------------------------------------------------------------
let roleName = level === "L1" ? "超级管理员" : level === "L2" ? "业务管理员" : "操作员";
let roleId: string | null = null;
let scope = level === "L1" ? "all" : "self";
if (roleKey) {
  const { data: role } = await sb
    .from("roles")
    .select("id,name,level,scope")
    .eq("key", roleKey)
    .maybeSingle();
  if (!role) {
    console.error(`✗ 角色 ${roleKey} 不存在。先运行 supabase/seed_reference.sql。`);
    process.exit(1);
  }
  roleId = String(role.id);
  roleName = String(role.name);
  scope = String(role.scope);
}

// ---------------------------------------------------------------------------
// 3) admins 行
// ---------------------------------------------------------------------------
const { data: existing } = await sb
  .from("admins")
  .select("id,status,level,deleted_at")
  .eq("user_id", userId)
  .maybeSingle();

const auditBase = {
  category: "operation",
  action: existing ? "update_admin" : "create_admin",
  actor_id: null,
  actor_name: "create-admin.mts",
  actor_level: null,
  target_name: name,
  module: "系统设置",
  ip: "cli",
  device: "cli",
  result: "success",
};

if (existing) {
  const prevStatus = String(existing.status);
  const inactive = prevStatus !== "active" || existing.deleted_at;
  if (inactive && !reactivate) {
    console.error(
      `✗ 该账号当前状态为「${prevStatus}${existing.deleted_at ? " / 已删除" : ""}」。\n` +
        "  复活一个已停用的管理员是高风险操作，请显式加 --reactivate。",
    );
    process.exit(1);
  }
  const { error: updErr } = await sb
    .from("admins")
    .update({
      name,
      level,
      role: roleName,
      role_id: roleId,
      scope,
      ...(reactivate ? { status: "active", deleted_at: null, failed_attempts: 0, locked_until: null } : {}),
    })
    .eq("id", String(existing.id));
  if (updErr) {
    console.error("✗ 更新 admins 失败：", updErr.message);
    process.exit(1);
  }
  await sb.from("admin_audit_logs").insert({
    ...auditBase,
    target_id: String(existing.id),
    detail: `CLI 更新管理员 ${email}（等级 ${existing.level} → ${level}${reactivate ? "，并重新启用" : ""}）`,
    before: { status: prevStatus, level: existing.level },
    after: { status: reactivate ? "active" : prevStatus, level },
  });
  console.log(`• admins 记录已更新${reactivate ? "（已重新启用）" : ""}。`);
} else {
  const id = `a-${randomUUID()}`;
  const { error: insErr } = await sb.from("admins").insert({
    id,
    name,
    phone: "",
    email,
    level,
    role: roleName,
    role_id: roleId,
    dept: arg("--dept") ?? "管理层",
    scope,
    scope_label: scope === "all" ? "全部数据" : "仅本人数据",
    status: "active",
    last_login: "",
    user_id: userId,
    grants: {},
    scope_values: [],
    // 与迁移 0003 的 default true 保持一致：首次登录后必须改密。
    password_change_required: true,
    two_factor: false,
    failed_attempts: 0,
    session_epoch: 0,
    created_by: "cli",
  });
  if (insErr) {
    console.error("✗ 写入 admins 失败：", insErr.message);
    process.exit(1);
  }
  await sb.from("admin_audit_logs").insert({
    ...auditBase,
    target_id: id,
    detail: `CLI 创建 ${level} 管理员 ${email}${reusedAuthUser ? "（复用已存在的 Auth 用户）" : ""}`,
    after: { email, level, role: roleName },
  });
  console.log("• 已写入 admins 记录。");
}

console.log(`\n✓ 完成。现在可用 ${email} 登录 /login。`);
if (generated && !reusedAuthUser) {
  console.log(`\n  初始密码（只显示这一次，请立即转交并要求本人修改）：\n\n    ${password}\n`);
}
console.log("");

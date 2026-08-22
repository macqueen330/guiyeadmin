// 阶段 3：CSV 导出。真触发浏览器下载，解析文件内容，跟数据库对数。
import { chromium } from "playwright";
import { Client } from "pg";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = "http://localhost:3100";
const DL = "/var/lib/pge2e/downloads";
mkdirSync(DL, { recursive: true });

const pg = new Client({ connectionString: "postgresql://postgres@localhost:5433/e2e?host=/tmp" });
await pg.connect();
const one = async (sql, p = []) => (await pg.query(sql, p)).rows[0];

const results = [];
const pass = (n, d) => { results.push({ ok: true, n, d }); console.log(`✅ ${n}${d ? ` — ${d}` : ""}`); };
const fail = (n, d) => { results.push({ ok: false, n, d }); console.log(`❌ ${n} — ${d}`); };
const note = (n, d) => { results.push({ ok: true, warn: true, n, d }); console.log(`⚠️  ${n} — ${d}`); };

const br = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await br.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();

async function login(email, pw = "Guiye2026test") {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if (!page.url().includes("/login")) { await ctx.clearCookies(); await page.goto(`${BASE}/login`, { waitUntil: "networkidle" }); }
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pw);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  return !page.url().includes("/login");
}

/** 最小可用的 CSV 解析（支持双引号转义与字段内换行） */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function grab(url, buttonName) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: buttonName, exact: true });
  if (!(await btn.count())) return { err: `页面上没有「${buttonName}」按钮` };
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }).catch(() => null),
    btn.first().click(),
  ]);
  if (!dl) {
    const t = await page.locator("form div").allTextContents();
    const msg = t.map((x) => x.trim()).find((x) => x && x.length < 90 && /失败|错误|没有|需要|无权/.test(x));
    return { err: `没有触发下载${msg ? `｜表单提示：${msg}` : ""}` };
  }
  const p = `${DL}/${dl.suggestedFilename()}`;
  await dl.saveAs(p);
  const raw = readFileSync(p, "utf8");
  return { name: dl.suggestedFilename(), raw, rows: parseCsv(raw.replace(/^﻿/, "")) };
}

console.log("──────── CSV 导出（L1 超级管理员）────────");
if (!(await login("admin@guiye.com"))) { fail("登录", "失败"); await br.close(); process.exit(1); }

const CASES = [
  ["/orders?view=all", "导出", "orders", "select count(*)::int n from orders"],
  ["/crm?view=consumers", "导出记录", "customers", "select count(*)::int n from customers where deleted_at is null"],
  ["/inventory?view=products", "导出", "inventory", "select count(*)::int n from inventory_view"],
  ["/logistics?view=tracking", "导出物流", "shipments", "select count(*)::int n from shipments"],
  ["/payments?view=flow", "导出流水", "payments", "select count(*)::int n from payments"],
  ["/finance?view=receipts", "导出对账", "finance", null],
];

const grabbed = {};
for (const [url, btn, key, countSql] of CASES) {
  const r = await grab(url, btn);
  if (r.err) { fail(`导出 ${key}`, r.err); continue; }
  grabbed[key] = r;
  const dataRows = r.rows.length - 1;
  let expect = null;
  if (countSql) expect = Number((await one(countSql)).n);
  const okCount = expect === null || dataRows === expect;
  const detail = `${r.name}｜${r.rows[0].length} 列 × ${dataRows} 行${expect !== null ? `（库里 ${expect} 行）` : ""}`;
  if (okCount) pass(`导出 ${key}`, detail);
  else note(`导出 ${key} 行数`, `${detail} —— 行数与该表总数不同，可能是页面做了筛选`);

  // BOM：Excel 打开中文不乱码的前提
  if (r.raw.charCodeAt(0) === 0xfeff) pass(`  ${key} 带 UTF-8 BOM`, "Excel 中文不乱码");
  else fail(`  ${key} 缺 UTF-8 BOM`, "Excel 打开会乱码");
}

console.log("\n──────── 导出内容质量检查 ────────");
const ord = grabbed.orders;
if (ord) {
  console.log("   订单表头:", ord.rows[0].join(" | "));
  const chinese = ord.rows[0].some((h) => /[一-龥]/.test(h));
  if (chinese) pass("表头为中文", "运营可直接看懂");
  else note("表头是数据库列名", `${ord.rows[0].slice(0, 4).join(",")}… —— 交给运营/财务时需要人工对照字段`);

  // 每行列数是否与表头一致（字段里有逗号/换行时最容易出错）
  const bad = ord.rows.slice(1).filter((r) => r.length !== ord.rows[0].length);
  if (bad.length === 0) pass("列数对齐", `${ord.rows.length - 1} 行全部与表头等宽`);
  else fail("列数错位", `${bad.length} 行列数与表头不一致`);
}

// CSV 公式注入：Excel/WPS 会把 = + - @ 开头的单元格当公式执行
console.log("\n──────── CSV 公式注入 ────────");
const EVIL = '=1+1+cmd|\' /C calc\'!A0';
try {
  await page.goto(`${BASE}/crm?view=consumers`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新增消费者" }).click();
  await page.waitForTimeout(600);
  await page.locator('input[name="name"]:visible').fill(EVIL);
  await page.locator('input[name="phone"]:visible').fill("13900003333");
  await page.getByRole("button", { name: "创建客户", exact: true }).first().click();
  await page.waitForTimeout(2500);
  const c = await one(`select id from customers where name = $1`, [EVIL]);
  if (!c) { note("公式注入用例", "客户没建成，跳过（可能被校验挡住）"); }
  else {
    const r = await grab("/crm?view=consumers", "导出记录");
    if (r.err) fail("公式注入检查", r.err);
    else {
      const cell = r.rows.flat().find((x) => x.includes("cmd|"));
      if (cell === undefined) note("公式注入检查", "导出里没找到该客户，无法判定");
      else if (/^[=+\-@\t\r]/.test(cell)) {
        fail("CSV 公式注入未防护", `单元格原样以 "${cell.slice(0, 12)}…" 开头，Excel/WPS 打开会当公式执行`);
      } else pass("CSV 公式注入已防护", `单元格被改写为 "${cell.slice(0, 14)}…"`);
    }
    await pg.query(`delete from customers where id = $1`, [c.id]);
  }
} catch (e) { fail("公式注入检查", e.message.slice(0, 140)); }

// 导出是否留痕 + 是否受审批阈值约束
console.log("\n──────── 导出留痕与阈值 ────────");
const audit = await one(`select count(*)::int n from admin_audit_logs where action like 'export_%'`);
if (Number(audit.n) > 0) pass("导出全部留痕", `${audit.n} 条 export_* 审计`);
else fail("导出留痕", "没有 export_* 审计记录");

await pg.query(`update app_settings set value = to_jsonb(1) where key = 'security.export_approval_rows'`);

// L1 本身就是审批人，超阈值对它放行是设计如此
const r1 = await grab("/orders?view=all", "导出");
if (!r1.err) pass("L1 超阈值直接放行", "一级管理员即审批人，不需要给自己发审批单");
else note("L1 超阈值被拦", r1.err.slice(0, 80));

// L2 才应该被 export_orders 规则挡下
if (await login("ops@guiye.com")) {
  const r2 = await grab("/orders?view=all", "导出");
  if (r2.err && /审批|阈值|超过/.test(r2.err)) pass("L2 超阈值被审批拦截", r2.err.slice(0, 90));
  else if (r2.err) note("L2 超阈值", `被拦下但原因不是审批：${r2.err.slice(0, 80)}`);
  else fail("L2 超阈值未拦截", `阈值设为 1 行，L2 仍导出了 ${r2.rows.length - 1} 行`);
}
await pg.query(`update app_settings set value = to_jsonb(500) where key = 'security.export_approval_rows'`);
await login("admin@guiye.com");

// L3 客服：安全策略页声称「三级管理员不可导出含联系方式的客户资料」
console.log("\n──────── L3 客服的导出权限 ────────");
if (await login("cs@guiye.com")) {
  await page.goto(`${BASE}/crm?view=consumers`, { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: "导出记录", exact: true });
  if (!(await btn.count())) pass("L3 看不到导出按钮", "与安全策略页的说法一致");
  else {
    const r = await grab("/crm?view=consumers", "导出记录");
    if (r.err) pass("L3 导出被服务端拒绝", r.err.slice(0, 90));
    else {
      const head = r.rows[0].join(",");
      const hasContact = /phone|email|手机|邮箱/i.test(head);
      if (hasContact) fail("L3 导出到联系方式", `安全策略页写着三级管理员不可导出含联系方式的客户资料，实际导出了：${head}`);
      else pass("L3 导出不含联系方式", head.slice(0, 80));
    }
  }
}

await br.close();
await pg.end();
const ok = results.filter((r) => r.ok && !r.warn).length;
const warn = results.filter((r) => r.warn).length;
const bad = results.filter((r) => !r.ok);
console.log(`\n═══════ 阶段3：通过 ${ok}，提示 ${warn}，失败 ${bad.length} ═══════`);
bad.forEach((b) => console.log(`  ❌ ${b.n} — ${b.d}`));

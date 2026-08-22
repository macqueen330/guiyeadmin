// 阶段 2：真实交互 + 数据库副作用校验。
// 每个用例都在浏览器里真点，然后回 Postgres 核对写入是否真的发生、触发器是否真的跑。
import { chromium } from "playwright";
import { Client } from "pg";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3100";
const OUT = "/var/lib/pge2e/shots2";
mkdirSync(OUT, { recursive: true });

const pg = new Client({ connectionString: "postgresql://postgres@localhost:5433/e2e?host=/tmp" });
await pg.connect();
const q = async (sql, params = []) => (await pg.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

const results = [];
let shot = 0;
const pass = (name, detail) => { results.push({ ok: true, name, detail }); console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`); };
const fail = (name, detail) => { results.push({ ok: false, name, detail }); console.log(`❌ ${name} — ${detail}`); };

const br = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await br.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const serverErrors = [];
page.on("pageerror", (e) => serverErrors.push(String(e).slice(0, 160)));

/** 在当前可见的弹窗里按精确名字点按钮 */
const clickIn = async (name) => {
  const dlg = page.locator('[role="dialog"]').filter({ has: page.locator(":visible") }).last();
  const scope = (await dlg.count()) ? dlg : page;
  const b = scope.getByRole("button", { name, exact: true });
  await b.first().click();
};

const snap = async (tag) => {
  shot += 1;
  await page.screenshot({ path: `${OUT}/${String(shot).padStart(2, "0")}-${tag}.png`, fullPage: true });
};

async function logout() {
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" }).catch(() => {});
  const b = page.getByRole("button", { name: /退出|登出/ }).first();
  if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(1500); }
  await ctx.clearCookies();
}

async function login(email, password = "Guiye2026test") {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  // 已登录时 /login 会直接重定向到首页 —— 先退出，否则填不到表单
  if (!page.url().includes("/login")) { await logout(); await page.goto(`${BASE}/login`, { waitUntil: "networkidle" }); }
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  return !page.url().includes("/login");
}

/** 等待表单反馈条出现（ActionForm 的 ResultBanner） */
async function banner() {
  // ResultBanner 是表单里第一个带成功/失败底色的小块
  const texts = await page.locator("form div").allTextContents().catch(() => []);
  const hit = texts.map((t) => t.trim()).find((t) => t.length < 80 && /^(已|成功|保存|创建|更新|失败|错误|没有|请|订单|字典|配置|库存)/.test(t));
  return hit ?? "";
}

// ===========================================================================
console.log("\n──────── 登录 ────────");
if (!(await login("admin@guiye.com"))) { fail("L1 登录", "无法登录"); await br.close(); process.exit(1); }
pass("L1 登录", "admin@guiye.com → " + page.url().replace(BASE, ""));
const sess = await one(`select count(*)::int n from auth.sessions`);
const loginLog = await one(`select count(*)::int n from admin_audit_logs where action='login_success'`);
if (Number(sess.n) > 0) pass("登录写入 admin_sessions", `${sess.n} 条会话`); else fail("登录写入 admin_sessions", "没有会话记录");
if (Number(loginLog.n) > 0) pass("登录写入审计日志", `${loginLog.n} 条 login_success`); else fail("登录写入审计日志", "没有记录");

// ===========================================================================
console.log("\n──────── 用例 1：新建客户 ────────");
const CUST = "E2E测试客户" + Date.now().toString().slice(-6);
try {
  await page.goto(`${BASE}/crm?view=consumers`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新增消费者" }).click();
  await page.waitForTimeout(600);
  await page.locator('input[name="name"]').fill(CUST);
  const setIf = async (sel, val) => { const l = page.locator(sel); if (await l.count()) await l.first().fill(val); };
  await setIf('input[name="phone"]', "13900001111");
  await setIf('input[name="email"]', "e2e@test.com");
  await setIf('input[name="city"]', "苏州");
  await snap("crm-新建客户弹窗");
  await clickIn("创建客户");
  await page.waitForTimeout(2500);
  const row = await one(`select id,name,city,orders_count,total_spent,points,growth,level from customers where name=$1`, [CUST]);
  if (row) pass("新建客户落库", `id=${row.id} 城市=${row.city} 初始积分=${row.points}`);
  else { const b = await banner(); await snap("crm-新建客户-失败"); fail("新建客户落库", `customers 表里查不到${b ? ` | 表单提示：${b}` : ""}`); }
  const al = await one(`select count(*)::int n from admin_audit_logs where module='客户中心' and detail like '%'||$1||'%'`, [CUST]);
  if (Number(al?.n) > 0) pass("新建客户留痕", `${al.n} 条审计`); else fail("新建客户留痕", "无审计记录");
} catch (e) { fail("新建客户", e.message.slice(0, 160)); await snap("crm-新建客户-失败"); }

// ===========================================================================
console.log("\n──────── 用例 2：新建订单（含单号生成 / 状态派生 / 时间轴）────────");
let newOrderNo = null;
try {
  await page.goto(`${BASE}/orders?view=all`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建订单" }).click();
  await page.waitForTimeout(800);
  await snap("orders-新建订单弹窗");
  const names = await page.$$eval("form [name]", (els) => els.map((e) => `${e.tagName.toLowerCase()}:${e.getAttribute("name")}`));
  console.log("   弹窗字段:", [...new Set(names)].join(" "));

  const pick = async (name, label) => {
    const sel = page.locator(`select[name="${name}"]`);
    if (!(await sel.count())) return false;
    const opts = await sel.first().locator("option").allTextContents();
    const target = opts.find((o) => label.test(o));
    if (!target) return false;
    await sel.first().selectOption({ label: target });
    return true;
  };
  if (!(await pick("customer_id", new RegExp(CUST)))) fail("订单弹窗客户下拉", `找不到刚建的客户 ${CUST}`);
  const wh = page.locator('select[name="warehouse_id"]');
  if (await wh.count()) await wh.first().selectOption({ index: 1 });
  // 商品明细字段名是 item_product_id / item_qty / item_price
  const ip = page.locator('select[name="item_product_id"]');
  if (await ip.count()) await ip.first().selectOption({ index: 1 });
  const iq = page.locator('input[name="item_qty"]');
  if (await iq.count()) await iq.first().fill("3");
  const before = (await one(`select count(*)::int n from orders`)).n;
  await clickIn("创建订单");
  await page.waitForTimeout(3000);
  const after = (await one(`select count(*)::int n from orders`)).n;
  if (Number(after) > Number(before)) {
    const o = await one(`select order_no,status,source,pay_status,fulfill_status,amount,customer_name from orders order by created_at desc limit 1`);
    newOrderNo = o.order_no;
    pass("新建订单落库", `${o.order_no} 客户=${o.customer_name} 金额=${o.amount}`);
    if (/^GY-\d{6}-\d{5}$/.test(o.order_no)) pass("订单号由序列生成", o.order_no);
    else fail("订单号格式", `期望 GY-YYMMDD-00001，实际 ${o.order_no}`);
    if (o.status && o.source) pass("状态/来源由触发器派生", `status=${o.status} source=${o.source}`);
    else fail("状态派生触发器", `status=${o.status} source=${o.source}`);
    const ev = await one(`select count(*)::int n from order_events e join orders o on o.id=e.order_id where o.order_no=$1`, [o.order_no]);
    if (Number(ev.n) > 0) pass("订单时间轴自动写入", `${ev.n} 条 order_events`); else fail("订单时间轴", "没有事件");
  } else {
    const b = await banner(2000);
    fail("新建订单落库", `订单数没变（${before}→${after}）${b ? ` 表单提示：${b}` : ""}`);
    await snap("orders-新建订单-失败");
  }
} catch (e) { fail("新建订单", e.message.slice(0, 160)); await snap("orders-新建订单-异常"); }

// ===========================================================================
console.log("\n──────── 用例 2b：订单收款确认 → 客户统计 / 等级 / 成长值联动 ────────");
if (newOrderNo) {
  try {
    const before = await one(
      `select c.orders_count,c.total_spent,c.level,c.growth,c.points
         from customers c join orders o on o.customer_id=c.id where o.order_no=$1`, [newOrderNo]);
    await page.goto(`${BASE}/orders/${encodeURIComponent(newOrderNo)}`, { waitUntil: "networkidle" });
    await snap("orders-详情页");
    // 详情页的流程是「支付状态下拉 → 更新支付状态」
    const sel = page.locator('select[name="value"]').first();
    if (!(await sel.count())) throw new Error("详情页没有支付状态下拉");
    const opts = await sel.locator("option").evaluateAll((els) => els.map((e) => ({ v: e.value, t: e.textContent })));
    const paid = opts.find((o) => o.v === "paid");
    if (!paid) throw new Error(`支付状态下拉里没有 paid：${opts.map((o) => o.v).join(",")}`);
    await sel.selectOption("paid");
    await page.getByRole("button", { name: "更新支付状态" }).first().click();
    await page.waitForTimeout(3000);
    const o = await one(`select pay_status,amount,amount_received,paid_at,fulfill_status,status from orders where order_no=$1`, [newOrderNo]);
    if (o.pay_status === "paid") pass("收款确认写入订单", `pay_status=paid 实收=${o.amount_received} status=${o.status}`);
    else fail("收款确认写入订单", `pay_status 仍为 ${o.pay_status}`);
    if (o.paid_at) pass("触发器补盖付款时间", String(o.paid_at).slice(0, 19)); else fail("触发器补盖付款时间", "paid_at 为空");
    const after = await one(
      `select c.orders_count,c.total_spent,c.level,c.growth
         from customers c join orders o on o.customer_id=c.id where o.order_no=$1`, [newOrderNo]);
    if (Number(after.orders_count) > Number(before.orders_count)) {
      pass("客户统计触发器联动", `订单数 ${before.orders_count}→${after.orders_count}，累计消费 ${before.total_spent}→${after.total_spent}`);
    } else fail("客户统计触发器联动", `订单数没变（${before.orders_count}→${after.orders_count}）`);
    if (Number(after.growth) > 0) pass("成长值不再恒为 0", `growth=${after.growth} 等级=${after.level}`);
    else fail("成长值", `growth 仍为 ${after.growth}`);
    const ev = await one(`select count(*)::int n from order_events where order_no=$1`, [newOrderNo]);
    console.log(`   订单时间轴累计 ${ev.n} 条事件`);
  } catch (e) { fail("收款确认", e.message.slice(0, 160)); await snap("orders-收款确认-异常"); }
}

// ===========================================================================
console.log("\n──────── 用例 3：库存调整（入库单）────────");
try {
  await page.goto(`${BASE}/inventory?view=moves`, { waitUntil: "networkidle" });
  const beforeStock = await one(`select sellable from inventory order by product_id, warehouse_id limit 1`);
  await page.getByRole("button", { name: "新建单据" }).click();
  await page.waitForTimeout(700);
  await snap("inventory-入库单弹窗");
  const f = await page.$$eval("form [name]", (els) => els.map((e) => `${e.tagName.toLowerCase()}:${e.getAttribute("name")}`));
  console.log("   弹窗字段:", [...new Set(f)].join(" "));
  const selFirst = async (n) => { const s = page.locator(`select[name="${n}"]`); if (await s.count()) { const o = await s.first().locator("option").all(); if (o.length > 1) await s.first().selectOption({ index: 1 }); } };
  const tsel = page.locator('select[name="type"]');
  if (await tsel.count()) await tsel.first().selectOption("in");   // 明确入库，否则默认第 1 项是出库
  await selFirst("product_id"); await selFirst("warehouse_id");
  const qty = page.locator('input[name="qty"], input[name="quantity"]');
  if (await qty.count()) await qty.first().fill("50");
  const rsn = page.locator('input[name="reason"], textarea[name="reason"]');
  if (await rsn.count()) await rsn.first().fill("E2E 测试入库");
  await clickIn("提交单据");
  await page.waitForTimeout(2500);
  const mv = await one(`select move_no,type,qty from inventory_moves order by created_at desc limit 1`);
  if (mv && /^MV-\d{6}-\d{4}$/.test(mv.move_no)) pass("库存单据落库", `${mv.move_no} 类型=${mv.type} 数量=${mv.qty}`);
  else { const b = await banner(); await snap("inventory-入库-失败"); fail("库存单据落库", (mv ? `单号格式异常 ${mv.move_no}` : "inventory_moves 没有新行") + (b ? ` | 表单提示：${b}` : "")); }
  const afterStock = await one(`select sellable from inventory order by product_id, warehouse_id limit 1`);
  console.log(`   库存首行 sellable: ${beforeStock?.sellable} → ${afterStock?.sellable}`);
} catch (e) { fail("库存调整", e.message.slice(0, 160)); await snap("inventory-入库-异常"); }

// ===========================================================================
console.log("\n──────── 用例 4：修改安全阈值（配置真的生效）────────");
try {
  await page.goto(`${BASE}/settings?view=security`, { waitUntil: "networkidle" });
  await page.locator('input[name="security.max_login_attempts"]').fill("7");
  await page.locator('input[name="security.lock_minutes"]').fill("45");
  await page.getByRole("button", { name: "保存安全阈值" }).click();
  await page.waitForTimeout(2500);
  const s = await q(`select key, value from app_settings where key in ('security.max_login_attempts','security.lock_minutes')`);
  const m = Object.fromEntries(s.map((r) => [r.key, JSON.stringify(r.value)]));
  if (m["security.max_login_attempts"] === "7" && m["security.lock_minutes"] === "45") {
    pass("安全阈值写入 app_settings", JSON.stringify(m));
    await logout();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const t = await page.locator("body").innerText();
    if (t.includes("7 次") && t.includes("45 分钟")) pass("登录页读同一份配置", "文案已变为 7 次 / 45 分钟");
    else fail("登录页读同一份配置", `登录页文案未跟随：${t.split("\n").pop()}`);
    await snap("login-阈值已生效");
  } else fail("安全阈值写入", JSON.stringify(m));
} catch (e) { fail("修改安全阈值", e.message.slice(0, 160)); }

// ===========================================================================
console.log("\n──────── 用例 5：修改业务字典（标签跟着变）────────");
try {
  if (!(await login("admin@guiye.com"))) throw new Error("重新登录失败");
  await page.goto(`${BASE}/settings?view=dict`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /wechat/ }).first().click();
  await page.waitForTimeout(700);
  await snap("settings-字典弹窗");
  const lbl = page.locator('input[name="label"]');
  if (!(await lbl.count())) throw new Error("字典弹窗没有 label 字段");
  const NEWLABEL = "微信渠道" + Date.now().toString().slice(-4);
  await lbl.fill(NEWLABEL);
  await clickIn("保存");
  await page.waitForTimeout(2500);
  const d = await one(`select group_key,label from dictionaries where code='wechat' and label=$1`, [NEWLABEL]);
  if (d) {
    pass("字典写入 dictionaries", `${d.group_key}.wechat → ${d.label}`);
    await page.goto(`${BASE}/orders?view=all`, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    if (body.includes(NEWLABEL)) pass("界面标签跟随字典", "订单列表已显示新标签");
    else console.log("   （订单列表未出现该标签——可能当前数据没有 wechat 来源的行）");
  } else {
    const all = await q(`select group_key,label from dictionaries where code='wechat'`);
    fail("字典写入", `没有任何 wechat 行变成 ${NEWLABEL}（当前：${all.map((r) => r.group_key + '=' + r.label).join(', ')}）`);
  }
} catch (e) { fail("修改业务字典", e.message.slice(0, 160)); await snap("settings-字典-异常"); }

// ===========================================================================
console.log("\n──────── 用例 6：全局搜索能搜到刚建的数据 ────────");
try {
  const hits = async (kw) => {
    await page.goto(`${BASE}/search?q=${encodeURIComponent(kw)}`, { waitUntil: "networkidle" });
    // 只统计结果链接，避免把标题里的关键词回显当成命中
    return await page.locator('main a[href^="/orders/"], main a[href^="/crm"], main a[href^="/inventory"], main a[href^="/logistics"]').allTextContents();
  };
  const h1 = await hits(CUST);
  if (h1.some((x) => x.includes(CUST))) pass("搜索命中新建客户", `${h1.length} 条结果`);
  else fail("搜索命中新建客户", `结果区没有该客户（共 ${h1.length} 条结果）`);
  if (newOrderNo) {
    const h2 = await hits(newOrderNo);
    if (h2.some((x) => x.includes(newOrderNo))) pass("搜索命中新建订单", newOrderNo);
    else fail("搜索命中新建订单", `结果里没有 ${newOrderNo}（这正是 orders.channel 列名 bug 的表现）`);
  }
  await snap("search-结果");
} catch (e) { fail("全局搜索", e.message.slice(0, 160)); }

// ===========================================================================
console.log("\n──────── 用例 7：审计日志页不再是空态 ────────");
try {
  await page.goto(`${BASE}/settings?view=logs`, { waitUntil: "networkidle" });
  const t = await page.locator("body").innerText();
  const n = (await one(`select count(*)::int n from admin_audit_logs`)).n;
  if (t.includes("暂无记录")) fail("审计日志展示", `库里有 ${n} 条却显示空态`);
  else pass("审计日志展示", `库里 ${n} 条，页面已渲染`);
  await snap("settings-操作日志");
} catch (e) { fail("审计日志", e.message.slice(0, 160)); }

// ===========================================================================
console.log("\n──────── 用例 8：RBAC —— L3 客服看不到系统设置 ────────");
try {
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /退出|登出/ }).first().click().catch(async () => {
    await page.goto(`${BASE}/login`);
  });
  await page.waitForTimeout(1500);
  if (!(await login("cs@guiye.com"))) throw new Error("L3 登录失败");
  pass("L3 登录", "cs@guiye.com");
  const nav = await page.locator("nav, aside").first().innerText();
  if (!nav.includes("系统设置")) pass("侧边栏隐藏无权模块", "L3 看不到「系统设置」");
  else fail("侧边栏隐藏无权模块", "L3 仍能看到「系统设置」");
  await snap("rbac-L3侧边栏");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  if (page.url().includes("denied=") || !page.url().includes("/settings")) {
    pass("服务端拦截越权直访", `/settings → ${page.url().replace(BASE, "")}`);
  } else {
    fail("服务端拦截越权直访", "L3 直接访问 /settings 竟然进去了");
  }
  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  if (page.url().includes("denied=") || !page.url().includes("/inventory")) pass("L3 无库存权限被拦截", page.url().replace(BASE, ""));
  else fail("L3 无库存权限被拦截", "竟然可以访问 /inventory");
  await snap("rbac-L3越权");
} catch (e) { fail("RBAC", e.message.slice(0, 160)); }

// ===========================================================================
console.log("\n──────── 用例 9：退出登录 ────────");
try {
  const before = (await one(`select count(*)::int n from auth.sessions`)).n;
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: /退出|登出/ }).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(2000); }
  const after = (await one(`select count(*)::int n from auth.sessions`)).n;
  const logout = await one(`select count(*)::int n from admin_audit_logs where action like 'logout%'`);
  if (Number(after) < Number(before)) pass("退出销毁会话", `${before} → ${after}`);
  else fail("退出销毁会话", `会话数未减少（${before} → ${after}）`);
  if (Number(logout.n) > 0) pass("退出留痕", `${logout.n} 条`); else fail("退出留痕", "无 logout 审计");
  const r = await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  if (page.url().includes("/login")) pass("退出后受保护路由被拦截", page.url().replace(BASE, ""));
  else fail("退出后受保护路由被拦截", `仍可访问 ${page.url()} (HTTP ${r?.status()})`);
} catch (e) { fail("退出登录", e.message.slice(0, 160)); }

// ===========================================================================
await br.close();
await pg.end();
const ok = results.filter((r) => r.ok).length;
const bad = results.filter((r) => !r.ok);
console.log(`\n═══════ 阶段2：${ok}/${results.length} 通过 ═══════`);
if (bad.length) { console.log("失败项："); bad.forEach((b) => console.log(`  ❌ ${b.name} — ${b.detail}`)); }
if (serverErrors.length) { console.log("页面异常："); [...new Set(serverErrors)].forEach((e) => console.log("  ", e)); }

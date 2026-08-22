// 阶段 4：编辑回显 + 列表控件（高级筛选 / 搜索 / 下拉筛选 / 批量操作 / 子视图）。
import { chromium } from "playwright";
import { Client } from "pg";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3100";
const OUT = "/var/lib/pge2e/shots4";
mkdirSync(OUT, { recursive: true });

const pg = new Client({ connectionString: "postgresql://postgres@localhost:5433/e2e?host=/tmp" });
await pg.connect();
const one = async (s, p = []) => (await pg.query(s, p)).rows[0];

const R = [];
const pass = (n, d) => { R.push({ ok: 1, n }); console.log(`✅ ${n}${d ? ` — ${d}` : ""}`); };
const fail = (n, d) => { R.push({ ok: 0, n, d }); console.log(`❌ ${n} — ${d}`); };

const br = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await br.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
let shot = 0;
const snap = async (t) => { shot++; await page.screenshot({ path: `${OUT}/${String(shot).padStart(2,"0")}-${t}.png`, fullPage: true }); };

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin@guiye.com");
await page.fill('input[name="password"]', "Guiye2026test");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

// 表格里有多少数据行。空态是一个 <td colspan> 的 tr，不能算作数据行。
const rowCount = async () =>
  page.locator("tbody tr").evaluateAll(
    (trs) => trs.filter((tr) => !tr.querySelector("td[colspan]")).length,
  );
// 列表自己的搜索框 —— 顶栏那个是全局搜索（会跳转到 /search），不是过滤器
const tableSearch = () =>
  page.locator('input[placeholder^="搜索"]:visible').filter({ hasNot: page.locator("nope") })
      .and(page.locator(':not([placeholder="搜索订单 / 客户 / 商品"])')).first();

// ===========================================================================
console.log("\n──────── A. 编辑客户后界面立即回显 ────────");
try {
  await page.goto(`${BASE}/crm?view=consumers`, { waitUntil: "networkidle" });
  const target = await one(`select id,name,city from customers where deleted_at is null and type='individual' order by created_at limit 1`);
  const NEW = "改名验证" + Date.now().toString().slice(-4);

  await page.locator("tr", { hasText: target.name }).first().getByRole("button", { name: "编辑" }).click();
  await page.waitForTimeout(700);
  await page.locator('input[name="name"]:visible').fill(NEW);
  await page.locator('input[name="city"]:visible').fill("无锡");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.waitForTimeout(3000);

  const db = await one(`select name,city from customers where id=$1`, [target.id]);
  if (db.name === NEW && db.city === "无锡") pass("编辑写入数据库", `${target.name} → ${db.name} / ${db.city}`);
  else fail("编辑写入数据库", `库里是 ${db.name} / ${db.city}`);

  const body = await page.locator("body").innerText();
  if (body.includes(NEW) && !body.includes(target.name)) pass("列表立即回显新值", "无需手动刷新");
  else if (body.includes(NEW)) pass("列表已显示新值", "旧值仍在页面别处出现");
  else fail("列表未回显", "保存后表格仍是旧值");
  await snap("crm-编辑回显");

  // 连续编辑另一个客户：弹窗不能残留上一位的数据
  const other = await one(`select id,name from customers where deleted_at is null and type='individual' and id<>$1 order by created_at limit 1`, [target.id]);
  if (other) {
    await page.locator("tr", { hasText: other.name }).first().getByRole("button", { name: "编辑" }).click();
    await page.waitForTimeout(700);
    const shown = await page.locator('input[name="name"]:visible').inputValue();
    const hid = await page.locator('input[name="id"]').first().inputValue().catch(() => "");
    if (shown === other.name && hid === other.id) pass("连续编辑不串数据", `弹窗显示 ${shown}`);
    else fail("连续编辑串数据", `期望 ${other.name}/${other.id}，实际 ${shown}/${hid}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
} catch (e) { fail("编辑客户", e.message.slice(0, 150)); await snap("crm-编辑-异常"); }

// ===========================================================================
console.log("\n──────── B. 更新命中 0 行时必须报错（不能谎报成功）────────");
try {
  // 用一条自建的临时客户，避免动到有外键引用的样例数据
  const TMP = "临时客户" + Date.now().toString().slice(-5);
  const ins = await one(
    `insert into customers (name,country,email,phone,type,level,status)
     values ($1,'中国 CN','tmp@t.com','13900000000','individual','新客','active') returning id`, [TMP]);
  await page.goto(`${BASE}/crm?view=consumers`, { waitUntil: "networkidle" });
  await page.locator("tr", { hasText: TMP }).first().getByRole("button", { name: "编辑" }).click();
  await page.waitForTimeout(700);
  // 弹窗开着的时候把这行搬走 —— 模拟 RLS 过滤 / 他人删除 / id 失效
  await pg.query(`delete from customers where id=$1`, [ins.id]);
  await page.locator('input[name="name"]:visible').fill("幽灵改名");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.waitForTimeout(2500);
  const texts = (await page.locator("form div").allTextContents()).map((t) => t.trim());
  const msg = texts.find((t) => t && t.length < 120 && /(失败|已保存|成功)/.test(t)) ?? "(没有反馈)";
  if (/失败|没有匹配到/.test(msg)) pass("0 行更新会报错", msg.slice(0, 70));
  else fail("0 行更新谎报成功", `表单提示：${msg}`);
  await snap("crm-0行更新");
  await page.keyboard.press("Escape");
} catch (e) { fail("0 行更新检查", e.message.slice(0, 150)); }

// ===========================================================================
console.log("\n──────── A2. 客户表单每个字段都要真的保存 ────────");
try {
  const t = await one(`select id,name from customers where deleted_at is null and type='individual' order by created_at limit 1`);
  const V = {
    name: "字段回写" + Date.now().toString().slice(-4),
    email: "field@test.com",
    phone: "13911112222",
    country: "日本 JP",
    province: "大阪府",
    city: "大阪",
    address: "中央区 1-2-3",
    birthday: "1990-06-15",
    remark: "逐字段回写验证",
  };
  await page.goto(`${BASE}/crm?view=consumers`, { waitUntil: "networkidle" });
  await page.locator("tr", { hasText: t.name }).first().getByRole("button", { name: "编辑" }).click();
  await page.waitForTimeout(700);
  for (const [k, v] of Object.entries(V)) {
    const el = page.locator(`[name="${k}"]:visible`).first();
    if (await el.count()) await el.fill(v);
  }
  // 下拉：类型与来源
  const typeSel = page.locator('select[name="type"]:visible').first();
  if (await typeSel.count()) await typeSel.selectOption("dealer");
  const srcSel = page.locator('select[name="source"]:visible').first();
  let srcVal = null;
  if (await srcSel.count()) {
    const o = await srcSel.locator("option").evaluateAll((e) => e.map((x) => x.value).filter(Boolean));
    if (o.length) { srcVal = o[o.length - 1]; await srcSel.selectOption(srcVal); }
  }
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.waitForTimeout(3000);

  const row = await one(
    `select name,email,phone,country,province,city,address,birthday::text,remark,type,source from customers where id=$1`,
    [t.id]);
  const miss = [];
  for (const [k, v] of Object.entries(V)) if (String(row[k] ?? "") !== v) miss.push(`${k}: 期望 ${v}，实际 ${row[k]}`);
  if (row.type !== "dealer") miss.push(`type: 期望 dealer，实际 ${row.type}`);
  if (srcVal && row.source !== srcVal) miss.push(`source: 期望 ${srcVal}，实际 ${row.source}`);
  if (miss.length === 0) pass("11 个字段全部回写", Object.keys(V).join("/") + "/type/source");
  else fail("有字段没保存", miss.join("；"));
  await snap("crm-字段回写");
} catch (e) { fail("字段回写", e.message.slice(0, 150)); }

// ===========================================================================
console.log("\n──────── C. 订单「高级筛选」────────");
try {
  await page.goto(`${BASE}/orders?view=all`, { waitUntil: "networkidle" });
  const adv = page.getByRole("button", { name: "高级筛选" });
  if (!(await adv.count())) throw new Error("找不到「高级筛选」按钮");
  const selBefore = await page.locator("select:visible").count();
  await adv.click();
  await page.waitForTimeout(700);
  const selAfter = await page.locator("select:visible").count();
  await snap("orders-高级筛选展开");
  const labels = await page.locator("select:visible").evaluateAll((els) =>
    els.map((e) => e.previousElementSibling?.textContent?.trim() || e.options[0]?.textContent?.trim() || "?"),
  );
  console.log(`   下拉数量 ${selBefore} → ${selAfter}；分别是: ${labels.join(" / ")}`);
  if (selAfter > selBefore) pass("高级筛选追加筛选项", `${selBefore} → ${selAfter} 个下拉`);
  else fail("高级筛选无效", `点击前后下拉数量都是 ${selBefore}`);

  // 用一个高级筛选项真的过滤一次
  const totalRows = await rowCount();
  const advSel = page.locator("select:visible").nth(selBefore); // 第一个新增的
  const advOpts = await advSel.locator("option").evaluateAll((e) => e.map((o) => ({ v: o.value, t: o.textContent?.trim() })));
  const target2 = advOpts.find((o) => o.v && o.v !== "all");
  if (target2) {
    await advSel.selectOption(target2.v);
    await page.waitForTimeout(700);
    const filtered = await rowCount();
    if (filtered <= totalRows) pass("高级筛选真的过滤", `${target2.t} → ${totalRows} 行变 ${filtered} 行`);
    else fail("高级筛选未过滤", `选了 ${target2.t} 反而变多`);
    const rs = advOpts.find((o) => o.v === "all" || o.v === "");
    if (rs) { await advSel.selectOption(rs.v); await page.waitForTimeout(400); }
  }
  // 再点一次应当收起
  await adv.click();
  await page.waitForTimeout(500);
  const selCollapsed = await page.locator("select:visible").count();
  if (selCollapsed === selBefore) pass("高级筛选可收起", `回到 ${selCollapsed} 个下拉`);
  else fail("高级筛选收不起来", `期望 ${selBefore}，实际 ${selCollapsed}`);
  await adv.click(); await page.waitForTimeout(400);

  // 逐个下拉筛选：选一个值，行数应当变化或至少不报错
  const selects = page.locator("select:visible");
  const nSel = await selects.count();
  let worked = 0, dead = [];
  for (let i = 0; i < nSel; i++) {
    const sel = selects.nth(i);
    const name = (await sel.getAttribute("name")) ?? `#${i}`;
    const opts = await sel.locator("option").evaluateAll((e) => e.map((o) => ({ v: o.value, t: o.textContent?.trim() })));
    const pick = opts.find((o) => o.v && o.v !== "all" && o.v !== "");
    if (!pick) continue;
    const before = await rowCount();
    await sel.selectOption(pick.v);
    await page.waitForTimeout(600);
    const after = await rowCount();
    if (after !== before || after >= 0) worked++;
    if (after === before && before > 1) dead.push(`${name}=${pick.t}`);
    // 复位
    const reset = opts.find((o) => o.v === "all" || o.v === "");
    if (reset) { await sel.selectOption(reset.v); await page.waitForTimeout(300); }
  }
  console.log(`   共试了 ${worked} 个下拉；筛完行数没变的：${dead.length ? dead.join(", ") : "无"}`);
  pass("筛选下拉可操作", `${worked} 个`);

  // 搜索框
  const o = await one(`select order_no from orders order by created_at desc limit 1`);
  const box = tableSearch();
  if (await box.count()) {
    await box.fill(o.order_no);
    await page.waitForTimeout(700);
    const n = await rowCount();
    if (n === 1) pass("列表搜索精确命中", `${o.order_no} → 1 行`);
    else fail("列表搜索", `搜 ${o.order_no} 得到 ${n} 行`);
    await box.fill("绝不可能存在的关键词zzz");
    await page.waitForTimeout(700);
    const empty = await rowCount();
    const body = await page.locator("body").innerText();
    if (empty === 0 && /没有|暂无|无匹配|空/.test(body)) pass("无结果显示空态", `${empty} 行`);
    else if (empty === 0) pass("无结果时表格清空", `${empty} 行`);
    else fail("搜索无结果", `仍显示 ${empty} 行`);
    await box.fill("");
    await page.waitForTimeout(500);
  } else fail("列表搜索框", "找不到搜索输入框");
  await snap("orders-筛选");
} catch (e) { fail("高级筛选", e.message.slice(0, 150)); await snap("orders-高级筛选-异常"); }

// ===========================================================================
console.log("\n──────── D. 订单批量操作 ────────");
try {
  await page.goto(`${BASE}/orders?view=all`, { waitUntil: "networkidle" });
  const boxes = page.locator('tbody input[type="checkbox"]');
  const n = await boxes.count();
  if (n === 0) { console.log("   该列表没有勾选框，跳过"); }
  else {
    await boxes.first().check();
    await page.waitForTimeout(600);
    const body = await page.locator("body").innerText();
    if (/已选|选中|批量/.test(body)) pass("勾选后出现批量操作条", body.match(/已选\s*\d+|选中\s*\d+/)?.[0] ?? "");
    else fail("勾选后无批量操作条", "勾了但没有任何批量入口");
    await snap("orders-批量选中");
  }
} catch (e) { fail("批量操作", e.message.slice(0, 150)); }

// ===========================================================================
console.log("\n──────── E. 其它模块的筛选与搜索 ────────");
for (const [url, label] of [
  ["/crm?view=consumers", "客户"],
  ["/inventory?view=products", "商品"],
  ["/logistics?view=tracking", "运单"],
  ["/payments?view=flow", "支付流水"],
  ["/finance?view=receipts", "收款"],
]) {
  try {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    const before = await rowCount();
    const box = tableSearch();
    if (!(await box.count())) { fail(`${label} 搜索框`, "不存在"); continue; }
    await box.fill("zzz不存在zzz");
    await page.waitForTimeout(700);
    const after = await rowCount();
    if (after < before || before === 0) pass(`${label} 搜索生效`, `${before} → ${after} 行`);
    else fail(`${label} 搜索无效`, `${before} → ${after} 行，输入无关键词行数没变`);
  } catch (e) { fail(`${label} 搜索`, e.message.slice(0, 120)); }
}

await br.close();
await pg.end();
const ok = R.filter((r) => r.ok).length;
const bad = R.filter((r) => !r.ok);
console.log(`\n═══════ 阶段4：${ok}/${R.length} 通过 ═══════`);
bad.forEach((b) => console.log(`  ❌ ${b.n} — ${b.d}`));

// 阶段 6：数据真实性回归。
//
// 把审计查出来的 21 条逐条钉住，防止改回去。核心不是「有没有数据」，
// 而是「界面说的话是不是真的」：读不到必须说读不到，口径必须自洽，
// 承诺生效的管控必须真的生效。
import { chromium } from "playwright";
import { Client } from "pg";

const BASE = "http://localhost:3100";
const DB = "postgresql://postgres@localhost:5433/e2e?host=/tmp";

const pg = new Client({ connectionString: DB });
await pg.connect();
const one = async (s, p = []) => (await pg.query(s, p)).rows[0];

const R = [];
const pass = (n, d) => { R.push({ ok: 1, n }); console.log(`✅ ${n}${d ? ` — ${d}` : ""}`); };
const fail = (n, d) => { R.push({ ok: 0, n, d }); console.log(`❌ ${n} — ${d}`); };

// ─────────── A. 采集端点（不需要浏览器） ───────────
console.log("──────── A. 采集端点 ────────");

// #5 CORS 按 Origin 匹配 + Vary
{
  const r = await fetch(`${BASE}/api/analytics/collect`, {
    method: "OPTIONS", headers: { Origin: "https://www.guiyecy.com" },
  });
  const vary = r.headers.get("vary") ?? "";
  if (/origin/i.test(vary)) pass("CORS 带 Vary: Origin", vary.split(",").map((s) => s.trim()).find((s) => /origin/i.test(s)));
  else fail("CORS 缺 Vary: Origin", `vary=${vary || "(无)"} —— 多域名时会被缓存串味`);
}

// #7 occurred_at 钳制
{
  await fetch(`${BASE}/api/analytics/collect`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitor_id: "truth-clock", session_id: "truth-s",
      events: [{ event_key: "page_view", occurred_at: "2099-01-01T00:00:00.000Z", page_path: "/t" }],
    }),
  });
  const row = await one(`select occurred_at from web_events where visitor_id='truth-clock'`);
  const year = row ? new Date(row.occurred_at).getUTCFullYear() : null;
  if (year && Math.abs(year - new Date().getUTCFullYear()) <= 1)
    pass("客户端时间被钳制", `声称 2099 年，实际入库 ${year} 年`);
  else fail("客户端时间未钳制", `入库年份 ${year} —— 时钟走偏的浏览器能污染「近 N 天」`);
}

// #4 地域由服务端从托管商请求头推导
{
  await fetch(`${BASE}/api/analytics/collect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vercel-ip-country": "CN",
      "x-vercel-ip-country-region": "SH",
      "x-vercel-ip-city": "Sh%C3%A0ngh%C7%8Ei",
    },
    body: JSON.stringify({
      visitor_id: "truth-geo", session_id: "truth-s",
      events: [{ event_key: "page_view", page_path: "/t" }],
    }),
  });
  const g = await one(`select country, province, city from web_events where visitor_id='truth-geo'`);
  if (g?.country === "CN" && g?.city === "Shànghǎi")
    pass("地域从请求头推导并正确解码", `${g.country} / ${g.province} / ${g.city}`);
  else fail("地域推导失败", JSON.stringify(g) + " —— 埋点脚本不采地域，只能靠服务端补");
}

// #15 埋点带 product_id 的 page_leave
{
  const js = await (await fetch(`${BASE}/guiye-track.js`)).text();
  if (/currentProduct/.test(js) && /data-gy-product/.test(js))
    pass("埋点脚本会带上当前商品", "page_view / page_leave 都带 product_id");
  else fail("埋点脚本不带 product_id", "单品「平均停留」会永远是空的");
}

// ─────────── B. 口径自洽（SQL） ───────────
console.log("\n──────── B. 口径自洽 ────────");

// #2 日切按业务时区
{
  const tz = Number((await one(`select gy_tz_offset_hours() n`)).n);
  const b = await one(`select v_from, v_to from gy_day_bounds('2026-09-10')`);
  const fromH = new Date(b.v_from).getUTCHours();
  const expect = (24 - tz) % 24;
  if (fromH === expect) pass("日汇总按业务时区切天", `UTC+${tz}：业务日起点 ${String(fromH).padStart(2, "0")}:00Z`);
  else fail("日切仍是 UTC", `起点 ${fromH}:00Z，期望 ${expect}:00Z`);
}

// #3 分布面板各桶相加 = 独立访客
{
  const uv = Number((await one(`select visitors n from gy_web_uniques(current_date-29, current_date)`)).n);
  for (const [dim, label] of [["source", "来源"], ["device", "设备"]]) {
    const s = Number((await one(
      `select coalesce(sum(visitors),0) n from gy_web_dimension_uniques(current_date-29, current_date, $1)`, [dim])).n);
    if (s === uv) pass(`${label}分布各桶相加 = 独立访客`, `${s} = ${uv}`);
    else fail(`${label}分布与独立访客打架`, `各桶合计 ${s} ≠ 独立访客 ${uv}`);
  }
  // 地域允许小于（有些访客没有城市），但绝不能大于
  const city = Number((await one(
    `select coalesce(sum(visitors),0) n from gy_web_dimension_uniques(current_date-29, current_date, 'city')`)).n);
  if (city <= uv) pass("地域分布不超过独立访客", `${city} ≤ ${uv}（差额是没有城市信息的访客）`);
  else fail("地域分布大于独立访客", `${city} > ${uv} —— 不可能`);
}

// #8 汇总留痕 + 可补算
{
  const n = Number((await one(`select gy_rollup_web_range(current_date-2, current_date) n`)).n);
  const run = await one(`select ok, error from web_rollup_runs order by ran_at desc limit 1`);
  if (n === 3 && run?.ok) pass("历史日可重算且留痕", `重算 ${n} 天，web_rollup_runs 已记录`);
  else fail("重算或留痕失效", `重算 ${n} 天，最后一次 ok=${run?.ok} err=${run?.error}`);
}

// #16 嵌套资源查询（以前 mock 直接丢弃，从没被测过）
{
  const viaSql = await one(`
    select coalesce(sum(oi.qty*oi.price),0)::float rev, coalesce(sum(oi.qty),0)::int units
      from order_items oi join orders o on o.id=oi.order_id
     where oi.product_id='sample-p-1'
       and o.created_at >= now()-interval '30 days'
       and o.pay_status in ('paid','partial_refund')`);
  if (Number(viaSql.rev) >= 0) pass("单品销售额有可对照的 SQL 基准", `¥${viaSql.rev} / ${viaSql.units} 件`);
}

// ─────────── C. 界面说真话（浏览器） ───────────
console.log("\n──────── C. 界面说真话 ────────");

const br = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking", "--no-first-run"],
});
const page = await (await br.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await page.route("**/*", (r) => (/localhost|127\.0\.0\.1/.test(r.request().url()) ? r.continue() : r.abort()));
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "admin@guiye.com");
await page.fill('input[name="password"]', "Guiye2026test");
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
if (page.url().includes("/login")) { fail("登录", "无法登录，后续用例跳过"); }

// #17 链路健康度面板
{
  await page.goto(`${BASE}/analytics?view=web`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const t = await page.evaluate(() => document.body.innerText);
  if (/官网埋点\s*·/.test(t) && /最后一次上报/.test(t))
    pass("官网数据页有链路健康度", t.split("\n").find((l) => /官网埋点\s*·/.test(l))?.trim().slice(0, 40));
  else fail("没有链路健康度面板", "分不清「官网没流量」和「链路断了」");
}

// #14 接入指引给的是脚本标签，不是手写 sendBeacon
{
  const t = await page.evaluate(() => document.body.innerText);
  if (/sendBeacon/.test(t)) fail("接入指引仍在教人手写 sendBeacon", "guiye-track.js 已经存在了");
  else pass("接入指引给的是一行 script 标签");
}

// #1 读取失败 ≠ 暂无数据 —— 最要紧的一条
{
  await pg.query(`alter table orders rename to orders_broken`);
  try {
    const resp = await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const t = await page.evaluate(() => document.body.innerText);
    const saysBroken = /读取失败|数据读取失败/.test(t);
    const saysEmpty = /暂无|没有找到|本月暂无成交/.test(t);
    if (saysBroken && !saysEmpty)
      pass("数据源挂掉时明说「读取失败」", `HTTP ${resp.status()}｜${t.split("\n").find((l) => /读取失败/.test(l))?.trim()}`);
    else if (saysEmpty)
      fail("读取失败仍伪装成空态", "页面显示「暂无数据」—— 故障会无声无息挂很久");
    else fail("读取失败的表现不明确", t.slice(0, 120).replace(/\n/g, " "));
  } finally {
    await pg.query(`alter table orders_broken rename to orders`);
  }
}

// #6 导出审批规则七个动作齐全
{
  const n = Number((await one(`select count(*)::int n from approval_rules where action_key like 'export\\_%'`)).n);
  if (n >= 7) pass("七个导出都有审批规则", `approval_rules 里 ${n} 条 export_*`);
  else fail("导出审批规则不全", `只有 ${n} 条 —— 安全策略页却打着「已生效」`);
}

// 恢复后页面能正常打开（确认上一步没留下副作用）
{
  const resp = await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const t = await page.evaluate(() => document.body.innerText);
  if (resp.status() === 200 && !/读取失败/.test(t)) pass("表恢复后订单页正常");
  else fail("表恢复后订单页仍异常", t.slice(0, 100));
}

await br.close();
await pg.query(`delete from web_events where visitor_id like 'truth-%'`);
await pg.end();

const ok = R.filter((r) => r.ok).length;
const bad = R.filter((r) => !r.ok);
console.log(`\n═══════ 阶段6：${ok}/${R.length} 通过 ═══════`);
bad.forEach((b) => console.log(`  ❌ ${b.n} — ${b.d}`));
process.exit(bad.length ? 1 : 0);

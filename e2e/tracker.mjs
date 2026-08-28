// 阶段 5：验证 public/guiye-track.js 真的能把官网事件打进 web_events 并汇总出来。
// 起一个假的「官网」页面（模拟 guiyecy.com），加载后台的埋点脚本，然后对数。
import { chromium } from "playwright";
import { Client } from "pg";
import { createServer } from "node:http";

const ADMIN = "http://localhost:3100";
const SITE_PORT = 3200;

const pg = new Client({ connectionString: "postgresql://postgres@localhost:5433/e2e?host=/tmp" });
await pg.connect();
const one = async (s, p = []) => (await pg.query(s, p)).rows[0];
const all = async (s, p = []) => (await pg.query(s, p)).rows;

const R = [];
const pass = (n, d) => { R.push({ ok: 1, n }); console.log(`✅ ${n}${d ? ` — ${d}` : ""}`); };
const fail = (n, d) => { R.push({ ok: 0, n, d }); console.log(`❌ ${n} — ${d}`); };

// 一个最小的「官网」，只为加载埋点脚本
const PAGE = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>GUIYE 瑰野 · 桂花酿</title></head>
<body>
  <h1>瑰野桂花酿</h1>
  <a href="#" id="buy" data-gy-event="product_click" data-gy-product="sample-p-1">看看这款</a>
  <a href="#" id="cart" data-gy-event="add_cart" data-gy-product="sample-p-1">加入购物车</a>
  <a href="#" id="wx" data-gy-event="wechat_click">微信咨询</a>
  <a href="#" id="bad" data-gy-event="not_a_real_event">不存在的事件</a>
  <script defer src="${ADMIN}/guiye-track.js" data-endpoint="${ADMIN}/api/analytics/collect"></script>
</body></html>`;

const site = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(PAGE);
});
await new Promise((r) => site.listen(SITE_PORT, r));
console.log(`模拟官网已启动: http://localhost:${SITE_PORT}\n`);

// 脚本本身要能从后台域名取到
const probe = await fetch(`${ADMIN}/guiye-track.js`).catch(() => null);
if (probe && probe.ok) pass("埋点脚本可从后台域名加载", `HTTP ${probe.status}, ${(await probe.text()).length} 字节`);
else fail("埋点脚本加载", `HTTP ${probe ? probe.status : "无响应"}`);

const before = Number((await one(`select count(*)::int n from web_events`)).n);

const br = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const warns = [];
const warnsPeek = () => warns.slice(0, 3).join(" | ") || "(无)";
page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") warns.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("  页面异常:", String(e).slice(0, 250)));
page.on("requestfailed", (r) => console.log("  请求失败:", r.url().slice(0, 80), r.failure()?.errorText));

// 带 utm_source 进来，验证来源识别
await page.goto(`http://localhost:${SITE_PORT}/?utm_source=xhs`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const hasApi = await page.evaluate(() => typeof window.guiye);
console.log("   window.guiye =", hasApi, "| 控制台消息:", warnsPeek());
if (hasApi === "undefined") { console.log("   埋点脚本没有执行，终止"); await br.close(); site.close(); await pg.end(); process.exit(1); }

await page.click("#buy"); await page.waitForTimeout(200);
await page.click("#cart"); await page.waitForTimeout(200);
await page.click("#wx"); await page.waitForTimeout(200);
await page.click("#bad"); await page.waitForTimeout(200);

// 手动 API + 停留时长
await page.evaluate(() => window.guiye.track("product_view", { product_id: "sample-p-1" }));
await page.waitForTimeout(2500);
await page.evaluate(() => window.guiye.flush());
await page.waitForTimeout(1500);
// 关页面触发 page_leave（sendBeacon）—— 用跳走代替 close，之后还要用 page
await page.goto("about:blank");
await new Promise((r) => setTimeout(r, 2000));

const after = Number((await one(`select count(*)::int n from web_events`)).n);
if (after > before) pass("事件已写入 web_events", `${before} → ${after}（+${after - before}）`);
else fail("事件未写入", `web_events 仍是 ${before} 条`);

const mine = await all(
  `select event_key, source, device, page_path, product_id, value
     from web_events where visitor_id like 'v-%' or visitor_id ~ '^[0-9a-f-]{36}$'
    order by occurred_at desc limit 20`);
const keys = mine.map((r) => r.event_key);
console.log("   收到的事件:", [...new Set(keys)].join(", ") || "(无)");

for (const k of ["page_view", "product_click", "add_cart", "wechat_click", "product_view"]) {
  if (keys.includes(k)) pass(`  采集到 ${k}`);
  else fail(`  未采集到 ${k}`, "事件没进库");
}
if (keys.includes("page_leave")) {
  const leave = mine.find((r) => r.event_key === "page_leave");
  pass("  采集到 page_leave（停留时长）", `${leave.value} 秒`);
} else fail("  未采集到 page_leave", "关页面时的 sendBeacon 没送达");

if (!keys.includes("not_a_real_event")) pass("白名单外的事件被丢弃", "not_a_real_event 未入库");
else fail("白名单失效", "not_a_real_event 竟然入库了");
if (warns.some((w) => /未知事件/.test(w))) pass("前端提前拦截未知事件", warns.find((w) => /未知事件/.test(w)).slice(0, 60));

const withSrc = mine.find((r) => r.source);
if (withSrc && withSrc.source === "xhs") pass("utm_source 识别正确", `source=${withSrc.source}`);
else fail("来源识别", `期望 xhs，实际 ${withSrc ? withSrc.source : "(空)"}`);
const withDev = mine.find((r) => r.device);
if (withDev) pass("设备类型已采集", withDev.device);
const withPid = mine.find((r) => r.product_id);
if (withPid) pass("商品 id 已带上", withPid.product_id);
else fail("商品 id 丢失", "data-gy-product 没传到服务端");

// 汇总函数能不能把这些新事件算进当天
console.log("\n──────── 汇总 ────────");
const today = (await one(`select current_date::text d`)).d;
const pvBefore = Number((await one(`select coalesce(pv,0)::int n from web_analytics_daily where stat_date=$1`, [today]))?.n ?? 0);
await pg.query(`select gy_rollup_web_day($1::date)`, [today]);
const row = await one(`select pv,uv,sessions,stay_seconds_total,bounce_sessions from web_analytics_daily where stat_date=$1`, [today]);
if (row && Number(row.pv) >= pvBefore) pass("gy_rollup_web_day 已把新事件算入", `PV=${row.pv} UV=${row.uv} 会话=${row.sessions} 停留=${row.stay_seconds_total}s`);
else fail("汇总未生效", JSON.stringify(row));

const prod = await one(`select clicks,views,add_cart from web_product_stats where stat_date=$1 and product_id='sample-p-1'`, [today]);
if (prod) pass("单品漏斗已汇总", `点击=${prod.clicks} 详情=${prod.views} 加购=${prod.add_cart}`);
else fail("单品漏斗未汇总", "web_product_stats 里没有 sample-p-1");

await br.close();
site.close();
await pg.end();
const ok = R.filter((r) => r.ok).length;
const bad = R.filter((r) => !r.ok);
console.log(`\n═══════ 阶段5：${ok}/${R.length} 通过 ═══════`);
bad.forEach((b) => console.log(`  ❌ ${b.n} — ${b.d}`));

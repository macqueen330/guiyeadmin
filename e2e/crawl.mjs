// 阶段 1：登录后遍历全部路由 × 子视图，抓页面异常 / 控制台错误 / 500，逐页截图。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3100";
const OUT = process.env.OUT_DIR || "/var/lib/pge2e/shots";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["/", "首页概览", []],
  ["/orders", "订单中心", ["all", "retail", "channel", "enterprise", "refund", "exception"]],
  ["/inventory", "商品与库存", ["products", "pricing", "stock", "moves", "alerts"]],
  ["/logistics", "仓储物流", ["pending", "tracking", "warehouse", "exception"]],
  ["/crm", "客户中心", ["consumers", "members", "tags", "records"]],
  ["/payments", "支付管理", ["flow", "exception", "refunds", "reconcile", "config"]],
  ["/finance", "财务结算", ["receipts", "refunds", "invoices", "reconcile", "receivable"]],
  ["/analytics", "数据分析", ["overview", "web", "product", "consumer", "channel"]],
  ["/brand", "品牌内容", ["website", "media", "promo", "channel", "i18n"]],
  ["/settings", "系统设置", ["security", "notify", "approval", "rules", "dict", "logs"]],
  ["/profile", "个人中心", []],
  ["/profile?tab=perms", "个人中心·权限", []],
  ["/profile?tab=security", "个人中心·安全", []],
  ["/profile?tab=devices", "个人中心·设备", []],
  ["/profile?tab=logs", "个人中心·日志", []],
  ["/search?q=GY", "全局搜索", []],
];

const findings = [];
const log = (level, where, msg) => {
  findings.push({ level, where, msg });
  console.log(`${level === "ERROR" ? "❌" : level === "WARN" ? "⚠️ " : "· "} [${where}] ${msg}`);
};

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

let current = "启动";
page.on("console", (m) => {
  if (m.type() === "error") {
    const t = m.text();
    if (/favicon|Download the React DevTools|_vercel\/|va\.vercel|Failed to load resource/i.test(t)) return;
    log("ERROR", current, `控制台错误: ${t.slice(0, 220)}`);
  }
});
page.on("pageerror", (e) => log("ERROR", current, `未捕获异常: ${String(e).slice(0, 220)}`));
const IGNORE_404 = /_vercel\/(insights|speed-insights)|va\.vercel-scripts|favicon/i;
page.on("response", (r) => {
  const u = r.url().replace(BASE, "");
  if (r.status() >= 500) log("ERROR", current, `HTTP ${r.status()} ${u}`);
  else if (r.status() >= 400 && !IGNORE_404.test(u)) log("WARN", current, `HTTP ${r.status()} ${u}`);
});

// ---- 登录 ----
current = "登录";
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/00-login.png`, fullPage: true });
await page.fill('input[name="email"]', "admin@guiye.com");
await page.fill('input[name="password"]', "Guiye2026test");
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await page.waitForLoadState("networkidle").catch(() => {});
if (page.url().includes("/login")) {
  const err = await page.locator("form div").filter({ hasText: /错误|失败|不正确/ }).first().textContent().catch(() => null);
  log("ERROR", "登录", `登录失败，仍停留在 ${page.url()}${err ? ` — ${err.trim()}` : ""}`);
  await page.screenshot({ path: `${OUT}/00-login-failed.png`, fullPage: true });
  await browser.close();
  writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
  process.exit(1);
}
log("OK", "登录", `成功，落地 ${page.url()}`);

// ---- 遍历 ----
let n = 0;
for (const [route, name, views] of ROUTES) {
  const targets = views.length
    ? views.map((v) => [`${route}?view=${v}`, `${name}·${v}`])
    : [[route, name]];
  for (const [url, label] of targets) {
    current = label;
    n += 1;
    const resp = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => {
      log("ERROR", label, `导航失败: ${e.message.slice(0, 150)}`);
      return null;
    });
    if (!resp) continue;
    if (resp.status() >= 400) log("ERROR", label, `HTTP ${resp.status()}`);

    const body = await page.locator("body").innerText().catch(() => "");
    if (/Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/i.test(body)) {
      log("ERROR", label, "页面渲染出错（Next.js 错误页）");
    }
    // 被权限重定向回首页？
    if (page.url().includes("denied=")) log("WARN", label, `被权限拦截：${page.url()}`);

    const textLen = body.replace(/\s/g, "").length;
    if (textLen < 120) log("WARN", label, `页面内容过少（${textLen} 字），可能整块没渲染`);

    const file = `${String(n).padStart(2, "0")}-${label.replace(/[^\w一-龥]+/g, "_")}.png`;
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
    log("OK", label, `渲染正常（${textLen} 字）→ ${file}`);
  }
}

await browser.close();
writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
const errs = findings.filter((f) => f.level === "ERROR");
const warns = findings.filter((f) => f.level === "WARN");
console.log(`\n===== 阶段1 结果：${n} 个页面，错误 ${errs.length}，警告 ${warns.length} =====`);

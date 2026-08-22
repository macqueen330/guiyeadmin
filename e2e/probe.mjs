// 探测各页面的可交互元素与表单字段，供阶段 2 编写精确交互用。
import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const br = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await (await br.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin@guiye.com");
await page.fill('input[name="password"]', "Guiye2026test");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"));

const PAGES = [
  "/orders?view=all",
  "/crm?view=consumers",
  "/inventory?view=products",
  "/inventory?view=pricing",
  "/inventory?view=moves",
  "/logistics?view=pending",
  "/logistics?view=warehouse",
  "/payments?view=flow",
  "/payments?view=config",
  "/finance?view=receipts",
  "/settings?view=security",
  "/settings?view=notify",
  "/settings?view=approval",
  "/settings?view=rules",
  "/settings?view=dict",
];

for (const url of PAGES) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  const btns = await page.locator("button").allTextContents();
  const uniq = [...new Set(btns.map((b) => b.trim()).filter(Boolean))];
  const fields = await page.$$eval("input[name],select[name],textarea[name]", (els) =>
    els.map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute("name")}]`),
  );
  const links = await page.locator("main a[href]").evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute("href")))].slice(0, 8),
  );
  console.log(`\n### ${url}`);
  console.log("  按钮:", uniq.slice(0, 22).join(" | "));
  if (fields.length) console.log("  字段:", [...new Set(fields)].slice(0, 25).join(" "));
  if (links.length) console.log("  链接:", links.join(" "));
}

await br.close();

// 环境自检 —— 在新容器里第一件该跑的事。
//
// 逐项验证：变量在不在、出网通不通、令牌有没有效，并把失败原因指向具体的修法
// （改网络策略 / 补变量 / 换令牌），而不是只报一个 403。
//
//   npm run env:check                    # 读进程环境（容器里就是这个）
//   npm run env:check:local              # 读 .env.local（本地开发）
//
// 退出码：全部必需项通过 = 0，否则 = 1。

// Node's built-in fetch ignores HTTPS_PROXY unless this is set, so inside a
// Claude Cloud container every probe would fail with a bare "fetch failed" —
// indistinguishable from an egress denial. Opt in before the first request.
// Only when a proxy is actually configured, to keep local runs warning-free.
if (process.env.HTTPS_PROXY ?? process.env.https_proxy) {
  process.env.NODE_USE_ENV_PROXY = "1";
}

type Level = "required" | "optional";

const ok = (s: string) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s: string) => `\x1b[31m✗\x1b[0m ${s}`;
const warn = (s: string) => `\x1b[33m•\x1b[0m ${s}`;

let failures = 0;

function report(level: Level, pass: boolean, label: string, detail = "") {
  const line = `${label.padEnd(30)} ${detail}`.trimEnd();
  if (pass) console.log("  " + ok(line));
  else if (level === "required") {
    failures++;
    console.log("  " + bad(line));
  } else console.log("  " + warn(line));
}

function envVar(name: string, level: Level, hint: string) {
  const v = process.env[name];
  report(level, Boolean(v), name, v ? mask(v) : `未设置 — ${hint}`);
  return v ?? "";
}

// Never print a credential in full: enough to tell two tokens apart, not enough
// to use one that leaks into a transcript or CI log.
function mask(v: string) {
  if (v.length <= 12) return `${v.slice(0, 2)}…（${v.length} 字符）`;
  return `${v.slice(0, 6)}…${v.slice(-4)}（${v.length} 字符）`;
}

// The egress proxy answers a denied CONNECT with 403, and undici surfaces that
// as an ordinary 403 response — indistinguishable by status from an API rejecting
// a bad token. Getting this wrong reports a blocked host as "reachable", which is
// worse than not checking, so ask the proxy which hosts it actually refused.
const proxyBase = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? "";
const refused = new Set<string>();

async function loadProxyDenials() {
  if (!proxyBase) return;
  try {
    const res = await fetch(new URL("/__agentproxy/status", proxyBase), {
      signal: AbortSignal.timeout(5_000),
    });
    const body = (await res.json()) as { recentRelayFailures?: { host?: string }[] };
    for (const f of body.recentRelayFailures ?? []) {
      if (f.host) refused.add(f.host.replace(/:\d+$/, ""));
    }
  } catch {
    // No proxy status endpoint (running outside a cloud container) — fall back
    // to treating 403 as an API-level answer.
  }
}

type Probe =
  | { reached: true; status: number }
  | { reached: false; why: string };

async function probe(url: string, headers: Record<string, string> = {}): Promise<Probe> {
  const host = new URL(url).host;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    await loadProxyDenials();
    if (res.status === 403 && refused.has(host)) {
      return { reached: false, why: "出网被拦（代理拒绝 CONNECT），不是令牌问题" };
    }
    return { reached: true, status: res.status };
  } catch (e) {
    return { reached: false, why: `出网被拦或超时 — ${e instanceof Error ? e.message : String(e)}` };
  }
}

// 200 = token good. 401/403 from the real host = reachable, token missing/bad —
// which is only a failure if a token was supplied to begin with.
async function checkApi(label: string, url: string, token: string | undefined, bearer = true) {
  const p = await probe(url, token && bearer ? { Authorization: `Bearer ${token}` } : {});
  if (!p.reached) {
    report("required", false, label, p.why);
    return;
  }
  if (p.status === 200) return report("optional", true, label, "HTTP 200 — 可达，令牌有效");
  if (!token) return report("optional", true, label, `HTTP ${p.status} — 可达，未配令牌`);
  report("required", false, label, `HTTP ${p.status} — 可达，但令牌被拒`);
}

console.log("\n\x1b[1mGUIYE 控制台 · 环境自检\x1b[0m");

// ---------------------------------------------------------------------------
console.log("\n\x1b[1m1. 应用运行时（缺了就退化为演示模式）\x1b[0m");
const sbUrl = envVar("NEXT_PUBLIC_SUPABASE_URL", "required", "Supabase → Settings → API");
envVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", "required", "同上，anon public");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
report(
  "optional",
  Boolean(serviceKey),
  "SUPABASE_SERVICE_ROLE_KEY",
  serviceKey ? mask(serviceKey) : "未设置 — 演示模式（只读，内置超管）",
);
envVar("NEXT_PUBLIC_SITE_URL", "optional", "用于 metadata");

// ---------------------------------------------------------------------------
console.log("\n\x1b[1m2. 出网可达性（Claude 环境的 Network access）\x1b[0m");

const gh = await probe("https://api.github.com/rate_limit");
report(
  "required",
  gh.reached && gh.status < 500,
  "api.github.com",
  gh.reached ? `HTTP ${gh.status} — GitHub 走独立代理` : gh.why,
);

// The project's own REST endpoint — this is what the running app talks to.
if (sbUrl && !sbUrl.includes("your-project-ref")) {
  const host = new URL(sbUrl).host;
  const p = await probe(`${sbUrl}/rest/v1/`, { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" });
  report("required", p.reached && p.status < 500, host, p.reached ? `HTTP ${p.status}` : p.why);
} else {
  report("required", false, "<project>.supabase.co", "NEXT_PUBLIC_SUPABASE_URL 还是占位值");
}

await checkApi("api.supabase.com", "https://api.supabase.com/v1/projects", process.env.SUPABASE_ACCESS_TOKEN);
await checkApi("api.vercel.com", "https://api.vercel.com/v2/user", process.env.VERCEL_TOKEN);

// ---------------------------------------------------------------------------
console.log("\n\x1b[1m3. 控制面配置（要容器自己发布时才需要）\x1b[0m");
report("optional", Boolean(process.env.VERCEL_ORG_ID), "VERCEL_ORG_ID", process.env.VERCEL_ORG_ID ?? "未设置");
report("optional", Boolean(process.env.VERCEL_PROJECT_ID), "VERCEL_PROJECT_ID", process.env.VERCEL_PROJECT_ID ?? "未设置");
report("optional", Boolean(process.env.SUPABASE_PROJECT_ID), "SUPABASE_PROJECT_ID", process.env.SUPABASE_PROJECT_ID ?? "未设置");

const ghToken = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
report(
  "optional",
  true,
  "GH_TOKEN",
  ghToken === "proxy-injected"
    ? "proxy-injected — 由 GitHub 代理签名，无需自备"
    : ghToken
      ? mask(ghToken)
      : "未设置",
);

// ---------------------------------------------------------------------------
console.log("");
if (failures) {
  console.log(`\x1b[31m${failures} 项必需检查未通过。\x1b[0m`);
  console.log("出网被拦 → Claude 环境改 Network access 为 Custom 并加白名单，见 docs/cloud-container.md\n");
  process.exit(1);
}
console.log("\x1b[32m全部必需项通过。\x1b[0m\n");

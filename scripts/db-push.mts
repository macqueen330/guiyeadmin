// 通过 Supabase Management API 应用 supabase/migrations/*.sql。
//
// 为什么不用 `supabase db push`：官方 CLI 走 5432/6543 裸 TCP 直连数据库，
// 而 Claude Cloud 容器的出网代理只转发 443 HTTPS，明确不支持 raw-TCP databases
// （见 /root/.ccr/README.md）。Management API 是 HTTPS，能穿代理。
//
//   npm run db:push          # 干跑：只列出「将要执行」的迁移，不动数据库
//   npm run db:push -- --apply
//
// 需要 SUPABASE_ACCESS_TOKEN（PAT）与 SUPABASE_PROJECT_ID（项目 ref）。
// 已应用的版本记在 supabase_migrations.schema_migrations，与官方 CLI 同一张表，
// 所以两边可以混用，不会重复执行。

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Node's built-in fetch ignores HTTPS_PROXY unless this is set — without it every
// request inside a Claude Cloud container fails as a bare "fetch failed".
if (process.env.HTTPS_PROXY ?? process.env.https_proxy) {
  process.env.NODE_USE_ENV_PROXY = "1";
}

const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const ref = process.env.SUPABASE_PROJECT_ID ?? "";
const apply = process.argv.includes("--apply");

if (!token || !ref) {
  console.error(
    "✗ 缺少 SUPABASE_ACCESS_TOKEN 或 SUPABASE_PROJECT_ID。\n" +
      "  PAT：supabase.com/dashboard/account/tokens\n" +
      "  ref：项目 URL 里 https:// 与 .supabase.co 之间那段",
  );
  process.exit(1);
}

const ENDPOINT = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function run(sql: string) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) {
    // 403 here is ambiguous: it can be the egress policy refusing the CONNECT,
    // or Supabase refusing the token. Say which, so the fix is obvious.
    const hint =
      res.status === 403
        ? "\n  → 若是出网被拦：Claude 环境 Network access 改 Custom 并加 api.supabase.com\n" +
          "    若是令牌问题：确认 PAT 未过期且对该项目有权限"
        : "";
    throw new Error(`HTTP ${res.status} ${text.slice(0, 400)}${hint}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

// The CLI's own bookkeeping table. Creating it here keeps `supabase db push`
// and this script from re-running each other's migrations.
await run(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );
`);

const applied = new Set(
  ((await run(
    "select version from supabase_migrations.schema_migrations order by version;",
  )) as { version: string }[]).map((r) => r.version),
);

const dir = join(import.meta.dirname, "..", "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

// 0001_init.sql → version 0001. Matches how the CLI keys its timestamped files.
const pending = files.filter((f) => !applied.has(f.split("_")[0]));

console.log(`\n项目 ${ref} · 迁移 ${files.length} 个，已应用 ${applied.size} 个\n`);
for (const f of files) {
  console.log(`  ${applied.has(f.split("_")[0]) ? "✓ 已应用" : "· 待执行"}  ${f}`);
}

if (!pending.length) {
  console.log("\n数据库已是最新。\n");
  process.exit(0);
}

if (!apply) {
  console.log(`\n干跑模式：以上 ${pending.length} 个迁移尚未执行。`);
  console.log("确认无误后加 --apply 真正写入：npm run db:push -- --apply\n");
  process.exit(0);
}

for (const f of pending) {
  const version = f.split("_")[0];
  const sql = await readFile(join(dir, f), "utf8");
  process.stdout.write(`  执行 ${f} … `);
  try {
    await run(sql);
    await run(
      `insert into supabase_migrations.schema_migrations (version, name)
       values ('${version}', '${f.replace(/'/g, "''")}')
       on conflict (version) do nothing;`,
    );
    console.log("✓");
  } catch (e) {
    console.log("✗");
    console.error(`\n${f} 执行失败：\n  ${e instanceof Error ? e.message : String(e)}\n`);
    console.error("已成功的迁移保持已应用状态，修好后重跑即可从断点继续。\n");
    process.exit(1);
  }
}

console.log(`\n完成：应用了 ${pending.length} 个迁移。\n`);

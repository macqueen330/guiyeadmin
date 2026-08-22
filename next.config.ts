import type { NextConfig } from "next";

// E2E_MOCK_SUPABASE=1 时，把 Supabase 的两个 SDK 换成 e2e/mock 下的本地
// Postgres 实现。仅用于端到端测试：应用源码不含任何测试分支，生产构建
// （不带该环境变量）走的是真实 @supabase/* 包。
const e2e = process.env.E2E_MOCK_SUPABASE === "1";

const nextConfig: NextConfig = {
  ...(e2e
    ? {
        turbopack: {
          resolveAlias: {
            "@supabase/supabase-js": "./e2e/mock/supabase-js.ts",
            "@supabase/ssr": "./e2e/mock/supabase-ssr.ts",
          },
        },
      }
    : {}),
};

export default nextConfig;

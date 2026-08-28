// Next.js 16 route protection. NOTE: in Next 16 the `middleware` convention was
// renamed to `proxy` (Node.js runtime, function named `proxy`).
//
// The proxy is the COARSE gate: it refreshes the Supabase session cookie and
// bounces unauthenticated visitors to /login. It is intentionally NOT the source
// of truth for authorization — per the Next.js data-security guidance, every
// Server Action and page re-checks status + permissions server-side
// (see src/lib/auth/context.ts). This defends against the case where a Server
// Function POST is not covered by the matcher.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isAuthConfigured,
} from "@/lib/supabase/config";

// Paths that never require an admin session.
//
//  * /api/pay/*        支付平台异步通知 —— 按签名验证，不可能带管理员 Cookie
//  * /api/logistics/*  承运商 Webhook —— 同上
//  * /api/analytics/*  官网埋点采集 —— 公开写入端点（仅接受埋点，不返回数据）
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/api/pay",
  "/api/logistics",
  "/api/analytics",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 未配置 Supabase 时不再放行整站（旧行为等于开放一个无鉴权入口）。
  // 除登录页与 webhook 外一律弹回 /login，由登录页提示部署者补环境变量。
  if (!isAuthConfigured) {
    if (isPublic(pathname)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "unconfigured");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() (not getSession()) — it revalidates the JWT with the
  // auth server, so a tampered/expired cookie can't fake a session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets & image optimization. Auth pages are
  // matched too (so their session cookie stays fresh) but handled as public above.
  // public/ 下的静态文件也要排除。原来只排除了图片后缀，导致 robots.txt、
  // sitemap.xml、字体、以及给官网用的 /guiye-track.js 全部被弹去登录页
  // （浏览器侧表现为 ERR_BLOCKED_BY_ORB —— 拿到的是 HTML 而不是 JS）。
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|js|mjs|css|map|txt|xml|json|woff|woff2|ttf|otf|eot|pdf|mp4|webm)$).*)",
  ],
};

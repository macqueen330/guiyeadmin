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

// Paths that never require a session.
const PUBLIC_PREFIXES = ["/login", "/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Demo mode (no service role → no real auth): let everything through so the
  // dashboard still renders. Matches getCurrentAdmin()/isDemoMode().
  if (!isAuthConfigured) return NextResponse.next();

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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

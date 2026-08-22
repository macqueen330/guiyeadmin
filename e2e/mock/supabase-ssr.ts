/* eslint-disable @typescript-eslint/no-explicit-any */
// @supabase/ssr 的测试替身。保留真实的 cookies.getAll / setAll 契约，
// 所以 proxy.ts 的会话刷新与登录页写 Cookie 的路径与生产一致。
import { makeQueryClient } from "./pgrest";
import { makeAuth, type CookieAdapter } from "./auth";

export function createServerClient(
  _url: string,
  _key: string,
  opts: { cookies: CookieAdapter },
): any {
  return { ...makeQueryClient(), auth: makeAuth(opts.cookies) };
}

export function createBrowserClient(_url: string, _key: string): any {
  return { ...makeQueryClient(), auth: makeAuth(null) };
}

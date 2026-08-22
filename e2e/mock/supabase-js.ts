/* eslint-disable @typescript-eslint/no-explicit-any */
// @supabase/supabase-js 的测试替身（仅在 E2E_MOCK_SUPABASE=1 时被 alias 进来）
import { makeQueryClient } from "./pgrest";
import { makeAuth } from "./auth";

export type SupabaseClient = any;

export function createClient(_url: string, _key: string, _opts?: any): SupabaseClient {
  // service_role 客户端：没有 Cookie 上下文，只用 auth.admin.*
  return { ...makeQueryClient(), auth: makeAuth(null) };
}
const mock = { createClient };
export default mock;

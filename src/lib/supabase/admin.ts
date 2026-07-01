import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  isAuthConfigured,
} from "./config";

// Service-role Supabase client. Bypasses RLS, so it MUST only ever run on the
// server and only after the caller has been authorized in application code
// (see src/lib/auth/context.ts requirePermission / assertCanManage). It is used
// for: reading & writing the admins table, the audit log, and the Auth Admin API
// (createUser / updateUserById / etc.).
//
// Returns null when the service role isn't configured (demo mode).
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isAuthConfigured) return null;
  if (cached) return cached;
  cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

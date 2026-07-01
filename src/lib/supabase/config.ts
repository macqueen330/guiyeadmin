// Centralized check for whether Supabase is wired up. When the env vars are
// absent (e.g. a fresh Vercel deploy before the project is connected) the app
// gracefully falls back to bundled seed data so every page still renders.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Server-only. Never exposed to the browser (no NEXT_PUBLIC_ prefix). Required
// for admin operations: creating auth users, resetting passwords, and reading /
// writing the RLS-protected admins & audit tables.
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// True when the service role is available — real auth + admin management are on.
// When false the app runs in read-only "demo mode" with a stand-in super admin
// so existing pages still render (e.g. before the DB is connected).
export const isAuthConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);

// Centralized check for whether Supabase is wired up. When the env vars are
// absent (e.g. a fresh Vercel deploy before the project is connected) the app
// gracefully falls back to bundled seed data so every page still renders.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

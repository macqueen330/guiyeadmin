import "server-only";

import { scopeOf } from "@/lib/auth/permissions";
import type { Admin } from "@/lib/types";

// A single-column IN/EQ constraint the data layer applies to a table so an admin
// only ever receives rows within their data scope. Enforced SERVER-SIDE — both
// on the Supabase query (pushed to the DB) and on the mock fallback (JS filter).
//
// Field mapping given the current schema:
//   self         → owner_admin_id = me
//   subordinate  → owner_admin_id in [me, ...scope_values(下属 id)]
//   region       → country in scope_values
//   warehouse    → ship_from in scope_values (orders only)
//   dept         → (no row-level dept column yet) → no additional filter
//   all          → no filter
export interface ScopeFilter {
  column: string;
  values: string[];
}

export function orderScopeFilter(admin: Admin | null): ScopeFilter | null {
  if (!admin) return null;
  const { scope, values } = scopeOf(admin);
  switch (scope) {
    case "all":
    case "dept":
      return null;
    case "self":
      return { column: "owner_admin_id", values: [admin.id] };
    case "subordinate":
      return { column: "owner_admin_id", values: [admin.id, ...values] };
    case "region":
      return values.length ? { column: "country", values } : null;
    case "warehouse":
      return values.length ? { column: "ship_from", values } : null;
    default:
      return null;
  }
}

export function customerScopeFilter(admin: Admin | null): ScopeFilter | null {
  if (!admin) return null;
  const { scope, values } = scopeOf(admin);
  switch (scope) {
    case "all":
    case "dept":
    case "warehouse":
      return null;
    case "self":
      return { column: "owner_admin_id", values: [admin.id] };
    case "subordinate":
      return { column: "owner_admin_id", values: [admin.id, ...values] };
    case "region":
      return values.length ? { column: "country", values } : null;
    default:
      return null;
  }
}

// Apply a scope filter to an already-fetched array (mock fallback path).
export function applyScope<T extends Record<string, unknown>>(rows: T[], f: ScopeFilter | null): T[] {
  if (!f) return rows;
  const set = new Set(f.values);
  return rows.filter((r) => set.has(String(r[f.column] ?? "")));
}

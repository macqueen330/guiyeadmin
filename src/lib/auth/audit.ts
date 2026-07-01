import "server-only";

import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Admin } from "@/lib/types";

export type AuditCategory = "auth" | "operation";
export type AuditResult = "success" | "fail" | "denied";

export interface AuditActor {
  id?: string | null;
  name?: string | null;
  level?: string | null;
}

export interface AuditEntry {
  category: AuditCategory;
  action: string;
  actor?: AuditActor;
  target_id?: string | null;
  target_name?: string | null;
  module?: string | null;
  detail?: string | null;
  before?: unknown;
  after?: unknown;
  result?: AuditResult;
}

// Derive a coarse "OS / Browser" label from the User-Agent, matching the style
// already used in the operation-log UI (e.g. "macOS / Chrome").
function deviceFromUA(ua: string): string {
  if (!ua) return "未知设备";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Macintosh|Mac OS X/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "其他";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "浏览器";
  return `${os} / ${browser}`;
}

// Read best-effort client IP + device from the incoming request headers.
export async function requestMeta(): Promise<{ ip: string; device: string; ua: string }> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for") ?? "";
    const ip = (fwd.split(",")[0] || h.get("x-real-ip") || "").trim() || "内网/未知";
    const ua = h.get("user-agent") ?? "";
    return { ip, device: deviceFromUA(ua), ua };
  } catch {
    return { ip: "内网/未知", device: "未知设备", ua: "" };
  }
}

// Persist an audit record. Best-effort: never throws (auditing must not break the
// operation it records). No-op in demo mode (no service role).
export async function logAudit(entry: AuditEntry): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  try {
    const meta = await requestMeta();
    await sb.from("admin_audit_logs").insert({
      category: entry.category,
      action: entry.action,
      actor_id: entry.actor?.id ?? null,
      actor_name: entry.actor?.name ?? null,
      actor_level: entry.actor?.level ?? null,
      target_id: entry.target_id ?? null,
      target_name: entry.target_name ?? null,
      module: entry.module ?? null,
      detail: entry.detail ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: meta.ip,
      device: meta.device,
      user_agent: meta.ua,
      result: entry.result ?? "success",
    });
  } catch {
    // swallow — auditing is best-effort
  }
}

export function actorFrom(admin: Pick<Admin, "id" | "name" | "level">): AuditActor {
  return { id: admin.id, name: admin.name, level: admin.level };
}

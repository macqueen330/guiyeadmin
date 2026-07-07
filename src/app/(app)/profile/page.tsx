import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { getCurrentAdmin, DEMO_ADMIN } from "@/lib/auth/context";
import { effectiveGrants } from "@/lib/auth/permissions";
import { listAuditLogsByActor, type AuditLog } from "@/lib/auth/store";
import {
  PERMISSION_MODULES,
  grantedActions,
  LOGIN_POLICY,
} from "@/lib/rbac";
import { ADMIN_STATUS } from "@/lib/tokens";
import { ProfileBasicForm, ChangePasswordForm } from "./ProfileForms";
import type { Admin } from "@/lib/types";

export const metadata = { title: "个人中心 · GUIYE 瑰野" };

const TABS = [
  { key: "basic", label: "基本资料" },
  { key: "perms", label: "账号与权限" },
  { key: "security", label: "安全设置" },
  { key: "devices", label: "登录设备" },
  { key: "logs", label: "个人日志" },
];

function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg,#2a9c74,#175f47)",
        color: "#fff",
        fontWeight: 800,
        fontSize: size * 0.4,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      }}
    >
      {name[0]}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{value}</span>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9a9f9a", padding: "10px 8px", borderBottom: "1px solid var(--line)" };
const td: React.CSSProperties = { padding: "11px 8px", borderBottom: "1px solid var(--line)", fontSize: 12.5 };

function ResultTag({ result }: { result: string }) {
  const tone =
    result === "success"
      ? { c: "#16894f", b: "#e9f5ef", t: "成功" }
      : result === "denied"
        ? { c: "#c0392b", b: "#fdf0ef", t: "拒绝" }
        : { c: "#b45309", b: "#fff7ec", t: "失败" };
  return <span style={{ fontSize: 10.5, fontWeight: 700, color: tone.c, background: tone.b, padding: "2px 8px", borderRadius: 20 }}>{tone.t}</span>;
}

function LogRows({ logs, empty }: { logs: AuditLog[]; empty: string }) {
  if (logs.length === 0) return <span style={{ fontSize: 12.5, color: "var(--muted)", padding: "12px 0" }}>{empty}</span>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>时间</th>
          <th style={th}>内容</th>
          <th style={th}>设备</th>
          <th style={th}>IP</th>
          <th style={{ ...th, textAlign: "center" }}>结果</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((l) => (
          <tr key={l.id} className="row-hover">
            <td style={{ ...td, color: "var(--muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{(l.created_at ?? "").slice(0, 16).replace("T", " ")}</td>
            <td style={{ ...td, color: "#4a514c" }}>{l.detail ?? l.action}</td>
            <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>{l.device ?? "—"}</td>
            <td style={{ ...td, color: "var(--muted)" }}>{l.ip ?? "—"}</td>
            <td style={{ ...td, textAlign: "center" }}><ResultTag result={l.result} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SAMPLE_AUTH: AuditLog[] = [
  { id: "s1", category: "auth", action: "login_success", actor_id: null, actor_name: null, actor_level: null, target_id: null, target_name: null, module: null, detail: "登录成功", ip: "已记录", device: "macOS / Chrome", result: "success", created_at: "2026-07-01 09:32" },
  { id: "s2", category: "auth", action: "logout", actor_id: null, actor_name: null, actor_level: null, target_id: null, target_name: null, module: null, detail: "退出登录", ip: "已记录", device: "Windows / Edge", result: "success", created_at: "2026-06-30 18:40" },
];
const SAMPLE_OPS: AuditLog[] = [
  { id: "o1", category: "operation", action: "update_admin", actor_id: null, actor_name: null, actor_level: null, target_id: null, target_name: "刘洋", module: "系统设置", detail: "编辑管理员「刘洋」的权限", ip: "已记录", device: "macOS / Chrome", result: "success", created_at: "2026-07-01 11:05" },
];

function PermChip({ label, on, sensitive }: { label: string; on: boolean; sensitive?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        borderRadius: 8,
        fontSize: 11.5,
        fontWeight: 600,
        color: on ? "var(--accent-strong)" : "#b3b7b1",
        background: on ? "var(--accent-soft)" : "var(--bg)",
        border: on ? "1px solid var(--accent)" : "1px dashed var(--line)",
        opacity: on ? 1 : 0.7,
      }}
    >
      {on && <Icon name="check" size={10} strokeWidth={3.2} />}
      {label}
      {sensitive && <span style={{ fontSize: 9, fontWeight: 800, color: "#b45309" }}>高</span>}
    </span>
  );
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? tab! : "basic";
  const me: Admin = (await getCurrentAdmin()) ?? DEMO_ADMIN;

  const statusTone = ADMIN_STATUS[me.status];
  const grants = effectiveGrants(me);

  const authLogs = active === "devices" ? ((await listAuditLogsByActor(me.id, "auth", 50)) ?? SAMPLE_AUTH) : [];
  const opLogs = active === "logs" ? ((await listAuditLogsByActor(me.id, "operation", 50)) ?? SAMPLE_OPS) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.key === "basic" ? "/profile" : `/profile?tab=${t.key}`}
              style={{
                padding: "10px 14px",
                fontSize: 13.5,
                fontWeight: on ? 700 : 500,
                color: on ? "var(--accent)" : "#6b716d",
                borderBottom: on ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Identity header (always shown) */}
      <Card style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Avatar name={me.name} />
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{me.name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "2px 9px", borderRadius: 20 }}>{me.role}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: statusTone.color, background: statusTone.bg, padding: "2px 9px", borderRadius: 20 }}>{statusTone.text}</span>
          </div>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{me.role} · {me.dept || "—"} · {me.email}</span>
        </div>
      </Card>

      {active === "basic" && (
        <>
          <Card style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
            <InfoRow label="姓名" value={me.name} />
            <InfoRow label="账号角色" value={me.role} />
            <InfoRow label="部门 / 职位" value={me.dept || "—"} />
            <InfoRow label="邮箱（登录账号）" value={me.email} />
            <InfoRow label="账号状态" value={<span style={{ color: statusTone.color }}>{statusTone.text}</span>} />
            <InfoRow label="最近登录" value={me.last_login} />
          </Card>
          <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>编辑基本资料</span>
            <ProfileBasicForm name={me.name} phone={me.phone} dept={me.dept} />
          </Card>
        </>
      )}

      {active === "perms" && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>我的权限</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              账号角色 <b>{me.role}</b> · 拥有系统全部权限。
            </span>
          </div>
          {PERMISSION_MODULES.map((m, i) => {
            const set = grantedActions(m, me.level === "L1" ? "all" : grants[m.key]);
            return (
              <div key={m.key} style={{ display: "flex", gap: 12, padding: "10px 2px", borderBottom: i === PERMISSION_MODULES.length - 1 ? "none" : "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: 120, flex: "none" }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <Icon name={m.icon} size={14} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#2c322e" }}>{m.name}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
                  {m.actions.map((a) => (
                    <PermChip key={a.name} label={a.name} sensitive={a.sensitive} on={set.has(a.name)} />
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {active === "security" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>修改密码</span>
            {me.password_change_required && (
              <div style={{ fontSize: 12, fontWeight: 600, color: "#b45309", background: "#fff7ec", border: "1px solid #f2e2c4", borderRadius: 9, padding: "9px 11px" }}>
                首次登录 / 已被重置，建议立即修改密码。
              </div>
            )}
            <ChangePasswordForm />
          </Card>
          <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>安全策略</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {LOGIN_POLICY.map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0" }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: "#e9f5ef", color: "#16894f", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <Icon name="check" size={12} strokeWidth={2.8} />
                  </span>
                  <span style={{ fontSize: 12.5, color: "#3a403c" }}>{p}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 9, background: "var(--bg)" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#3a403c" }}>二次验证（2FA）</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: me.two_factor ? "#16894f" : "var(--muted)" }}>{me.two_factor ? "已开启" : "未开启 · 预留"}</span>
            </div>
          </Card>
        </div>
      )}

      {active === "devices" && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>登录设备与记录</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>本人近期的登录 / 退出记录（含设备与 IP）</span>
          </div>
          <LogRows logs={authLogs} empty="暂无登录记录" />
        </Card>
      )}

      {active === "logs" && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>个人操作日志</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>本人在系统内的重要操作留痕</span>
          </div>
          <LogRows logs={opLogs} empty="暂无操作记录" />
        </Card>
      )}
    </div>
  );
}

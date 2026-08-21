import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/Form";
import { requireAdmin } from "@/lib/auth/context";
import { effectiveGrants } from "@/lib/auth/permissions";
import {
  listAuditLogsByActor,
  listSessionsByAdmin,
  type AuditLog,
} from "@/lib/auth/store";
import { PERMISSION_MODULES, grantedActions } from "@/lib/rbac";
import { loadSettings } from "@/lib/data/settings";
import { loadSecurityPolicies, POLICY_STATUS_LABEL, POLICY_STATUS_TONE } from "@/lib/data/policy";
import { ADMIN_STATUS, fmtDateTime, fmtRelative, initial } from "@/lib/tokens";
import { ProfileBasicForm, ChangePasswordForm, RevokeSessionsForm } from "./ProfileForms";
import type { AdminSession } from "@/lib/types";

export const dynamic = "force-dynamic";
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
      {initial(name)}
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

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  color: "#9a9f9a",
  padding: "10px 8px",
  borderBottom: "1px solid var(--line)",
};
const td: React.CSSProperties = {
  padding: "11px 8px",
  borderBottom: "1px solid var(--line)",
  fontSize: 12.5,
};

function ResultTag({ result }: { result: string }) {
  const tone =
    result === "success"
      ? { c: "#16894f", b: "#e9f5ef", t: "成功" }
      : result === "denied"
        ? { c: "#c0392b", b: "#fdf0ef", t: "拒绝" }
        : { c: "#b45309", b: "#fff7ec", t: "失败" };
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: tone.c,
        background: tone.b,
        padding: "2px 8px",
        borderRadius: 20,
      }}
    >
      {tone.t}
    </span>
  );
}

function LogRows({ logs, empty }: { logs: AuditLog[]; empty: string }) {
  if (logs.length === 0) {
    return <EmptyState title={empty} hint="所有登录与重要操作都会自动留痕，这里只显示本人的记录。" compact />;
  }
  return (
    <div style={{ overflowX: "auto" }}>
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
              <td
                style={{
                  ...td,
                  color: "var(--muted)",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {fmtDateTime(l.created_at)}
              </td>
              <td style={{ ...td, color: "#4a514c" }}>{l.detail ?? l.action}</td>
              <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>
                {l.device ?? "—"}
              </td>
              <td style={{ ...td, color: "var(--muted)" }}>{l.ip ?? "—"}</td>
              <td style={{ ...td, textAlign: "center" }}>
                <ResultTag result={l.result} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionRows({
  sessions,
  currentEpoch,
}: {
  sessions: AdminSession[];
  currentEpoch: number;
}) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="暂无会话记录"
        hint="每次登录都会写入一条会话记录（设备、IP、登录时间），退出或强制下线时标记为已注销。"
        compact
      />
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>设备</th>
            <th style={th}>IP</th>
            <th style={th}>登录时间</th>
            <th style={th}>状态</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const revoked = Boolean(s.revoked_at);
            const current = !revoked && s.session_epoch === currentEpoch;
            return (
              <tr key={s.id} className="row-hover">
                <td style={{ ...td, fontWeight: 600, color: "#2c322e" }}>
                  {s.device ?? "未知设备"}
                </td>
                <td style={{ ...td, color: "var(--muted)" }}>{s.ip ?? "—"}</td>
                <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {fmtDateTime(s.signed_in_at)}
                  <span style={{ marginLeft: 6, fontSize: 11 }}>{fmtRelative(s.signed_in_at)}</span>
                </td>
                <td style={td}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: revoked ? "#6b716d" : current ? "#16894f" : "#b45309",
                      background: revoked ? "#f1f2f0" : current ? "#e9f5ef" : "#fff7ec",
                      padding: "2px 8px",
                      borderRadius: 20,
                    }}
                  >
                    {revoked ? "已注销" : current ? "当前会话" : "仍有效"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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

  // 原来这里是 `(await getCurrentAdmin()) ?? DEMO_ADMIN` —— 没登录也能看到一个
  // 「演示管理员 / 一级 / 全部权限」的资料页。现在没有会话就跳登录。
  const me = await requireAdmin();

  const statusTone = ADMIN_STATUS[me.status];
  const grants = effectiveGrants(me);
  const settings = await loadSettings();

  // 原来空数据时会回落到 SAMPLE_AUTH / SAMPLE_OPS 两组编造的记录
  // （"macOS / Chrome"、"编辑管理员「刘洋」的权限"）。审计日志绝不能编造。
  const authLogs = active === "devices" ? await listAuditLogsByActor(me.id, "auth", 50) : null;
  const opLogs = active === "logs" ? await listAuditLogsByActor(me.id, "operation", 50) : null;
  const sessions = active === "devices" ? await listSessionsByAdmin(me.id, 20) : [];
  const currentEpoch = me.session_epoch ?? 0;
  const otherActive = sessions.filter(
    (s) => !s.revoked_at && s.session_epoch !== currentEpoch,
  ).length;

  const policies = active === "security" ? await loadSecurityPolicies() : [];

  // 权限清单：一级管理员拥有全部权限，其余按实际授权渲染。
  // 原来的副标题无条件写「拥有系统全部权限」，对二 / 三级管理员是错的。
  const isSuper = me.level === "L1";

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
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent)",
                background: "var(--accent-soft)",
                padding: "2px 9px",
                borderRadius: 20,
              }}
            >
              {me.role}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: statusTone.color,
                background: statusTone.bg,
                padding: "2px 9px",
                borderRadius: 20,
              }}
            >
              {statusTone.text}
            </span>
            {me.scope_label && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#5b6470",
                  background: "#eef0f2",
                  padding: "2px 9px",
                  borderRadius: 20,
                }}
              >
                {me.scope_label}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {me.dept || "—"} · {me.email}
          </span>
        </div>
      </Card>

      {active === "basic" && (
        <>
          <Card style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
            <InfoRow label="姓名" value={me.name} />
            <InfoRow label="账号角色" value={me.role} />
            <InfoRow label="部门 / 职位" value={me.dept || "—"} />
            <InfoRow label="邮箱（登录账号）" value={me.email} />
            <InfoRow
              label="账号状态"
              value={<span style={{ color: statusTone.color }}>{statusTone.text}</span>}
            />
            <InfoRow label="数据范围" value={me.scope_label || "—"} />
            <InfoRow
              label="最近登录"
              value={me.last_login_at ? fmtDateTime(me.last_login_at) : me.last_login || "—"}
            />
            <InfoRow label="账号创建" value={me.created_at ? fmtDateTime(me.created_at) : "—"} />
          </Card>
          <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>编辑基本资料</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                等级、角色、权限与数据范围由一级管理员在「管理员管理」中调整，本人不可自改
              </span>
            </div>
            <ProfileBasicForm name={me.name} phone={me.phone} dept={me.dept} />
          </Card>
        </>
      )}

      {active === "perms" && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>我的权限</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              账号角色 <b>{me.role}</b> ·{" "}
              {isSuper
                ? "一级管理员，拥有系统全部权限"
                : `按授权开放 ${Object.keys(grants).length} 个模块，未点亮的操作会在服务端被拒绝`}
            </span>
          </div>
          {PERMISSION_MODULES.map((m, i) => {
            const set = grantedActions(m, isSuper ? "all" : grants[m.key]);
            return (
              <div
                key={m.key}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 2px",
                  borderBottom:
                    i === PERMISSION_MODULES.length - 1 ? "none" : "1px solid var(--line)",
                  opacity: set.size === 0 ? 0.55 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: 120, flex: "none" }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
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
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#b45309",
                  background: "#fff7ec",
                  border: "1px solid #f2e2c4",
                  borderRadius: 9,
                  padding: "9px 11px",
                }}
              >
                首次登录 / 密码已被重置，请立即修改密码。
              </div>
            )}
            <ChangePasswordForm security={settings.security} />
          </Card>
          <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>作用在我账号上的策略</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                未实现的能力标注「规划中」，不会打对勾
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {policies.map((p) => {
                const tone = POLICY_STATUS_TONE[p.status];
                return (
                  <div
                    key={p.key}
                    style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 0" }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        background: tone.bg,
                        color: tone.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "none",
                        marginTop: 1,
                      }}
                    >
                      <Icon
                        name={p.status === "enforced" ? "check" : p.status === "planned" ? "clock" : "alert"}
                        size={12}
                        strokeWidth={2.8}
                      />
                    </span>
                    <span style={{ fontSize: 12.5, color: "#3a403c", lineHeight: 1.6 }}>
                      {p.text}
                      <span
                        style={{
                          marginLeft: 7,
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: tone.color,
                          background: tone.bg,
                          padding: "1px 7px",
                          borderRadius: 20,
                        }}
                      >
                        {POLICY_STATUS_LABEL[p.status]}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: 9,
                background: "var(--bg)",
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#3a403c" }}>
                二次验证（2FA）
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: me.two_factor ? "#16894f" : "var(--muted)",
                }}
              >
                {me.two_factor ? "账号已标记开启" : "未接入 · 规划中"}
              </span>
            </div>
          </Card>
        </div>
      )}

      {active === "devices" && (
        <>
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>登录会话</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {otherActive > 0
                    ? `除当前设备外还有 ${otherActive} 个会话仍然有效`
                    : "当前只有本设备处于登录状态"}
                  ｜会话有效期 {settings.security.sessionHours} 小时
                </span>
              </div>
              <RevokeSessionsForm others={otherActive} />
            </div>
            <SessionRows sessions={sessions} currentEpoch={currentEpoch} />
          </Card>
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>登录 / 退出记录</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>本人近期的认证事件（含设备与 IP）</span>
            </div>
            <LogRows logs={authLogs ?? []} empty="暂无登录记录" />
          </Card>
        </>
      )}

      {active === "logs" && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>个人操作日志</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>本人在系统内的重要操作留痕</span>
          </div>
          <LogRows logs={opLogs ?? []} empty="暂无操作记录" />
        </Card>
      )}
    </div>
  );
}

import type { ReactNode } from "react";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { Card } from "@/components/ui/Card";
import { SubTabs } from "@/components/ui/SubTabs";
import { ModulePlaceholder } from "@/components/ui/ModulePlaceholder";
import { Forbidden } from "@/components/ui/Forbidden";
import { admins as mockAdmins } from "@/lib/mock/admin";
import { listAdmins, listAuditLogs, type AuditLog } from "@/lib/auth/store";
import { getCurrentAdmin, DEMO_ADMIN } from "@/lib/auth/context";
import { can, canManageAdmins } from "@/lib/auth/permissions";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { ADMIN_LEVEL } from "@/lib/tokens";
import { AUDITED_ACTIONS } from "@/lib/rbac";
import type { AdminLevel } from "@/lib/types";
import { AdminPermissions } from "./AdminPermissions";
import { StaffView } from "./StaffView";
import { ApprovalRules } from "./ApprovalRules";
import { SecurityPolicy } from "./SecurityPolicy";

function OnValue({ text }: { text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16894f", flex: "none" }} />
      <span style={{ color: "#16894f" }}>{text}</span>
    </span>
  );
}

function Panel({ title, subtitle, rows }: { title: string; subtitle: string; rows: { label: string; sub?: string; value: ReactNode }[] }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
      </div>
      <div>
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 0",
              borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{row.label}</span>
              {row.sub && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{row.sub}</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", textAlign: "right" }}>{row.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Fallback sample shown only in demo mode (no DB / audit table).
const SAMPLE_LOGS: AuditLog[] = [
  { id: "1", category: "operation", action: "set_status", actor_id: null, actor_name: "李明", actor_level: "L2", target_id: null, target_name: "GY-28471", module: "订单中心", detail: "将订单 GY-28471 状态从「待发货」改为「已发货」", ip: "已记录", device: "Windows / Edge", result: "success", created_at: "2026-07-01 15:26" },
  { id: "2", category: "operation", action: "reset_password", actor_id: null, actor_name: "陈思远", actor_level: "L1", target_id: null, target_name: "刘洋", module: "系统设置", detail: "重置管理员「刘洋」的登录密码", ip: "已记录", device: "macOS / Safari", result: "success", created_at: "2026-06-30 18:22" },
  { id: "3", category: "auth", action: "login_success", actor_id: null, actor_name: "王浩", actor_level: "L3", target_id: null, target_name: null, module: null, detail: "登录成功", ip: "已记录", device: "Windows / Chrome", result: "success", created_at: "2026-07-01 10:05" },
  { id: "4", category: "auth", action: "login_fail", actor_id: null, actor_name: "刘洋", actor_level: "L3", target_id: null, target_name: null, module: null, detail: "密码错误（第 2 次）", ip: "已记录", device: "Android / App", result: "fail", created_at: "2026-06-30 09:11" },
];

const th: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9a9f9a", padding: "10px 8px", borderBottom: "1px solid var(--line)" };
const td: React.CSSProperties = { padding: "11px 8px", borderBottom: "1px solid var(--line)", fontSize: 12.5 };

function LevelTag({ level }: { level: string | null }) {
  const t = ADMIN_LEVEL[(level as AdminLevel) ?? "L3"] ?? ADMIN_LEVEL.L3;
  return <span style={{ fontSize: 10, fontWeight: 700, color: t.color, background: t.bg, padding: "1px 7px", borderRadius: 20 }}>{t.text}</span>;
}

function ResultTag({ result }: { result: string }) {
  const tone =
    result === "success"
      ? { c: "#16894f", b: "#e9f5ef", t: "成功" }
      : result === "denied"
        ? { c: "#c0392b", b: "#fdf0ef", t: "拒绝" }
        : { c: "#b45309", b: "#fff7ec", t: "失败" };
  return <span style={{ fontSize: 10.5, fontWeight: 700, color: tone.c, background: tone.b, padding: "2px 8px", borderRadius: 20 }}>{tone.t}</span>;
}

function LogTable({ title, subtitle, logs }: { title: string; subtitle: string; logs: AuditLog[] }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
      </div>
      {logs.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--muted)", padding: "12px 0" }}>暂无记录</span>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>时间</th>
              <th style={th}>操作人</th>
              <th style={th}>操作内容</th>
              <th style={th}>对象</th>
              <th style={th}>设备</th>
              <th style={th}>IP</th>
              <th style={{ ...th, textAlign: "center" }}>结果</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="row-hover">
                <td style={{ ...td, color: "var(--muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{(l.created_at ?? "").slice(0, 16).replace("T", " ")}</td>
                <td style={td}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 600, color: "#2c322e" }}>{l.actor_name ?? "—"}</span>
                    <LevelTag level={l.actor_level} />
                  </span>
                </td>
                <td style={{ ...td, color: "#4a514c" }}>{l.detail ?? l.action}</td>
                <td style={{ ...td, color: "#4a514c" }}>{l.target_name ?? "—"}</td>
                <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>{l.device ?? "—"}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{l.ip ?? "—"}</td>
                <td style={{ ...td, textAlign: "center" }}><ResultTag result={l.result} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("settings");
  const active = activeSubView(item, view)?.key ?? "account";

  const me = (await getCurrentAdmin()) ?? DEMO_ADMIN;
  const admins = (await listAdmins()) ?? mockAdmins;
  const manages = canManageAdmins(me);
  const canViewLogs = me.level === "L1" || can(me, "system", "查看操作日志");

  const count = (s: string) => admins.filter((u) => u.status === s).length;
  const l1 = admins.filter((u) => u.level === "L1").length;

  const stats: Stat[] = [
    { label: "管理员数", value: String(admins.length), sub: "全部账号", icon: "users", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
    { label: "启用中", value: String(count("active")), icon: "check", iconColor: "#16894f", iconBg: "#e9f5ef", valueColor: "#16894f" },
    { label: "待激活", value: String(count("pending")), icon: "mail", iconColor: "#b45309", iconBg: "#fff7ec", valueColor: "#b45309" },
    { label: "一级管理员", value: String(l1), sub: "超级管理员", icon: "settings", iconColor: "#b07d18", iconBg: "#fbf4e3", valueColor: "#b07d18" },
  ];

  const opLogs = (await listAuditLogs("operation", 100)) ?? SAMPLE_LOGS.filter((l) => l.category === "operation");
  const authLogs = (await listAuditLogs("auth", 100)) ?? SAMPLE_LOGS.filter((l) => l.category === "auth");

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />

      {active === "account" && (manages ? <AdminPermissions /> : <Forbidden hint="账号与权限仅一级 / 二级管理员可查看。" />)}
      {active === "staff" && (manages ? <StaffView admins={admins} /> : <Forbidden hint="员工管理仅一级 / 二级管理员可访问。" />)}
      {active === "approval" && <ApprovalRules />}
      {active === "security" && <SecurityPolicy />}

      {active === "notify" && (
        <Panel
          title="消息通知"
          subtitle="待办与异常的提醒开关"
          rows={[
            { label: "订单异常提醒", sub: "支付 / 风控 / 发货异常", value: <OnValue text="已开启" /> },
            { label: "库存预警提醒", sub: "低于安全库存时", value: <OnValue text="已开启" /> },
            { label: "渠道客户跟进提醒", sub: "超 7 天未跟进", value: <OnValue text="已开启" /> },
            { label: "回款 / 应收提醒", sub: "应收逾期时", value: <OnValue text="已开启" /> },
            { label: "审批提醒", sub: "有待审批事项时", value: <OnValue text="已开启" /> },
            { label: "售后退款提醒", sub: "新退款申请时", value: <span style={{ color: "var(--muted)" }}>仅站内</span> },
          ]}
        />
      )}

      {active === "logs" &&
        (canViewLogs ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <LogTable title="操作日志" subtitle="重要操作全程留痕 · 普通管理员不可删除" logs={opLogs} />
            <LogTable title="登录日志" subtitle="登录成功 / 失败 / 退出记录" logs={authLogs} />
            <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>留痕范围</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AUDITED_ACTIONS.map((x) => (
                  <span key={x} style={{ fontSize: 11.5, fontWeight: 600, color: "#4a514c", background: "var(--bg)", border: "1px solid var(--line)", padding: "5px 11px", borderRadius: 7 }}>
                    {x}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <Forbidden hint="操作日志仅一级管理员或获授权的管理员可查看。" />
        ))}

      {active === "product" && (
        <ModulePlaceholder
          icon="box"
          title="商品设置"
          description="维护商品分类、计量单位、规格模板与默认税率，统一商品与价格的基础配置。"
          fields={["商品分类", "计量单位", "规格 / SKU 模板", "默认税率", "价格档位", "条码规则"]}
        />
      )}

      {active === "order" && (
        <ModulePlaceholder
          icon="bag"
          title="订单规则"
          description="配置订单号规则、自动审核条件、超时未支付取消、发货时效与售后政策。"
          fields={["订单号规则", "自动审核", "超时取消", "发货时效", "拆合单规则", "售后政策"]}
        />
      )}
    </>
  );
}

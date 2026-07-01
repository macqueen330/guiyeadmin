import type { ReactNode } from "react";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { Card } from "@/components/ui/Card";
import { SubTabs } from "@/components/ui/SubTabs";
import { ModulePlaceholder } from "@/components/ui/ModulePlaceholder";
import { getAdmins } from "@/lib/data/queries";
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

const OPERATION_LOGS: { time: string; operator: string; level: AdminLevel; action: string; module: string; device: string; ip: string }[] = [
  { time: "2026-07-01 15:26", operator: "李明", level: "L2", action: "将订单 GY-28471 状态从「待发货」改为「已发货」", module: "订单中心", device: "Windows / Edge", ip: "已记录" },
  { time: "2026-07-01 14:12", operator: "张薇", level: "L2", action: "审核通过退款 ALR-4620007788-01（¥236）", module: "财务结算", device: "macOS / Chrome", ip: "已记录" },
  { time: "2026-07-01 11:40", operator: "陈思远", level: "L1", action: "修改银联支付配置", module: "支付中心", device: "macOS / Safari", ip: "已记录" },
  { time: "2026-07-01 10:05", operator: "王浩", level: "L3", action: "查看客户 林晚晴 手机号（脱敏）", module: "客户中心", device: "Windows / Chrome", ip: "已记录" },
  { time: "2026-06-30 18:22", operator: "陈思远", level: "L1", action: "停用管理员账号 刘洋", module: "系统设置", device: "macOS / Safari", ip: "已记录" },
  { time: "2026-06-30 16:48", operator: "赵敏", level: "L3", action: "确认出库并打印面单 #GY-28464", module: "仓储物流", device: "Android / App", ip: "已记录" },
];

const th: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9a9f9a", padding: "10px 8px", borderBottom: "1px solid var(--line)" };
const td: React.CSSProperties = { padding: "11px 8px", borderBottom: "1px solid var(--line)", fontSize: 12.5 };

function LevelTag({ level }: { level: AdminLevel }) {
  const t = ADMIN_LEVEL[level];
  return <span style={{ fontSize: 10, fontWeight: 700, color: t.color, background: t.bg, padding: "1px 7px", borderRadius: 20 }}>{t.text}</span>;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("settings");
  const active = activeSubView(item, view)?.key ?? "account";

  const admins = await getAdmins();
  const count = (s: string) => admins.filter((u) => u.status === s).length;
  const l1 = admins.filter((u) => u.level === "L1").length;

  const stats: Stat[] = [
    { label: "管理员数", value: String(admins.length), sub: "全部账号", icon: "users", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
    { label: "启用中", value: String(count("active")), icon: "check", iconColor: "#16894f", iconBg: "#e9f5ef", valueColor: "#16894f" },
    { label: "待激活", value: String(count("pending")), icon: "mail", iconColor: "#b45309", iconBg: "#fff7ec", valueColor: "#b45309" },
    { label: "一级管理员", value: String(l1), sub: "超级管理员", icon: "settings", iconColor: "#b07d18", iconBg: "#fbf4e3", valueColor: "#b07d18" },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />

      {active === "account" && <AdminPermissions />}
      {active === "staff" && <StaffView admins={admins} />}
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

      {active === "logs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>操作日志</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>重要操作全程留痕 · 普通管理员不可删除</span>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>时间</th>
                  <th style={th}>操作人</th>
                  <th style={th}>操作内容</th>
                  <th style={th}>模块</th>
                  <th style={th}>设备</th>
                  <th style={th}>IP</th>
                </tr>
              </thead>
              <tbody>
                {OPERATION_LOGS.map((l) => (
                  <tr key={l.time + l.action} className="row-hover">
                    <td style={{ ...td, color: "var(--muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{l.time}</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600, color: "#2c322e" }}>{l.operator}</span>
                        <LevelTag level={l.level} />
                      </span>
                    </td>
                    <td style={{ ...td, color: "#4a514c" }}>{l.action}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#5b6470", background: "var(--bg)", padding: "3px 9px", borderRadius: 6 }}>{l.module}</span>
                    </td>
                    <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>{l.device}</td>
                    <td style={{ ...td, color: "var(--muted)" }}>{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

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
      )}

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

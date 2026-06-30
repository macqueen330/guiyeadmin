import type { ReactNode } from "react";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { Card } from "@/components/ui/Card";
import { SubTabs } from "@/components/ui/SubTabs";
import { ModulePlaceholder } from "@/components/ui/ModulePlaceholder";
import { getSystemUsers } from "@/lib/data/queries";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { SettingsView } from "./SettingsView";

function OnValue({ text }: { text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16894f", flex: "none" }} />
      <span style={{ color: "#16894f" }}>{text}</span>
    </span>
  );
}

function RowList({ rows }: { rows: { label: string; sub?: string; value: ReactNode }[] }) {
  return (
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
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
      </div>
      {children}
    </Card>
  );
}

const ROLES: { label: string; sub: string }[] = [
  { label: "超级管理员", sub: "全部模块与系统设置" },
  { label: "运营", sub: "订单 / 商品 / 客户 / 渠道 / 内容" },
  { label: "财务", sub: "财务结算 / 对账 / 发票" },
  { label: "仓储", sub: "仓储物流 / 库存" },
  { label: "客服", sub: "订单 / 售后 / 客户" },
];

const OPERATION_LOGS: { time: string; operator: string; action: string; module: string }[] = [
  { time: "2026-06-20 18:02", operator: "陈思远", action: "导出本月销售报表", module: "数据分析" },
  { time: "2026-06-20 17:41", operator: "李娜", action: "审核通过订单 #GY-28469", module: "订单中心" },
  { time: "2026-06-20 16:55", operator: "王浩然", action: "确认回款 RCV-2026-0588", module: "财务结算" },
  { time: "2026-06-20 15:30", operator: "赵敏", action: "标记包裹 #GY-28457 异常", module: "仓储物流" },
  { time: "2026-06-20 14:18", operator: "李娜", action: "新增渠道客户 Milano Vini", module: "渠道管理" },
  { time: "2026-06-20 11:06", operator: "陈思远", action: "更新官网品牌故事文案", module: "品牌内容" },
];

const th: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9a9f9a", padding: "10px 8px", borderBottom: "1px solid var(--line)" };
const td: React.CSSProperties = { padding: "11px 8px", borderBottom: "1px solid var(--line)", fontSize: 12.5 };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("settings");
  const active = activeSubView(item, view)?.key ?? "account";

  const users = await getSystemUsers();
  const count = (s: string) => users.filter((u) => u.status === s).length;
  const roleCount = new Set(users.map((u) => u.role)).size;

  const stats: Stat[] = [
    { label: "成员数", value: String(users.length), icon: "users", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
    { label: "启用中", value: String(count("active")), icon: "check", iconColor: "#16894f", iconBg: "#e9f5ef", valueColor: "#16894f" },
    { label: "待激活邀请", value: String(count("invited")), icon: "mail", iconColor: "#b45309", iconBg: "#fff7ec", valueColor: "#b45309" },
    { label: "角色数", value: String(roleCount), sub: "权限分组", icon: "settings", iconColor: "#2b6cb0", iconBg: "#eef4ff" },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />

      {active === "staff" && <SettingsView users={users} />}

      {active === "account" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Panel title="角色与权限" subtitle="按角色划分模块访问范围">
            <RowList rows={ROLES.map((r) => ({ label: r.label, sub: r.sub, value: <span style={{ color: "var(--muted)", fontSize: 12.5 }}>编辑权限</span> }))} />
          </Panel>
          <Panel title="账号安全" subtitle="登录与会话策略">
            <RowList
              rows={[
                { label: "双因素认证 (2FA)", sub: "管理员登录强制", value: <OnValue text="已启用" /> },
                { label: "登录 IP 限制", sub: "仅允许办公网络", value: <span style={{ color: "var(--muted)" }}>未开启</span> },
                { label: "会话超时", sub: "无操作自动登出", value: "30 分钟" },
                { label: "操作日志保留", value: "180 天" },
              ]}
            />
          </Panel>
        </div>
      )}

      {active === "notify" && (
        <Panel title="消息通知" subtitle="待办与异常的提醒开关">
          <RowList
            rows={[
              { label: "订单异常提醒", sub: "支付 / 风控 / 发货异常", value: <OnValue text="已开启" /> },
              { label: "库存预警提醒", sub: "低于安全库存时", value: <OnValue text="已开启" /> },
              { label: "渠道客户跟进提醒", sub: "超 7 天未跟进", value: <OnValue text="已开启" /> },
              { label: "回款 / 应收提醒", sub: "应收逾期时", value: <OnValue text="已开启" /> },
              { label: "售后退款提醒", sub: "新退款申请时", value: <span style={{ color: "var(--muted)" }}>仅站内</span> },
            ]}
          />
        </Panel>
      )}

      {active === "logs" && (
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>操作日志</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>关键操作的审计记录</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>时间</th>
                <th style={th}>操作人</th>
                <th style={th}>操作</th>
                <th style={th}>模块</th>
              </tr>
            </thead>
            <tbody>
              {OPERATION_LOGS.map((l) => (
                <tr key={l.time} className="row-hover">
                  <td style={{ ...td, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{l.time}</td>
                  <td style={{ ...td, fontWeight: 600, color: "#2c322e" }}>{l.operator}</td>
                  <td style={{ ...td, color: "#4a514c" }}>{l.action}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#5b6470", background: "var(--bg)", padding: "3px 9px", borderRadius: 6 }}>
                      {l.module}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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

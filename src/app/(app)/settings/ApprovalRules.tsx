import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { REFUND_TIERS, APPROVAL_L2, APPROVAL_L1, CONFIRM_ACTIONS } from "@/lib/rbac";

function FlowCard({
  title,
  sub,
  items,
  tone,
}: {
  title: string;
  sub: string;
  items: string[];
  tone: { color: string; bg: string };
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it, i) => (
          <div
            key={it}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 0",
              borderBottom: i === items.length - 1 ? "none" : "1px solid var(--line)",
            }}
          >
            <span style={{ width: 24, height: 24, borderRadius: 7, background: tone.bg, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Icon name="check" size={13} strokeWidth={2.6} />
            </span>
            <span style={{ fontSize: 13, color: "#2c322e" }}>{it}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ApprovalRules() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>退款金额分级审批</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>金额阈值可在系统设置调整，不写死在代码里</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {REFUND_TIERS.map((t) => (
            <div key={t.range} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px", borderRadius: 12, background: "var(--bg)", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.3px" }}>{t.range}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent-strong)" }}>{t.approver}</span>
              {t.note && <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.note}</span>}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FlowCard title="三级发起 · 二级审批" sub="操作员提交，业务管理员审核" items={APPROVAL_L2} tone={{ color: "#2b6cb0", bg: "#eef4ff" }} />
        <FlowCard title="二级发起 · 一级审批" sub="业务管理员提交，超级管理员审核" items={APPROVAL_L1} tone={{ color: "#b45309", bg: "#fff7ec" }} />
      </div>

      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>必须二次确认</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>即使一级管理员，以下操作也需登录密码 + 手机验证码 / 二次密码</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CONFIRM_ACTIONS.map((c) => (
            <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#c0392b", background: "#fdf0ef", border: "1px solid #f6dcd8", padding: "5px 11px", borderRadius: 8 }}>
              <Icon name="alert" size={12} color="#c0392b" />
              {c}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { LOGIN_POLICY, MASKING_EXAMPLES, EXPORT_AUDIT_FIELDS } from "@/lib/rbac";

export function SecurityPolicy() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>登录安全</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>密码、锁定与会话策略</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
          {LOGIN_POLICY.map((p) => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0" }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, background: "#e9f5ef", color: "#16894f", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Icon name="check" size={12} strokeWidth={2.8} />
              </span>
              <span style={{ fontSize: 12.5, color: "#3a403c" }}>{p}</span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>敏感信息脱敏</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>三级默认脱敏；二级按权限；一级 / 授权财务可见完整</span>
          </div>
          <div>
            {MASKING_EXAMPLES.map((m, i) => (
              <div key={m.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: i === MASKING_EXAMPLES.length - 1 ? "none" : "1px solid var(--line)" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{m.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#2c322e", fontVariantNumeric: "tabular-nums", letterSpacing: ".5px" }}>{m.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>导出限制</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>每次导出留痕，大量导出需审批</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {EXPORT_AUDIT_FIELDS.map((f) => (
              <span key={f} style={{ fontSize: 11.5, fontWeight: 600, color: "#4a514c", background: "var(--bg)", border: "1px solid var(--line)", padding: "5px 11px", borderRadius: 7 }}>
                {f}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 9, background: "#fff7ec", border: "1px solid #f2e2c4" }}>
            <Icon name="alert" size={15} color="#b45309" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#b45309" }}>单次导出超过阈值时，需二级 / 一级审批后方可下载</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

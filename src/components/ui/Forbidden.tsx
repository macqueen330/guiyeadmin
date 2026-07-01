import { Card } from "./Card";
import { Icon } from "./Icon";

// Rendered in place of a module/tab when the current admin lacks permission.
// Keeps the shell (so navigation stays usable) instead of a hard redirect.
export function Forbidden({
  title = "无访问权限",
  hint = "你的账号没有查看该模块的权限。如需访问请联系超级管理员调整权限。",
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "#fdf0ef",
          color: "#c0392b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="lock" size={24} />
      </span>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
      <span style={{ fontSize: 13, color: "var(--muted)", maxWidth: 360, lineHeight: 1.7 }}>{hint}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#b45309",
          background: "#fff7ec",
          border: "1px solid #f2e2c4",
          padding: "4px 10px",
          borderRadius: 20,
        }}
      >
        403 · Forbidden
      </span>
    </Card>
  );
}

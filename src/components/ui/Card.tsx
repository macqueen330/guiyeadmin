import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  style,
  padding = "18px 20px",
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: string;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  style,
  padding = "18px 22px",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  padding?: string;
}) {
  return (
    <Card padding={padding} style={{ display: "flex", flexDirection: "column", ...style }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
          {subtitle && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

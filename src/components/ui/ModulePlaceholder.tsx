import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";

// Structured empty-state for sub-modules whose data model is intentionally
// reserved (per the spec: keep the IA, defer the build). It states the module's
// purpose and the fields/capabilities planned for it, so the slot reads as
// "designed, not yet wired" rather than broken.
export function ModulePlaceholder({
  icon = "layers",
  title,
  description,
  fields = [],
  status = "结构预留 · 待接入数据",
}: {
  icon?: IconName;
  title: string;
  description: string;
  fields?: string[];
  status?: string;
}) {
  return (
    <Card
      padding="44px 32px"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "var(--accent-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={24} color="var(--accent)" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 520 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{description}</span>
      </div>

      {fields.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            maxWidth: 560,
            marginTop: 2,
          }}
        >
          {fields.map((f) => (
            <span
              key={f}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "#4a514c",
                background: "var(--bg)",
                border: "1px solid var(--line)",
                padding: "5px 11px",
                borderRadius: 7,
              }}
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <span
        style={{
          marginTop: 4,
          fontSize: 11,
          fontWeight: 700,
          color: "#b45309",
          background: "#fff7ec",
          padding: "4px 11px",
          borderRadius: 20,
        }}
      >
        {status}
      </span>
    </Card>
  );
}

import type { Tone } from "@/lib/tokens";

// Pill with a leading status dot (used for order/shipment/settlement status).
export function StatusTag({ tone }: { tone: Tone }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        color: tone.color,
        background: tone.bg,
        padding: "4px 10px",
        borderRadius: 20,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: tone.color,
        }}
      />
      {tone.text}
    </span>
  );
}

// Flat label chip (used for source / category labels).
export function Chip({
  tone,
  children,
}: {
  tone: Tone;
  children?: React.ReactNode;
}) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: tone.color,
        background: tone.bg,
        padding: "3px 9px",
        borderRadius: 6,
        whiteSpace: "nowrap",
      }}
    >
      {children ?? tone.text}
    </span>
  );
}

export function SoftBadge({
  color,
  bg,
  children,
}: {
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        background: bg,
        padding: "2px 9px",
        borderRadius: 20,
      }}
    >
      {children}
    </span>
  );
}

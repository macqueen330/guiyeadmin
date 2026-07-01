import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { fmtNumber } from "@/lib/tokens";
import { getWebViews } from "@/lib/data/queries";

function Delta({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 1, fontWeight: 600, color: up ? "#16894f" : "#c0392b" }}>
      <Icon name={up ? "chevronUp" : "caretDown"} size={11} strokeWidth={2.8} />
      {Math.abs(v)}%
    </span>
  );
}

// 阅览量 · 当日 / 本月 / 累计。`compact` 用于首页概览的一览卡片。
export function WebViews({ compact = false }: { compact?: boolean }) {
  const w = getWebViews();

  const cells: { label: string; pv: number; sub: React.ReactNode }[] = [
    { label: "今日阅览量", pv: w.pvToday, sub: <>独立访客 {fmtNumber(w.uvToday)} · 较昨日 <Delta v={w.pvTodayDelta} /></> },
    { label: "本月阅览量", pv: w.pvMonth, sub: <>独立访客 {fmtNumber(w.uvMonth)} · 较上月 <Delta v={w.pvMonthDelta} /></> },
    { label: "累计阅览量", pv: w.pvTotal, sub: <>独立访客 {fmtNumber(w.uvTotal)} · {w.since}</> },
  ];

  if (compact) {
    return (
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="globe" size={15} />
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>官网阅览量</span>
          </div>
          <Link href="/analytics?view=web" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
            官网数据 →
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {cells.map((c) => (
            <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.label}</span>
              <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1 }}>{fmtNumber(c.pv)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 22px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="globe" size={16} />
        </span>
        <span style={{ fontSize: 15, fontWeight: 700 }}>官网阅览量</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>当日 · 本月 · 累计（PV / UV）</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
        {cells.map((c, i) => (
          <div
            key={c.label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "12px 22px",
              borderLeft: i === 0 ? "none" : "1px solid var(--line)",
            }}
          >
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>{c.label}</span>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.8px", lineHeight: 1 }}>{fmtNumber(c.pv)}</span>
            <span style={{ fontSize: 11.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              {c.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

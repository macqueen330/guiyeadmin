import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { fmtDate, fmtNumber } from "@/lib/tokens";
import type { WebViewsSummary } from "@/lib/types";

// 官网阅览量。数据来自 web_analytics_daily（由 /api/analytics/collect 的埋点汇总）。
// 页面浏览同时上报给 Vercel Web Analytics；这里是后台可查询的一方数据。

function Delta({ v }: { v: number | null }) {
  if (v === null) {
    return <span style={{ color: "var(--muted)" }}>无对比</span>;
  }
  const up = v >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        fontWeight: 600,
        color: up ? "#16894f" : "#c0392b",
      }}
    >
      <Icon name={up ? "chevronUp" : "caretDown"} size={11} strokeWidth={2.8} />
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

export function WebViews({ data, compact = false }: { data: WebViewsSummary; compact?: boolean }) {
  const hasData = data.pvTotal > 0;

  const cells: { label: string; pv: number; sub: React.ReactNode }[] = [
    {
      label: "今日阅览量",
      pv: data.pvToday,
      sub: (
        <>
          独立访客 {fmtNumber(data.uvToday)} · 较昨日 <Delta v={data.pvTodayDelta} />
        </>
      ),
    },
    {
      label: "近 30 天阅览量",
      pv: data.pvMonth,
      sub: (
        <>
          独立访客 {fmtNumber(data.uvMonth)} · 较上一周期 <Delta v={data.pvMonthDelta} />
        </>
      ),
    },
    {
      label: "累计阅览量",
      pv: data.pvTotal,
      sub: (
        <>
          独立访客 {fmtNumber(data.uvTotal)} ·{" "}
          {data.since ? `${fmtDate(data.since)} 起` : "尚无埋点数据"}
        </>
      ),
    },
  ];

  if (compact) {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="globe" size={15} />
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>官网阅览量</span>
          </div>
          <Link href="/analytics?view=web" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
            官网数据 →
          </Link>
        </div>
        {hasData ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {cells.map((c) => (
              <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.label}</span>
                <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1 }}>
                  {fmtNumber(c.pv)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            尚未收到官网埋点。把 <code>/api/analytics/collect</code> 接到官网后，这里会显示真实 PV / UV。
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="globe" size={16} />
        </span>
        <span style={{ fontSize: 15, fontWeight: 700 }}>官网阅览量</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>当日 · 近 30 天 · 累计（PV / UV）</span>
      </div>
      {hasData ? (
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
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.8px", lineHeight: 1 }}>
                {fmtNumber(c.pv)}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  flexWrap: "wrap",
                }}
              >
                {c.sub}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "26px 4px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.8 }}>
          尚未收到官网埋点数据。
          <br />
          在官网里把浏览与转化事件 POST 到 <code>/api/analytics/collect</code>，
          汇总结果会自动出现在这里与「官网数据」页。
        </div>
      )}
    </div>
  );
}

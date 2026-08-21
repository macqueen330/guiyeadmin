"use client";

import { useState, useTransition } from "react";
import { buildChart } from "@/lib/charts";
import { fmtNumber } from "@/lib/tokens";
import type { SeriesPoint } from "@/lib/types";

// 官网访问趋势。原来 5 个指标 × 4 个区间的曲线全部由 genSeries() 现造，
// 「较上一周期 +18.6%」是写死的 delta，「上一周期」则是用这个写死的 delta
// 去除随机造出来的 total —— 三层假数据叠在一起。
//
// 现在：序列来自 web_analytics_daily，环比是两个等长区间的真实对比。

const METRICS = [
  { key: "pv", label: "浏览量", unit: "次" },
  { key: "uv", label: "访客数", unit: "人" },
  { key: "product_clicks", label: "产品点击", unit: "次" },
  { key: "inquiries", label: "咨询数", unit: "条" },
  { key: "paid", label: "支付成功", unit: "单" },
] as const;

const RANGES = [
  { key: "7", label: "7天" },
  { key: "30", label: "30天" },
  { key: "90", label: "90天" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];
type RangeKey = (typeof RANGES)[number]["key"];

function tabStyle(on: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 7,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontFamily: "inherit",
    background: on ? "var(--card)" : "transparent",
    color: on ? "var(--ink)" : "var(--muted)",
    boxShadow: on ? "0 1px 2px rgba(0,0,0,.07)" : "none",
  };
}
const wrap: React.CSSProperties = {
  display: "flex",
  gap: 2,
  background: "var(--bg)",
  padding: 3,
  borderRadius: 9,
  flexWrap: "wrap",
};

export function WebTrend({
  initialSeries,
  initialPrevTotal,
  initialMetric = "pv",
  initialRange = "30",
  fetchSeries,
}: {
  initialSeries: SeriesPoint[];
  /** 上一等长周期的合计，用于真实环比 */
  initialPrevTotal: number;
  initialMetric?: MetricKey;
  initialRange?: RangeKey;
  fetchSeries: (metric: string, range: string) => Promise<SeriesPoint[]>;
}) {
  const [metricKey, setMetricKey] = useState<MetricKey>(initialMetric);
  const [rangeKey, setRangeKey] = useState<RangeKey>(initialRange);
  const [series, setSeries] = useState<SeriesPoint[]>(initialSeries);
  const [prevTotal, setPrevTotal] = useState<number | null>(initialPrevTotal);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const metric = METRICS.find((m) => m.key === metricKey)!;

  const load = (m: MetricKey, r: RangeKey) => {
    setMetricKey(m);
    setRangeKey(r);
    setHover(null);
    startTransition(async () => {
      const days = Number(r);
      const [current, previous] = await Promise.all([
        fetchSeries(m, r),
        // 上一等长周期：取 2×天数，再截掉后半段
        fetchSeries(m, String(days * 2 <= 90 ? days * 2 : 90)),
      ]);
      setSeries(current);
      const prev = previous.slice(0, Math.max(0, previous.length - current.length));
      setPrevTotal(prev.length ? prev.reduce((s, p) => s + p.value, 0) : null);
    });
  };

  const vals = series.map((p) => p.value);
  const total = vals.reduce((s, v) => s + v, 0);
  const delta = prevTotal && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const chart = buildChart(vals);

  const header = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>官网访问趋势</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.5px" }}>
            {fmtNumber(total)}{" "}
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{metric.unit}</span>
          </span>
          {delta === null ? (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>上一周期无数据</span>
          ) : (
            <>
              <span
                style={{ fontSize: 12, fontWeight: 600, color: delta >= 0 ? "#16894f" : "#c0392b" }}
              >
                较上一周期 {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)}%
              </span>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                上一周期 {fmtNumber(prevTotal ?? 0)}
              </span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={wrap}>
          {METRICS.map((m) => (
            <button key={m.key} style={tabStyle(metricKey === m.key)} onClick={() => load(m.key, rangeKey)}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={wrap}>
          {RANGES.map((r) => (
            <button key={r.key} style={tabStyle(rangeKey === r.key)} onClick={() => load(metricKey, r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (!chart || total === 0) {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {header}
        <div
          style={{
            height: 230,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "var(--muted)",
            fontSize: 12.5,
          }}
        >
          <span style={{ fontWeight: 600, color: "#5b6470" }}>该区间内没有埋点数据</span>
          <span>把官网事件 POST 到 /api/analytics/collect 后，这里会显示真实曲线。</span>
        </div>
      </div>
    );
  }

  const n = vals.length;
  const gridLines = [0, 1, 2, 3].map((k) => ({
    y: (chart.pt + ((chart.H - chart.pt - chart.pb) * k) / 3).toFixed(1),
  }));
  const tickCount = Math.min(6, n);
  const axisTicks: { x: string; text: string }[] = [];
  for (let k = 0; k < tickCount; k++) {
    const i = tickCount === 1 ? 0 : Math.round((k * (n - 1)) / (tickCount - 1));
    axisTicks.push({ x: chart.X(i).toFixed(1), text: series[i]?.label ?? "" });
  }
  const seg = chart.innerW / Math.max(1, n - 1);
  const hoverCols = vals.map((_, i) => ({
    x: (chart.X(i) - seg / 2).toFixed(1),
    w: seg.toFixed(1),
    idx: i,
  }));

  let hov: {
    x: string;
    y: string;
    boxX: string;
    textX: string;
    boxW: string;
    date: string;
    val: string;
  } | null = null;
  if (hover != null && hover >= 0 && hover < n) {
    const x = chart.X(hover);
    const y = chart.Y(vals[hover]);
    const valText = `${fmtNumber(vals[hover])} ${metric.unit}`;
    const boxW = Math.max(84, valText.length * 8.5 + 20);
    const boxX = Math.max(6, Math.min(chart.W - boxW - 6, x - boxW / 2));
    hov = {
      x: x.toFixed(1),
      y: y.toFixed(1),
      boxX: boxX.toFixed(1),
      boxW: boxW.toFixed(1),
      textX: (boxX + boxW / 2).toFixed(1),
      date: series[hover]?.label ?? "",
      val: valText,
    };
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {header}
      <div
        style={{ position: "relative", marginTop: 16, opacity: pending ? 0.55 : 1, transition: "opacity .15s" }}
      >
        <svg
          viewBox="0 0 800 280"
          width="100%"
          height={264}
          preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="webArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {gridLines.map((g, i) => (
            <line
              key={i}
              x1="8"
              y1={g.y}
              x2="792"
              y2={g.y}
              stroke="var(--line)"
              strokeWidth="1"
              strokeDasharray="3 5"
            />
          ))}
          <path d={chart.area} fill="url(#webArea)" />
          <path
            d={chart.line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {axisTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y="274"
              fill="#9a9f9a"
              fontSize="11"
              fontFamily="Manrope"
              textAnchor="middle"
            >
              {t.text}
            </text>
          ))}
          {hov && (
            <>
              <line
                x1={hov.x}
                y1="22"
                x2={hov.x}
                y2="250"
                stroke="var(--accent)"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.5"
              />
              <circle cx={hov.x} cy={hov.y} r="5.5" fill="#fff" stroke="var(--accent)" strokeWidth="2.5" />
              <rect x={hov.boxX} y="2" width={hov.boxW} height="40" rx="8" fill="#20251f" />
              <text x={hov.textX} y="18" fill="#c6cabf" fontSize="10.5" fontFamily="Manrope" textAnchor="middle">
                {hov.date}
              </text>
              <text
                x={hov.textX}
                y="34"
                fill="#fff"
                fontSize="13"
                fontWeight="700"
                fontFamily="Manrope"
                textAnchor="middle"
              >
                {hov.val}
              </text>
            </>
          )}
          {hoverCols.map((c) => (
            <rect
              key={c.idx}
              x={c.x}
              y="20"
              width={c.w}
              height="230"
              fill="transparent"
              onMouseEnter={() => setHover(c.idx)}
              style={{ cursor: "crosshair" }}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

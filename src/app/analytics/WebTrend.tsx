"use client";

import { useState } from "react";
import { buildChart, genSeries, labelFor } from "@/lib/charts";

const METRICS = [
  { key: "pv", label: "浏览量", unit: "次", delta: 18.6 },
  { key: "uv", label: "访客数", unit: "人", delta: 11.2 },
  { key: "clicks", label: "产品点击", unit: "次", delta: 14.5 },
  { key: "inquiry", label: "咨询数", unit: "条", delta: 9.2 },
  { key: "weborder", label: "下单数", unit: "单", delta: 22.1 },
];
const RANGES = [
  { key: "today", label: "今日", n: 24 },
  { key: "7", label: "7天", n: 7 },
  { key: "30", label: "30天", n: 30 },
  { key: "90", label: "90天", n: 90 },
];

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
const wrap: React.CSSProperties = { display: "flex", gap: 2, background: "var(--bg)", padding: 3, borderRadius: 9, flexWrap: "wrap" };

export function WebTrend() {
  const [metricKey, setMetricKey] = useState("pv");
  const [rangeKey, setRangeKey] = useState("30");
  const [hover, setHover] = useState<number | null>(null);

  const metric = METRICS.find((m) => m.key === metricKey)!;
  const range = RANGES.find((r) => r.key === rangeKey)!;
  const n = range.n;
  const vals = genSeries(metricKey, n);
  const chart = buildChart(vals);

  const total = vals.reduce((s, v) => s + v, 0);
  const prevTotal = Math.round(total / (1 + metric.delta / 100));
  const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

  const gridLines = [0, 1, 2, 3].map((k) => ({ y: (chart.pt + ((chart.H - chart.pt - chart.pb) * k) / 3).toFixed(1) }));
  const tickCount = Math.min(6, n);
  const axisTicks: { x: string; text: string }[] = [];
  for (let k = 0; k < tickCount; k++) {
    const i = Math.round((k * (n - 1)) / (tickCount - 1));
    axisTicks.push({ x: chart.X(i).toFixed(1), text: labelFor(rangeKey, n, i) });
  }
  const seg = chart.innerW / Math.max(1, n - 1);
  const hoverCols = vals.map((v, i) => ({ x: (chart.X(i) - seg / 2).toFixed(1), w: seg.toFixed(1), idx: i }));

  let hov: { x: string; y: string; boxX: string; textX: string; boxW: string; date: string; val: string } | null = null;
  if (hover != null && hover >= 0 && hover < n) {
    const x = chart.X(hover);
    const y = chart.Y(vals[hover]);
    const valText = `${fmt(vals[hover])} ${metric.unit}`;
    const boxW = Math.max(84, valText.length * 8.5 + 20);
    const boxX = Math.max(6, Math.min(chart.W - boxW - 6, x - boxW / 2));
    hov = { x: x.toFixed(1), y: y.toFixed(1), boxX: boxX.toFixed(1), boxW: boxW.toFixed(1), textX: (boxX + boxW / 2).toFixed(1), date: labelFor(rangeKey, n, hover), val: valText };
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>官网访问趋势</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.5px" }}>
              {fmt(total)} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{metric.unit}</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#16894f" }}>较上一周期 +{metric.delta}%</span>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>上一周期 {fmt(prevTotal)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={wrap}>
            {METRICS.map((m) => (
              <button key={m.key} style={tabStyle(metricKey === m.key)} onClick={() => { setMetricKey(m.key); setHover(null); }}>
                {m.label}
              </button>
            ))}
          </div>
          <div style={wrap}>
            {RANGES.map((r) => (
              <button key={r.key} style={tabStyle(rangeKey === r.key)} onClick={() => { setRangeKey(r.key); setHover(null); }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ position: "relative", marginTop: 16 }}>
        <svg viewBox="0 0 800 280" width="100%" height={264} preserveAspectRatio="none" onMouseLeave={() => setHover(null)} style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id="webArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {gridLines.map((g, i) => (
            <line key={i} x1="8" y1={g.y} x2="792" y2={g.y} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 5" />
          ))}
          <path d={chart.area} fill="url(#webArea)" />
          <path d={chart.line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {axisTicks.map((t, i) => (
            <text key={i} x={t.x} y="274" fill="#9a9f9a" fontSize="11" fontFamily="Manrope" textAnchor="middle">
              {t.text}
            </text>
          ))}
          {hov && (
            <>
              <line x1={hov.x} y1="22" x2={hov.x} y2="250" stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={hov.x} cy={hov.y} r="5.5" fill="#fff" stroke="var(--accent)" strokeWidth="2.5" />
              <rect x={hov.boxX} y="2" width={hov.boxW} height="40" rx="8" fill="#20251f" />
              <text x={hov.textX} y="18" fill="#c6cabf" fontSize="10.5" fontFamily="Manrope" textAnchor="middle">{hov.date}</text>
              <text x={hov.textX} y="34" fill="#fff" fontSize="13" fontWeight="700" fontFamily="Manrope" textAnchor="middle">{hov.val}</text>
            </>
          )}
          {hoverCols.map((c) => (
            <rect key={c.idx} x={c.x} y="20" width={c.w} height="230" fill="transparent" onMouseEnter={() => setHover(c.idx)} style={{ cursor: "crosshair" }} />
          ))}
        </svg>
      </div>
    </div>
  );
}

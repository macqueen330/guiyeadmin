"use client";

import { useState } from "react";
import {
  buildChart,
  fmtVal,
  genSeries,
  labelFor,
  type Metric,
  type Range,
} from "@/lib/charts";

const METRIC_NAME: Record<Metric, string> = {
  sales: "销售额趋势",
  orders: "订单量趋势",
  received: "实收金额趋势",
};
const RANGE_NAME: Record<Range, string> = {
  today: "今日（按小时）",
  "7": "近 7 天",
  "30": "近 30 天",
};

function tabStyle(on: boolean): React.CSSProperties {
  return {
    padding: "6px 13px",
    borderRadius: 7,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontFamily: "inherit",
    transition: "all .14s",
    background: on ? "var(--card)" : "transparent",
    color: on ? "var(--ink)" : "var(--muted)",
    boxShadow: on ? "0 1px 2px rgba(0,0,0,.07)" : "none",
  };
}

const toggleWrap: React.CSSProperties = {
  display: "flex",
  gap: 2,
  background: "var(--bg)",
  padding: 3,
  borderRadius: 9,
};

export function TrendChart({
  defaultMetric = "sales",
  defaultRange = "30",
}: {
  defaultMetric?: Metric;
  defaultRange?: Range;
}) {
  const [metric, setMetric] = useState<Metric>(defaultMetric);
  const [range, setRange] = useState<Range>(defaultRange);
  const [hover, setHover] = useState<number | null>(null);

  const n = range === "today" ? 24 : parseInt(range, 10);
  const vals = genSeries(metric, n);
  const chart = buildChart(vals);

  const gridLines = [0, 1, 2, 3].map((k) => ({
    y: (chart.pt + ((chart.H - chart.pt - chart.pb) * k) / 3).toFixed(1),
  }));

  const tickCount = Math.min(6, n);
  const axisTicks: { x: string; text: string }[] = [];
  for (let k = 0; k < tickCount; k++) {
    const i = Math.round((k * (n - 1)) / (tickCount - 1));
    axisTicks.push({ x: chart.X(i).toFixed(1), text: labelFor(range, n, i) });
  }

  const seg = chart.innerW / Math.max(1, n - 1);
  const hoverCols = vals.map((v, i) => ({
    x: (chart.X(i) - seg / 2).toFixed(1),
    w: seg.toFixed(1),
    idx: i,
  }));

  let showHover = false;
  let hov = { x: "0", y: "0", boxX: "0", boxW: "0", textX: "0", dateText: "", valText: "" };
  if (hover != null && hover >= 0 && hover < n) {
    const x = chart.X(hover);
    const y = chart.Y(vals[hover]);
    const valText = fmtVal(metric, vals[hover]);
    const boxW = Math.max(80, valText.length * 8.5 + 20);
    const boxX = Math.max(6, Math.min(chart.W - boxW - 6, x - boxW / 2));
    showHover = true;
    hov = {
      x: x.toFixed(1),
      y: y.toFixed(1),
      boxX: boxX.toFixed(1),
      boxW: boxW.toFixed(1),
      textX: (boxX + boxW / 2).toFixed(1),
      dateText: labelFor(range, n, hover),
      valText,
    };
  }

  const title = METRIC_NAME[metric] + " · " + RANGE_NAME[range];

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
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            数据截至今日 18:00 · 含全部渠道
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={toggleWrap}>
            <button style={tabStyle(metric === "sales")} onClick={() => { setMetric("sales"); setHover(null); }}>
              销售额
            </button>
            <button style={tabStyle(metric === "orders")} onClick={() => { setMetric("orders"); setHover(null); }}>
              订单数
            </button>
            <button style={tabStyle(metric === "received")} onClick={() => { setMetric("received"); setHover(null); }}>
              实收
            </button>
          </div>
          <div style={toggleWrap}>
            <button style={tabStyle(range === "today")} onClick={() => { setRange("today"); setHover(null); }}>
              今日
            </button>
            <button style={tabStyle(range === "7")} onClick={() => { setRange("7"); setHover(null); }}>
              7天
            </button>
            <button style={tabStyle(range === "30")} onClick={() => { setRange("30"); setHover(null); }}>
              30天
            </button>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", marginTop: 16 }}>
        <svg
          viewBox="0 0 800 280"
          width="100%"
          height={276}
          preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {gridLines.map((g, i) => (
            <line key={i} x1="8" y1={g.y} x2="792" y2={g.y} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 5" />
          ))}
          <path d={chart.area} fill="url(#areaFill)" />
          <path d={chart.line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {axisTicks.map((t, i) => (
            <text key={i} x={t.x} y="274" fill="#9a9f9a" fontSize="11" fontFamily="Manrope" textAnchor="middle">
              {t.text}
            </text>
          ))}
          {showHover && (
            <>
              <line x1={hov.x} y1="22" x2={hov.x} y2="250" stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={hov.x} cy={hov.y} r="5.5" fill="#fff" stroke="var(--accent)" strokeWidth="2.5" />
              <rect x={hov.boxX} y="2" width={hov.boxW} height="40" rx="8" fill="#20251f" />
              <text x={hov.textX} y="18" fill="#c6cabf" fontSize="10.5" fontFamily="Manrope" textAnchor="middle">
                {hov.dateText}
              </text>
              <text x={hov.textX} y="34" fill="#fff" fontSize="13" fontWeight="700" fontFamily="Manrope" textAnchor="middle">
                {hov.valText}
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

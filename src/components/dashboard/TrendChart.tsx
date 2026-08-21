"use client";

import { useState, useTransition } from "react";
import { buildChart, fmtVal, type Metric, type Range } from "@/lib/charts";
import type { SeriesPoint } from "@/lib/types";

// 趋势图。
//
// 原实现调用 charts.ts:genSeries() —— 线性同余伪随机数，还带 0.46 的「上升偏置」
// 保证曲线总体向上；切换「今日/7天/30天」不发任何请求，只是重新造数。
//
// 现在：初始序列由服务端算好传进来，切换指标/区间时调用 fetchSeries（Server Action）
// 重新查询真实订单数据。加载中显示 loading，没有数据显示空态。

const METRIC_NAME: Record<Metric, string> = {
  sales: "销售额趋势",
  orders: "订单量趋势",
  received: "实收金额趋势",
  refunds: "退款金额趋势",
};
const RANGE_NAME: Record<Range, string> = {
  today: "今日（按小时）",
  "7": "近 7 天",
  "30": "近 30 天",
  "90": "近 90 天",
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
  initialSeries,
  initialMetric = "sales",
  initialRange = "7",
  fetchSeries,
  metrics = ["sales", "orders", "received"],
  title,
}: {
  initialSeries: SeriesPoint[];
  initialMetric?: Metric;
  initialRange?: Range;
  /** Server Action：按指标 + 区间重新查询真实序列 */
  fetchSeries: (metric: Metric, range: Range) => Promise<SeriesPoint[]>;
  metrics?: Metric[];
  title?: string;
}) {
  const [metric, setMetric] = useState<Metric>(initialMetric);
  const [range, setRange] = useState<Range>(initialRange);
  const [series, setSeries] = useState<SeriesPoint[]>(initialSeries);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // 服务端重新渲染（例如订单写入后 revalidate）时同步最新初始数据。
  // 在渲染期比对，而不是在 effect 里 setState —— 后者会先画一帧旧数据再重画。
  const [syncedFrom, setSyncedFrom] = useState(initialSeries);
  if (initialSeries !== syncedFrom) {
    setSyncedFrom(initialSeries);
    if (metric === initialMetric && range === initialRange) setSeries(initialSeries);
  }

  const load = (nextMetric: Metric, nextRange: Range) => {
    setMetric(nextMetric);
    setRange(nextRange);
    setHover(null);
    startTransition(async () => {
      setSeries(await fetchSeries(nextMetric, nextRange));
    });
  };

  const vals = series.map((p) => p.value);
  const chart = buildChart(vals);
  const heading = (title ?? METRIC_NAME[metric]) + " · " + RANGE_NAME[range];

  const controls = (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <div style={toggleWrap}>
        {metrics.map((m) => (
          <button key={m} style={tabStyle(metric === m)} onClick={() => load(m, range)}>
            {METRIC_NAME[m].replace("趋势", "")}
          </button>
        ))}
      </div>
      <div style={toggleWrap}>
        {(["today", "7", "30", "90"] as Range[]).map((r) => (
          <button key={r} style={tabStyle(range === r)} onClick={() => load(metric, r)}>
            {r === "today" ? "今日" : `${r}天`}
          </button>
        ))}
      </div>
    </div>
  );

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
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{heading}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {pending ? "正在查询…" : `按订单创建时间聚合 · 共 ${series.length} 个数据点`}
        </span>
      </div>
      {controls}
    </div>
  );

  if (!chart || vals.every((v) => v === 0)) {
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
            height: 240,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "var(--muted)",
            fontSize: 12.5,
          }}
        >
          <span style={{ fontWeight: 600, color: "#5b6470" }}>该区间内没有数据</span>
          <span>产生第一笔订单后，这里会显示真实的日趋势。</span>
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
      dateText: series[hover]?.label ?? "",
      valText,
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

      <div style={{ position: "relative", marginTop: 16, opacity: pending ? 0.55 : 1, transition: "opacity .15s" }}>
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
          <path d={chart.area} fill="url(#areaFill)" />
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
          {showHover && (
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
                {hov.dateText}
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

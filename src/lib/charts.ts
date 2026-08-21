// Pure chart geometry helpers.
//
// genSeries() 已删除：趋势曲线曾经是线性同余伪随机数当场生成的（还带 0.46 的
// 「上升偏置」），切换时间区间不发任何请求。现在所有序列都来自
// src/lib/data/metrics.ts / web.ts 的真实聚合，本文件只负责把数值变成 SVG 路径。

import type { SeriesPoint } from "./types";

export type Metric = "sales" | "orders" | "received" | "refunds";
export type Range = "today" | "7" | "30" | "90";

export const RANGE_DAYS: Record<Range, number> = { today: 1, "7": 7, "30": 30, "90": 90 };

export const METRIC_LABEL: Record<Metric, string> = {
  sales: "销售额",
  orders: "订单数",
  received: "实收",
  refunds: "退款",
};

export function fmtVal(metric: Metric | string, v: number): string {
  if (metric === "orders") return Math.round(v).toLocaleString("zh-CN") + " 单";
  return "¥" + Math.round(v).toLocaleString("zh-CN");
}

export interface ChartGeom {
  line: string;
  area: string;
  pts: [number, number][];
  X: (i: number) => number;
  Y: (v: number) => number;
  W: number;
  H: number;
  pt: number;
  pb: number;
  innerW: number;
}

/**
 * Build the SVG path for a value series. Returns null for an empty series so the
 * caller can render an explicit empty state — a quiet day with zero orders used
 * to produce NaN/Infinity coordinates here.
 */
export function buildChart(vals: number[]): ChartGeom | null {
  if (!vals || vals.length === 0) return null;

  const W = 800,
    H = 280,
    pl = 10,
    pr = 10,
    pt = 24,
    pb = 34;
  const innerW = W - pl - pr,
    innerH = H - pt - pb;
  const max = Math.max(...vals),
    min = Math.min(...vals);
  // 全 0 或全相同的序列：画一条居中的水平线，而不是除以 0。
  const span = max - min || Math.abs(max) || 1;
  const X = (i: number) =>
    vals.length === 1 ? pl + innerW / 2 : pl + innerW * (i / (vals.length - 1));
  const Y = (v: number) => pt + innerH * (1 - (v - min) / span);
  const pts: [number, number][] = vals.map((v, i) => [X(i), Y(v)]);

  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[i + 1],
      cx = (x0 + x1) / 2;
    line += ` C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(
      1,
    )}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  const area =
    line +
    ` L ${pts[pts.length - 1][0].toFixed(1)} ${H - pb} L ${pts[0][0].toFixed(1)} ${H - pb} Z`;
  return { line, area, pts, X, Y, W, H, pt, pb, innerW };
}

/** Sparkline path. Returns "" for an empty or single-point series. */
export function buildSpark(vals: number[]): string {
  if (!vals || vals.length < 2) return "";
  const W = 74,
    H = 34,
    p = 4;
  const max = Math.max(...vals),
    min = Math.min(...vals),
    span = max - min || Math.abs(max) || 1;
  let d = "";
  vals.forEach((v, i) => {
    const x = p + (W - 2 * p) * (i / (vals.length - 1));
    const y = p + (H - 2 * p) * (1 - (v - min) / span);
    d += (i === 0 ? "M " : " L ") + x.toFixed(1) + " " + y.toFixed(1);
  });
  return d;
}

/** Axis labels come from the series itself — no more frozen `new Date(2026,5,20)`. */
export function labelsFrom(points: SeriesPoint[]): string[] {
  return points.map((p) => p.label);
}

/**
 * Build SVG arc dash segments for a donut. Slices carry RAW values (counts or
 * amounts); percentages are computed here against the actual sum, so a real
 * grouped query no longer has to add up to exactly 100.
 */
export function buildDonut(
  slices: { val: number; color: string }[],
  r = 58,
): { color: string; dasharray: string; dashoffset: string; pct: number }[] {
  const C = 2 * Math.PI * r;
  const sum = slices.reduce((s, x) => s + (x.val > 0 ? x.val : 0), 0);
  if (sum <= 0) return [];
  let acc = 0;
  return slices.map((c) => {
    const pct = (Math.max(0, c.val) / sum) * 100;
    const len = (pct / 100) * C;
    const seg = {
      color: c.color,
      dasharray: `${len.toFixed(2)} ${(C - len).toFixed(2)}`,
      dashoffset: (-acc).toFixed(2),
      pct,
    };
    acc += len;
    return seg;
  });
}

/** Percentage of the total for each slice (for legends). */
export function slicePercents(slices: { val: number }[]): number[] {
  const sum = slices.reduce((s, x) => s + (x.val > 0 ? x.val : 0), 0);
  if (sum <= 0) return slices.map(() => 0);
  return slices.map((s) => (Math.max(0, s.val) / sum) * 100);
}

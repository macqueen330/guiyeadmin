// Pure chart geometry helpers, ported verbatim from Guiye数据总览.dc.html so the
// trend chart, sparklines and donut render identically to the original design.

export type Metric = "sales" | "orders" | "received";
export type Range = "today" | "7" | "30";

export function genSeries(metric: Metric | string, n: number): number[] {
  const seedMap: Record<string, number> = {
    sales: 7,
    orders: 31,
    received: 53,
    pv: 13,
    uv: 17,
    clicks: 23,
    inquiry: 29,
    weborder: 37,
  };
  let s = (seedMap[metric] || 11) * 1000 + n;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const baseMap: Record<string, [number, number]> = {
    sales: [22000, 52000],
    orders: [70, 210],
    received: [20000, 49000],
    pv: [620, 1420],
    uv: [280, 720],
    clicks: [180, 440],
    inquiry: [2, 12],
    weborder: [6, 26],
  };
  const [lo, hi] = baseMap[metric] || [100, 500];
  const out: number[] = [];
  let v = (lo + hi) / 2;
  for (let i = 0; i < n; i++) {
    v += (rnd() - 0.46) * (hi - lo) * 0.16;
    v = Math.max(lo * 0.7, Math.min(hi * 1.08, v));
    out.push(Math.round(v));
  }
  return out;
}

export function fmtVal(metric: Metric | string, v: number): string {
  if (metric === "orders") return Math.round(v).toLocaleString("en-US") + " 单";
  return "¥" + Math.round(v).toLocaleString("en-US");
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

export function buildChart(vals: number[]): ChartGeom {
  const W = 800,
    H = 280,
    pl = 10,
    pr = 10,
    pt = 24,
    pb = 34;
  const innerW = W - pl - pr,
    innerH = H - pt - pb;
  const max = Math.max(...vals),
    min = Math.min(...vals),
    span = max - min || 1;
  const X = (i: number) => pl + innerW * (i / (vals.length - 1));
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
    ` L ${pts[pts.length - 1][0].toFixed(1)} ${H - pb} L ${pts[0][0].toFixed(
      1,
    )} ${H - pb} Z`;
  return { line, area, pts, X, Y, W, H, pt, pb, innerW };
}

export function buildSpark(vals: number[]): string {
  const W = 74,
    H = 34,
    p = 4;
  const max = Math.max(...vals),
    min = Math.min(...vals),
    span = max - min || 1;
  let d = "";
  vals.forEach((v, i) => {
    const x = p + (W - 2 * p) * (i / (vals.length - 1));
    const y = p + (H - 2 * p) * (1 - (v - min) / span);
    d += (i === 0 ? "M " : " L ") + x.toFixed(1) + " " + y.toFixed(1);
  });
  return d;
}

export function labelFor(range: Range | string, n: number, i: number): string {
  if (range === "today") return i + ":00";
  const d = new Date(2026, 5, 20);
  d.setDate(d.getDate() - (n - 1 - i));
  return d.getMonth() + 1 + "/" + d.getDate();
}

// Build SVG arc dash segments for the channel donut.
export function buildDonut(
  slices: { val: number; color: string }[],
  r = 58,
): { color: string; dasharray: string; dashoffset: string }[] {
  const C = 2 * Math.PI * r;
  let acc = 0;
  return slices.map((c) => {
    const len = (c.val / 100) * C;
    const seg = {
      color: c.color,
      dasharray: `${len.toFixed(2)} ${(C - len).toFixed(2)}`,
      dashoffset: (-acc).toFixed(2),
    };
    acc += len;
    return seg;
  });
}

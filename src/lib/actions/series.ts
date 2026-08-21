"use server";

import { getCurrentAdmin } from "@/lib/auth/context";
import { getTrendSeries, type TrendMetric, type TrendRange } from "@/lib/data/metrics";
import { getWebTrend } from "@/lib/data/web";
import { RANGE_DAYS, type Metric, type Range } from "@/lib/charts";
import type { SeriesPoint } from "@/lib/types";

// 趋势图切换区间时调用的取数入口。
// 原来切换「今日 / 7天 / 30天」不发任何请求，只是重新跑一遍伪随机数生成器。

const ALLOWED_METRICS: TrendMetric[] = ["sales", "orders", "received", "refunds"];
const ALLOWED_RANGES: TrendRange[] = ["today", "7", "30", "90"];

export async function fetchTrendSeriesAction(
  metric: Metric,
  range: Range,
): Promise<SeriesPoint[]> {
  const me = await getCurrentAdmin();
  if (!me) return [];
  if (!ALLOWED_METRICS.includes(metric as TrendMetric)) return [];
  if (!ALLOWED_RANGES.includes(range as TrendRange)) return [];
  return getTrendSeries(metric as TrendMetric, range as TrendRange);
}

const WEB_METRICS = ["pv", "uv", "product_clicks", "inquiries", "paid"] as const;
type WebMetric = (typeof WEB_METRICS)[number];

export async function fetchWebSeriesAction(
  metric: string,
  range: string,
): Promise<SeriesPoint[]> {
  const me = await getCurrentAdmin();
  if (!me) return [];
  if (!WEB_METRICS.includes(metric as WebMetric)) return [];
  // range 可以是 "7" / "30" / "90"，也可以是任意天数（官网趋势要取 2 倍区间做环比）。
  const days = RANGE_DAYS[range as Range] ?? Number(range);
  if (!Number.isFinite(days) || days < 1 || days > 365) return [];
  return getWebTrend(metric as WebMetric, Math.round(days));
}

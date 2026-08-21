import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { Pipeline } from "@/components/dashboard/Pipeline";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { Alerts } from "@/components/dashboard/Alerts";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { WebViews } from "@/components/dashboard/WebViews";
import { getRecentOrders } from "@/lib/data/queries";
import {
  getAlerts,
  getPipeline,
  getRecentActivity,
  getTodayStats,
  getTrendSeries,
} from "@/lib/data/metrics";
import { getWebViews } from "@/lib/data/web";
import { loadSettings } from "@/lib/data/settings";
import { fetchTrendSeriesAction } from "@/lib/actions/series";
import { fmtCurrency, fmtNumber } from "@/lib/tokens";
import type { Range } from "@/lib/charts";
import type { IconName } from "@/components/ui/Icon";

// 每次请求实时聚合。数据层用到 cookies()，本来就无法静态化。
export const dynamic = "force-dynamic";

// 首页是「任务入口」，不是纯数据展示页：今天要处理什么、待办、快捷操作。
//
// 这一整屏原来是 6 个字符串常量 + 一个伪随机趋势图 + 5 条伪造的操作流水。
// 现在每个数字都来自 src/lib/data/metrics.ts 的真实聚合，并且互相一致
// （首页「待发货」= 侧边栏徽标 = 业务流程条上的同名环节）。

const TONE_STYLE: Record<
  string,
  { icon: IconName; color: string; bg: string; alertColor: string }
> = {
  accent: { icon: "dollar", color: "var(--accent)", bg: "var(--accent-soft)", alertColor: "var(--accent)" },
  clay: { icon: "bag", color: "#c2703d", bg: "#fff5ec", alertColor: "#c2703d" },
  amber: { icon: "truck", color: "#b45309", bg: "#fff7ec", alertColor: "#b45309" },
  red: { icon: "alert", color: "#c0392b", bg: "#fdf0ef", alertColor: "#c0392b" },
  blue: { icon: "barChart", color: "#2b6cb0", bg: "#eef4ff", alertColor: "#2b6cb0" },
};

export default async function DashboardPage() {
  const settings = await loadSettings();
  const defaultRange = String(settings.analytics.defaultRangeDays) as Range;

  const [todayStats, alerts, pipeline, activity, webViews, orders, series] = await Promise.all([
    getTodayStats(),
    getAlerts(),
    getPipeline(),
    getRecentActivity(5),
    getWebViews(),
    getRecentOrders(settings.orders.recentLimit),
    getTrendSeries("sales", defaultRange),
  ]);

  const stats: Stat[] = todayStats.map((s) => {
    const tone = TONE_STYLE[s.tone] ?? TONE_STYLE.accent;
    return {
      label: s.label,
      value: s.format === "currency" ? fmtCurrency(s.value) : fmtNumber(s.value),
      sub: s.sub,
      icon: (s.icon as IconName) ?? tone.icon,
      iconColor: tone.color,
      iconBg: tone.bg,
      // 颜色由阈值判断决定，不再对每张卡写死一个红色。
      valueColor: s.alert ? tone.alertColor : undefined,
      href: s.href,
    };
  });

  return (
    <>
      <StatStrip
        stats={stats}
        columns={6}
        empty="数据库中还没有业务数据。导入 supabase/seed_samples.sql 可以先看到示例，或直接开始录入真实订单。"
      />

      <div style={{ marginBottom: 16 }}>
        <WebViews data={webViews} compact />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <Alerts alerts={alerts} />
        <QuickActions />
      </div>

      <Pipeline stages={pipeline} />

      <div style={{ display: "grid", gridTemplateColumns: "1.85fr 1fr", gap: 16, marginTop: 16 }}>
        <TrendChart
          initialSeries={series}
          initialMetric="sales"
          initialRange={defaultRange}
          fetchSeries={fetchTrendSeriesAction}
        />
        <RecentActivity rows={activity} />
      </div>

      <RecentOrders orders={orders} />
    </>
  );
}

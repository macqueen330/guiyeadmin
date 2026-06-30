import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { Pipeline } from "@/components/dashboard/Pipeline";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { Alerts } from "@/components/dashboard/Alerts";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { getRecentOrders } from "@/lib/data/queries";

// Dynamic so the search-param-aware sidebar renders fully on the server here too
// (every other route is already dynamic via its `view` param).
export const dynamic = "force-dynamic";

// 首页是"任务入口"，不是纯数据展示页：今日要处理什么、待办、快捷操作。
const todayStats: Stat[] = [
  { label: "今日销售额", value: "¥86,400", sub: "较昨日 +6.2%", icon: "dollar", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
  { label: "今日订单", value: "142", sub: "已支付 128", icon: "bag", iconColor: "#c2703d", iconBg: "#fff5ec" },
  { label: "待发货", value: "128", sub: "含 8 单超时", icon: "truck", iconColor: "#b45309", iconBg: "#fff7ec", valueColor: "#b45309" },
  { label: "待跟进客户", value: "3", sub: "超 7 天未跟进", icon: "clock", iconColor: "#b45309", iconBg: "#fff7ec", valueColor: "#b45309" },
  { label: "库存预警", value: "4", sub: "低于安全线 SKU", icon: "alert", iconColor: "#c0392b", iconBg: "#fdf0ef", valueColor: "#c0392b" },
  { label: "待回款", value: "¥127,600", sub: "应收逾期 2 笔", icon: "cash", iconColor: "#c0392b", iconBg: "#fdf0ef", valueColor: "#c0392b" },
];

export default async function DashboardPage() {
  const orders = await getRecentOrders(6);

  return (
    <>
      <StatStrip stats={todayStats} columns={6} />

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <Alerts />
        <QuickActions />
      </div>

      <Pipeline />

      <div style={{ display: "grid", gridTemplateColumns: "1.85fr 1fr", gap: 16, marginTop: 16 }}>
        <TrendChart defaultRange="7" />
        <RecentActivity />
      </div>

      <RecentOrders orders={orders} />
    </>
  );
}

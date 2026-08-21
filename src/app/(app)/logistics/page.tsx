import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { getCarriers, getOrders, getShipments, getWarehouses } from "@/lib/data/queries";
import { businessDayStart, getWarehouseStock, hoursAgo } from "@/lib/data/metrics";
import { loadSettings } from "@/lib/data/settings";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { requireModule } from "@/lib/auth/context";
import { LogisticsView, type PendingOrder } from "./LogisticsView";

export const dynamic = "force-dynamic";

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  await requireModule("logistics");

  const { view, q } = await searchParams;
  const item = navItemByKey("logistics");
  const active = activeSubView(item, view)?.key ?? "pending";

  const [shipments, orders, warehouses, warehouseStock, carriers, settings] = await Promise.all([
    getShipments(),
    getOrders(),
    getWarehouses(),
    getWarehouseStock(),
    getCarriers(),
    loadSettings(),
  ]);

  // 待发货来自订单的履约状态（原来错误地用 shipments.status === "preparing" 统计，
  // 那只是已经建了运单的包裹，真正没发出去的订单根本不在其中）。
  const pendingOrders: PendingOrder[] = orders
    .filter((o) => ["assign", "prep", "wait_ship"].includes(o.fulfill_status))
    .map((o) => ({
      order_no: o.order_no,
      customer_name: o.customer_name,
      destination: [o.province, o.city, o.address].filter(Boolean).join(" ") || o.country,
      fulfill_status: o.fulfill_status,
      created_at: o.created_at,
    }));

  const inTransit = shipments.filter((s) => ["in_transit", "customs"].includes(s.status)).length;
  const exceptions = shipments.filter((s) => s.status === "exception").length;

  // 「近 7 日已送达」原来没有任何日期过滤。
  const since = businessDayStart(settings.analytics.tzOffsetHours, 6);
  const deliveredRecent = shipments.filter(
    (s) => s.status === "delivered" && s.delivered_at && new Date(s.delivered_at) >= since,
  ).length;

  const overdueCutoff = hoursAgo(settings.orders.overdueShipHours);
  const overdue = pendingOrders.filter((o) => new Date(o.created_at).getTime() < overdueCutoff).length;

  const stats: Stat[] = [
    {
      label: "待发货",
      value: String(pendingOrders.length),
      sub: overdue > 0 ? `含 ${overdue} 单超时` : "已下单待出库",
      icon: "box",
      iconColor: "#b45309",
      iconBg: "#fff7ec",
      valueColor: pendingOrders.length > 0 ? "#b45309" : undefined,
    },
    {
      label: "在途包裹",
      value: String(inTransit),
      sub: "运输 / 清关中",
      icon: "truck",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "异常包裹",
      value: String(exceptions),
      sub: "需人工处理",
      icon: "alert",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: exceptions > 0 ? "#c0392b" : undefined,
      href: "/logistics?view=exception",
    },
    {
      label: "已送达",
      value: String(deliveredRecent),
      sub: "近 7 日",
      icon: "check",
      iconColor: "#16894f",
      iconBg: "#e9f5ef",
      valueColor: "#16894f",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} empty="还没有物流数据" />
      <SubTabs item={item} active={active} />
      <LogisticsView
        shipments={shipments}
        pendingOrders={pendingOrders}
        warehouses={warehouses}
        warehouseStock={warehouseStock}
        carriers={carriers}
        view={active}
        query={q}
      />
    </>
  );
}

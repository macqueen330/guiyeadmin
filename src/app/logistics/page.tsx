import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { getShipments, getWarehouseStock } from "@/lib/data/queries";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { LogisticsView } from "./LogisticsView";

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("logistics");
  const active = activeSubView(item, view)?.key ?? "pending";

  const [shipments, warehouses] = await Promise.all([
    getShipments(),
    getWarehouseStock(),
  ]);

  const pending = shipments.filter((s) => s.status === "preparing").length;
  const inTransit = shipments.filter(
    (s) => s.status === "in_transit" || s.status === "customs",
  ).length;
  const exceptions = shipments.filter((s) => s.status === "exception").length;
  const delivered = shipments.filter((s) => s.status === "delivered").length;

  const stats: Stat[] = [
    {
      label: "待发货",
      value: String(pending),
      sub: "已下单待出库",
      icon: "box",
      iconColor: "#b45309",
      iconBg: "#fff7ec",
      valueColor: "#b45309",
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
      valueColor: "#c0392b",
    },
    {
      label: "已送达",
      value: String(delivered),
      sub: "近 7 日",
      icon: "check",
      iconColor: "#16894f",
      iconBg: "#e9f5ef",
      valueColor: "#16894f",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />
      <LogisticsView shipments={shipments} warehouses={warehouses} view={active} />
    </>
  );
}

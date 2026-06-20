import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { getShipments, getSettlements } from "@/lib/data/queries";
import { fmtCurrency } from "@/lib/tokens";
import { LogisticsView } from "./LogisticsView";

export default async function LogisticsPage() {
  const [shipments, settlements] = await Promise.all([
    getShipments(),
    getSettlements(),
  ]);

  const inTransit = shipments.filter(
    (s) => s.status === "in_transit" || s.status === "customs",
  ).length;
  const exceptions = shipments.filter((s) => s.status === "exception").length;
  const pending = settlements.filter((s) => s.status === "pending").length;
  const overdue = settlements.filter((s) => s.status === "overdue");
  const overdueAmount = overdue.reduce((sum, s) => sum + s.amount, 0);

  const stats: Stat[] = [
    {
      label: "在途包裹",
      value: String(inTransit),
      icon: "truck",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "异常件",
      value: String(exceptions),
      sub: "需人工处理",
      icon: "alert",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: "#c0392b",
    },
    {
      label: "待结算",
      value: String(pending),
      icon: "cash",
      iconColor: "#b45309",
      iconBg: "#fff7ec",
      valueColor: "#b45309",
    },
    {
      label: "逾期应收",
      value: fmtCurrency(overdueAmount),
      sub: `${overdue.length} 笔逾期`,
      icon: "dollar",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: "#c0392b",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <LogisticsView shipments={shipments} settlements={settlements} />
    </>
  );
}

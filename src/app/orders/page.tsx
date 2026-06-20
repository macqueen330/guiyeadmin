import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { getOrders } from "@/lib/data/queries";
import { fmtCurrency } from "@/lib/tokens";
import { OrdersView } from "./OrdersView";

export default async function OrdersPage() {
  const orders = await getOrders();

  const count = (s: string) => orders.filter((o) => o.status === s).length;
  const recentGmv = orders.reduce((sum, o) => sum + o.amount, 0);

  const stats: Stat[] = [
    { label: "本月订单", value: "3,642", sub: `待发货 128 · 列表 ${orders.length} 条`, icon: "bag", iconColor: "#c2703d", iconBg: "#fff5ec" },
    { label: "待审核", value: String(count("review")), sub: "支付 / 风控审核", icon: "clock", iconColor: "#b45309", iconBg: "#fff7ec", valueColor: "#b45309" },
    { label: "待分配 / 备货", value: String(count("assign") + count("prep")), sub: "匹配库存与发货方", icon: "box", iconColor: "#2b6cb0", iconBg: "#eef4ff", valueColor: "#2b6cb0" },
    { label: "近期订单金额", value: fmtCurrency(recentGmv), sub: "GMV 本月 ¥1,284,560", icon: "dollar", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <OrdersView orders={orders} />
    </>
  );
}

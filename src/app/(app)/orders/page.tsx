import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { getOrders, getPayments } from "@/lib/data/queries";
import { fmtCurrency } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { OrdersView } from "./OrdersView";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("orders");
  const active = activeSubView(item, view)?.key ?? "all";

  const [orders, payments] = await Promise.all([getOrders(), getPayments()]);

  // Net-received per order = 实付 − 已退款 (from the payment txn), so partial
  // refunds don't inflate the收款 figures.
  const refundedByOrder: Record<string, number> = {};
  for (const p of payments) refundedByOrder[p.order_no] = (refundedByOrder[p.order_no] ?? 0) + p.refunded;

  const outstanding = orders.reduce((s, o) => s + Math.max(0, o.amount - o.amount_received), 0);
  const unpaidCount = orders.filter((o) => o.amount_received < o.amount).length;
  const pendingShip = orders.filter(
    (o) => o.fulfill_status === "assign" || o.fulfill_status === "prep" || o.fulfill_status === "wait_ship",
  ).length;

  // GMV (下单金额) and实收 (回款) are intentionally different figures.
  const stats: Stat[] = [
    { label: "本月 GMV", value: "¥1,284,560", sub: "有效订单 3,642", icon: "dollar", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
    { label: "本月实收", value: "¥1,196,200", sub: "回款率 93.1%", icon: "cash", iconColor: "#16894f", iconBg: "#e9f5ef", valueColor: "#16894f" },
    { label: "待收款", value: fmtCurrency(outstanding), sub: `含账期 / 待支付 ${unpaidCount} 单`, icon: "clock", iconColor: "#b45309", iconBg: "#fff7ec", valueColor: "#b45309" },
    { label: "待发货", value: String(pendingShip), sub: "待分配 / 备货 / 待发货", icon: "truck", iconColor: "#c2703d", iconBg: "#fff5ec", valueColor: "#c2703d" },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />
      <OrdersView orders={orders} view={active} refundedByOrder={refundedByOrder} />
    </>
  );
}

import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import {
  getCustomers,
  getOrders,
  getPriceTiers,
  getProducts,
  getRefundedByOrder,
  getWarehouses,
} from "@/lib/data/queries";
import { businessMonthStart } from "@/lib/data/metrics";
import { loadSettings } from "@/lib/data/settings";
import { fmtCurrency, fmtPercent, ratio } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { requireModule } from "@/lib/auth/context";
import { OrdersView } from "./OrdersView";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; new?: string; q?: string }>;
}) {
  // 服务端模块级鉴权：侧边栏隐藏链接只是 UX，直接敲 URL 也必须被挡住。
  await requireModule("orders");

  const { view, new: newParam, q } = await searchParams;
  const item = navItemByKey("orders");
  const active = activeSubView(item, view)?.key ?? "all";

  const settings = await loadSettings();
  const [orders, refundedByOrder, products, customers, warehouses, priceTiers] = await Promise.all([
    getOrders(),
    getRefundedByOrder(),
    getProducts(),
    getCustomers(),
    getWarehouses(),
    getPriceTiers(),
  ]);

  // 本月 GMV / 实收：真实的时间窗过滤，不再是两个字符串常量。
  const monthStart = businessMonthStart(settings.analytics.tzOffsetHours, 0);
  const thisMonth = orders.filter((o) => new Date(o.created_at) >= monthStart);
  const paid = thisMonth.filter((o) => ["paid", "partial_refund"].includes(o.pay_status));
  const gmv = paid.reduce((s, o) => s + o.amount, 0);
  const received = paid.reduce((s, o) => s + o.amount_received, 0);
  const collectRate = ratio(received, gmv);

  const outstanding = orders.reduce((s, o) => s + Math.max(0, o.amount - o.amount_received), 0);
  const unpaidCount = orders.filter((o) => o.amount_received < o.amount).length;
  const pendingShip = orders.filter((o) =>
    ["assign", "prep", "wait_ship"].includes(o.fulfill_status),
  ).length;

  const stats: Stat[] = [
    {
      label: "本月 GMV",
      value: fmtCurrency(gmv),
      sub: `有效订单 ${paid.length} 笔`,
      icon: "dollar",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "本月实收",
      value: fmtCurrency(received),
      sub: collectRate === null ? "本月暂无成交" : `回款率 ${fmtPercent(collectRate)}`,
      icon: "cash",
      iconColor: "#16894f",
      iconBg: "#e9f5ef",
      valueColor: "#16894f",
    },
    {
      label: "待收款",
      value: fmtCurrency(outstanding),
      sub: `含账期 / 待支付 ${unpaidCount} 单`,
      icon: "clock",
      iconColor: "#b45309",
      iconBg: "#fff7ec",
      valueColor: outstanding > 0 ? "#b45309" : undefined,
    },
    {
      label: "待发货",
      value: String(pendingShip),
      sub: "待分配 / 备货 / 待发货",
      icon: "truck",
      iconColor: "#c2703d",
      iconBg: "#fff5ec",
      valueColor: pendingShip > 0 ? "#c2703d" : undefined,
      href: "/logistics?view=pending",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} empty="还没有订单数据" />
      <SubTabs item={item} active={active} />
      <OrdersView
        orders={orders}
        view={active}
        refundedByOrder={refundedByOrder}
        openNew={newParam === "1"}
        query={q}
        refs={{
          customers: customers.map((c) => ({
            id: c.id,
            name: c.name,
            country: c.country,
            province: c.province ?? null,
            city: c.city ?? null,
            phone: c.phone,
          })),
          products: products
            .filter((p) => p.status === "active")
            .map((p) => ({ id: p.id, name: p.name, sku_code: p.sku_code, price: p.price })),
          warehouses: warehouses
            .filter((w) => w.is_active)
            .map((w) => ({ id: w.id, name: w.name })),
          priceTiers,
        }}
      />
    </>
  );
}

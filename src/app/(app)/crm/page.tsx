import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { getCustomers, getOrders } from "@/lib/data/queries";
import { fmtCurrency } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { CrmView } from "./CrmView";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("crm");
  const active = activeSubView(item, view)?.key ?? "consumers";

  const [customers, orders] = await Promise.all([getCustomers(), getOrders()]);

  // 客户中心 manages consumers; B2B partners live in 渠道管理.
  const consumers = customers.filter((c) => c.type === "individual");
  const memberCount = consumers.filter((c) => c.level !== "新客").length;
  const newCount = consumers.filter((c) => c.level === "新客").length;
  const totalSpent = consumers.reduce((sum, c) => sum + c.total_spent, 0);

  const stats: Stat[] = [
    {
      label: "消费者",
      value: String(consumers.length),
      sub: "个人购买客户",
      icon: "users",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "会员",
      value: String(memberCount),
      sub: "已注册会员",
      icon: "check",
      iconColor: "#b07d18",
      iconBg: "#fbf4e3",
      valueColor: "#b07d18",
    },
    {
      label: "新客",
      value: String(newCount),
      sub: "首单待复购",
      icon: "userPlus",
      iconColor: "#16894f",
      iconBg: "#e9f5ef",
      valueColor: "#16894f",
    },
    {
      label: "累计消费",
      value: fmtCurrency(totalSpent),
      sub: "消费者 LTV 合计",
      icon: "dollar",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />
      <CrmView customers={consumers} orders={orders} view={active} />
    </>
  );
}

import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { getCustomers } from "@/lib/data/queries";
import { fmtCurrency } from "@/lib/tokens";
import { CrmView } from "./CrmView";

export default async function CrmPage() {
  const customers = await getCustomers();

  const countries = new Set(customers.map((c) => c.country)).size;
  const vipCount = customers.filter((c) => c.level === "VIP").length;
  const dealerCount = customers.filter((c) => c.type !== "individual").length;
  const totalSpent = customers.reduce((sum, c) => sum + c.total_spent, 0);

  const stats: Stat[] = [
    {
      label: "客户总数",
      value: String(customers.length),
      sub: `覆盖 ${countries} 个国家/地区`,
      icon: "users",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "VIP 客户",
      value: String(vipCount),
      icon: "check",
      iconColor: "#b07d18",
      iconBg: "#fbf4e3",
      valueColor: "#b07d18",
    },
    {
      label: "经销商 / 批发",
      value: String(dealerCount),
      icon: "share",
      iconColor: "#c2703d",
      iconBg: "#fff5ec",
    },
    {
      label: "累计消费",
      value: fmtCurrency(totalSpent),
      sub: "全部客户 LTV",
      icon: "dollar",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <CrmView customers={customers} />
    </>
  );
}

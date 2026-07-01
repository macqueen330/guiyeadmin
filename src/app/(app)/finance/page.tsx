import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { getSettlements } from "@/lib/data/queries";
import { fmtCurrency } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { FinanceView } from "./FinanceView";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("finance");
  const active = activeSubView(item, view)?.key ?? "receipts";

  const settlements = await getSettlements();

  const pending = settlements.filter((s) => s.status === "pending").length;
  const overdue = settlements.filter((s) => s.status === "overdue");
  const overdueAmount = overdue.reduce((sum, s) => sum + s.amount, 0);
  const received = settlements
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.amount, 0);
  const refundAmount = settlements
    .filter((s) => s.type === "refund")
    .reduce((sum, s) => sum + s.amount, 0);

  const stats: Stat[] = [
    {
      label: "本月回款",
      value: fmtCurrency(received),
      sub: "已收到的款项",
      icon: "dollar",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "待结算",
      value: String(pending),
      sub: "单据待处理",
      icon: "cash",
      iconColor: "#b45309",
      iconBg: "#fff7ec",
      valueColor: "#b45309",
    },
    {
      label: "应收逾期",
      value: fmtCurrency(overdueAmount),
      sub: `${overdue.length} 笔逾期`,
      icon: "alert",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: "#c0392b",
    },
    {
      label: "退款金额",
      value: fmtCurrency(refundAmount),
      sub: "本月退款",
      icon: "refund",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />
      <FinanceView settlements={settlements} view={active} />
    </>
  );
}

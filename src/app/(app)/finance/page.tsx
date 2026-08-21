import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { getSettlements } from "@/lib/data/queries";
import { businessMonthStart } from "@/lib/data/metrics";
import { loadSettings } from "@/lib/data/settings";
import { fmtCurrency } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { requireModule } from "@/lib/auth/context";
import { FinanceView } from "./FinanceView";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireModule("finance");

  const { view } = await searchParams;
  const item = navItemByKey("finance");
  const active = activeSubView(item, view)?.key ?? "receipts";

  const [settlements, settings] = await Promise.all([getSettlements(), loadSettings()]);
  const monthStart = businessMonthStart(settings.analytics.tzOffsetHours, 0);
  const inMonth = (iso: string | null) => Boolean(iso && new Date(iso) >= monthStart);

  // 「本月回款 / 本月退款」原来没有任何时间窗过滤，实为全量汇总。
  const received = settlements
    .filter((s) => s.status === "paid" && inMonth(s.paid_at ?? s.created_at))
    .reduce((sum, s) => sum + s.amount, 0);
  const refundAmount = settlements
    .filter((s) => s.type === "refund" && inMonth(s.created_at))
    .reduce((sum, s) => sum + s.amount, 0);

  const pending = settlements.filter((s) => s.status === "pending").length;
  // 逾期实时判定：到期日已过且未结清（不只依赖 status 字段）。
  const today = new Date().toISOString().slice(0, 10);
  const overdue = settlements.filter(
    (s) => s.status !== "paid" && s.due_date && s.due_date < today,
  );
  const overdueAmount = overdue.reduce((sum, s) => sum + s.amount, 0);

  const stats: Stat[] = [
    {
      label: "本月回款",
      value: fmtCurrency(received),
      sub: "本月已结清单据",
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
      valueColor: pending > 0 ? "#b45309" : undefined,
    },
    {
      label: "应收逾期",
      value: fmtCurrency(overdueAmount),
      sub: `${overdue.length} 笔逾期`,
      icon: "alert",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: overdue.length > 0 ? "#c0392b" : undefined,
      href: "/finance?view=receivable",
    },
    {
      label: "本月退款",
      value: fmtCurrency(refundAmount),
      sub: "退款类单据合计",
      icon: "refund",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} empty="还没有财务单据" />
      <SubTabs item={item} active={active} />
      <FinanceView settlements={settlements} view={active} />
    </>
  );
}

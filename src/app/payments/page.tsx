import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { getPayments, getRefunds } from "@/lib/data/queries";
import { fmtCurrency } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { PaymentsView } from "./PaymentsView";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("payments");
  const active = activeSubView(item, view)?.key ?? "flow";

  const [payments, refunds] = await Promise.all([getPayments(), getRefunds()]);

  const success = payments.filter((p) => p.pay_status === "paid" || p.pay_status === "partial_refund").length;
  const exceptions = payments.filter(
    (p) => p.pay_status === "pay_exception" || p.pay_status === "failed" || p.settle_status === "settle_exception",
  ).length;
  const refundOpen = refunds.filter((r) => r.status !== "success" && r.status !== "reconciled" && r.status !== "rejected").length;
  const feeTotal = payments.reduce((s, p) => s + p.fee, 0);

  const stats: Stat[] = [
    { label: "成功交易", value: String(success), sub: "支付成功笔数", icon: "check", iconColor: "#16894f", iconBg: "#e9f5ef", valueColor: "#16894f" },
    { label: "支付异常", value: String(exceptions), sub: "需人工核实", icon: "alert", iconColor: "#c0392b", iconBg: "#fdf0ef", valueColor: "#c0392b" },
    { label: "退款处理中", value: String(refundOpen), sub: "待审核 / 处理", icon: "refund", iconColor: "#b45309", iconBg: "#fff7ec", valueColor: "#b45309" },
    { label: "手续费合计", value: fmtCurrency(feeTotal), sub: "本月支付渠道费", icon: "cash", iconColor: "#2b6cb0", iconBg: "#eef4ff" },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />
      <PaymentsView payments={payments} refunds={refunds} view={active} />
    </>
  );
}

import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import {
  getPaymentGateways,
  getPayments,
  getReconciliationBatches,
  getRefunds,
} from "@/lib/data/queries";
import { readinessFor, type GatewayReadiness } from "@/lib/payments/registry";
import { businessMonthStart } from "@/lib/data/metrics";
import { loadSettings } from "@/lib/data/settings";
import { fmtCurrency } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { requireModule } from "@/lib/auth/context";
import { PaymentsView } from "./PaymentsView";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireModule("finance");

  const { view } = await searchParams;
  const item = navItemByKey("payments");
  const active = activeSubView(item, view)?.key ?? "flow";

  const [payments, refunds, gateways, batches, settings] = await Promise.all([
    getPayments(),
    getRefunds(),
    getPaymentGateways(),
    getReconciliationBatches(20),
    loadSettings(),
  ]);

  const readiness: Record<string, GatewayReadiness> = {};
  for (const g of gateways) readiness[g.provider] = readinessFor(g);

  const success = payments.filter((p) => ["paid", "partial_refund"].includes(p.pay_status)).length;
  const exceptions = payments.filter(
    (p) =>
      p.pay_status === "pay_exception" ||
      p.pay_status === "failed" ||
      p.settle_status === "settle_exception",
  ).length;
  const refundOpen = refunds.filter((r) =>
    ["applying", "reviewing", "processing"].includes(r.status),
  ).length;

  // 「本月支付渠道费」原来是全量汇总，标题却写着「本月」。现在真的按月过滤。
  const monthStart = businessMonthStart(settings.analytics.tzOffsetHours, 0);
  const feeTotal = payments
    .filter((p) => p.paid_at && new Date(p.paid_at) >= monthStart)
    .reduce((s, p) => s + p.fee, 0);

  const enabledGateways = gateways.filter((g) => readiness[g.provider]?.ready).length;

  const stats: Stat[] = [
    {
      label: "成功交易",
      value: String(success),
      sub: "支付成功笔数",
      icon: "check",
      iconColor: "#16894f",
      iconBg: "#e9f5ef",
      valueColor: "#16894f",
    },
    {
      label: "支付异常",
      value: String(exceptions),
      sub: "需人工核实",
      icon: "alert",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: exceptions > 0 ? "#c0392b" : undefined,
      href: "/payments?view=exception",
    },
    {
      label: "退款处理中",
      value: String(refundOpen),
      sub: "待审核 / 处理",
      icon: "refund",
      iconColor: "#b45309",
      iconBg: "#fff7ec",
      valueColor: refundOpen > 0 ? "#b45309" : undefined,
      href: "/payments?view=refunds",
    },
    {
      label: "本月渠道费",
      value: fmtCurrency(feeTotal, { decimals: 2 }),
      sub: "按支付时间统计",
      icon: "cash",
      iconColor: "#2b6cb0",
      iconBg: "#eef4ff",
    },
    {
      label: "可用渠道",
      value: `${enabledGateways} / ${gateways.length}`,
      sub: "配置齐全且已启用",
      icon: "settings",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
      href: "/payments?view=config",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} columns={5} empty="还没有支付数据" />
      <SubTabs item={item} active={active} />
      <PaymentsView
        payments={payments}
        refunds={refunds}
        gateways={gateways}
        readiness={readiness}
        batches={batches}
        siteOrigin={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        view={active}
      />
    </>
  );
}

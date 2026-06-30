import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { getDealers } from "@/lib/data/queries";
import { fmtCurrency } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { ChannelView } from "./ChannelView";

export default async function ChannelPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("channel");
  const active = activeSubView(item, view)?.key ?? "clients";

  const dealers = await getDealers();

  const count = (s: string) => dealers.filter((d) => d.status === s).length;
  const regionCount = new Set(dealers.map((d) => d.region)).size;
  const totalDebt = dealers.reduce((sum, d) => sum + d.debt, 0);
  const debtorCount = dealers.filter((d) => d.debt > 0).length;

  const stats: Stat[] = [
    {
      label: "渠道客户",
      value: String(dealers.length),
      sub: `覆盖 ${regionCount} 个地区`,
      icon: "share",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "合作中",
      value: String(count("active")),
      icon: "check",
      iconColor: "#16894f",
      iconBg: "#e9f5ef",
      valueColor: "#16894f",
    },
    {
      label: "合作申请",
      value: String(count("pending")),
      sub: "待审核",
      icon: "clock",
      iconColor: "#b45309",
      iconBg: "#fff7ec",
      valueColor: "#b45309",
    },
    {
      label: "逾期欠款",
      value: fmtCurrency(totalDebt),
      sub: `${debtorCount} 家有欠款`,
      icon: "cash",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: "#c0392b",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />
      <ChannelView dealers={dealers} view={active} />
    </>
  );
}

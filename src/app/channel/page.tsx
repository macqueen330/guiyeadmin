import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { getDealers } from "@/lib/data/queries";
import { fmtCurrency } from "@/lib/tokens";
import { ChannelView } from "./ChannelView";

export default async function ChannelPage() {
  const dealers = await getDealers();

  const count = (s: string) => dealers.filter((d) => d.status === s).length;
  const regionCount = new Set(dealers.map((d) => d.region)).size;
  const totalDebt = dealers.reduce((sum, d) => sum + d.debt, 0);
  const debtorCount = dealers.filter((d) => d.debt > 0).length;

  const stats: Stat[] = [
    {
      label: "经销商总数",
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
      label: "待审核授权",
      value: String(count("pending")),
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
      <ChannelView dealers={dealers} />
    </>
  );
}

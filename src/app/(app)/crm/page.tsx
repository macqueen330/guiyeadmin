import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import {
  getCustomerTagLinks,
  getCustomerTags,
  getCustomers,
  getMembershipTiers,
  getOrders,
} from "@/lib/data/queries";
import { loadSettings } from "@/lib/data/settings";
import { daysAgo } from "@/lib/data/metrics";
import { fmtCurrency } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { requireModule } from "@/lib/auth/context";
import { CrmView } from "./CrmView";

export const dynamic = "force-dynamic";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; new?: string; q?: string }>;
}) {
  await requireModule("crm");

  const { view, new: newParam, q } = await searchParams;
  const item = navItemByKey("crm");
  const active = activeSubView(item, view)?.key ?? "consumers";

  const [customers, orders, tags, tagLinks, tiers, settings] = await Promise.all([
    getCustomers(),
    getOrders(),
    getCustomerTags(),
    getCustomerTagLinks(),
    getMembershipTiers(),
    loadSettings(),
  ]);

  // 客户中心只管 C 端消费者（type === individual）。
  const consumers = customers.filter((c) => c.type === "individual");
  const baseTier = tiers[0];
  const memberCount = consumers.filter((c) =>
    baseTier ? c.tier_id !== baseTier.id : c.level !== "新客",
  ).length;
  const newCount = consumers.length - memberCount;
  const totalSpent = consumers.reduce((sum, c) => sum + c.total_spent, 0);

  // 待跟进：超过配置天数没有联系过（阈值来自 app_settings，不是写死的 7）。
  const followCutoff = daysAgo(settings.crm.followUpDays);
  const needFollow = consumers.filter(
    (c) => !c.last_contacted_at || new Date(c.last_contacted_at).getTime() < followCutoff,
  ).length;

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
      sub: baseTier ? `高于「${baseTier.name}」门槛` : "已升级客户",
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
      label: "待跟进",
      value: String(needFollow),
      sub: `超 ${settings.crm.followUpDays} 天未联系`,
      icon: "clock",
      iconColor: "#b45309",
      iconBg: "#fff7ec",
      valueColor: needFollow > 0 ? "#b45309" : undefined,
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
      <StatStrip stats={stats} columns={5} empty="还没有客户数据" />
      <SubTabs item={item} active={active} />
      <CrmView
        customers={consumers}
        orders={orders}
        tags={tags}
        tagLinks={tagLinks}
        tiers={tiers}
        view={active}
        openNew={newParam === "1"}
        query={q}
      />
    </>
  );
}

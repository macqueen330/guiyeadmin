import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { Card } from "@/components/ui/Card";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { ChannelMix } from "@/components/dashboard/ChannelMix";
import { RatioDonut } from "@/components/dashboard/RatioDonut";
import { ProductRanking } from "@/components/dashboard/ProductRanking";
import { RegionRanking } from "@/components/dashboard/RegionRanking";
import { TopSku } from "@/components/dashboard/TopSku";
import { Warehouses } from "@/components/dashboard/Warehouses";
import { fmtCurrency, fmtNumber } from "@/lib/tokens";
import {
  getOrders,
  getCustomers,
  getDealers,
  getProducts,
  getInventory,
  getProvinceRanking,
  getCustomerSources,
  getProductAnalytics,
} from "@/lib/data/queries";
import { navItemByKey, activeSubView } from "@/lib/nav";
import type { RegionRank } from "@/lib/types";
import { WebAnalytics } from "./WebAnalytics";
import { ProductFunnel } from "./ProductFunnel";

interface Bar {
  label: string;
  value: number;
  max: number;
  color?: string;
  hint?: string;
}

function BarRows({ title, subtitle, bars }: { title: string; subtitle: string; bars: Bar[] }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 12 }}>
        {bars.map((b) => (
          <div key={b.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e" }}>{b.label}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                <span style={{ fontWeight: 700, color: "#2c322e" }}>{fmtNumber(b.value)}</span>
                {b.hint ? ` · ${b.hint}` : ""}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 5, background: "var(--bg)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 5,
                  background: b.color ?? "var(--accent)",
                  width: `${b.max > 0 ? (b.value / b.max) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; product?: string }>;
}) {
  const { view, product } = await searchParams;
  const item = navItemByKey("analytics");
  const active = activeSubView(item, view)?.key ?? "overview";

  // ---- 官网数据（流量与兴趣，独立于成交）----
  if (active === "web") {
    const drill = product ? getProductAnalytics().find((p) => p.id === product) : undefined;
    return (
      <>
        <SubTabs item={item} active={active} />
        {drill ? <ProductFunnel product={drill} /> : <WebAnalytics />}
      </>
    );
  }

  const [orders, customers, dealers, products, inventory, provinceRanking, customerSources] =
    await Promise.all([
      getOrders(),
      getCustomers(),
      getDealers(),
      getProducts(),
      getInventory(),
      getProvinceRanking(),
      getCustomerSources(),
    ]);

  // Overseas region ranking is computed from real order countries.
  const countryTotals = new Map<string, { value: number; orders: number }>();
  for (const o of orders) {
    const prev = countryTotals.get(o.country) ?? { value: 0, orders: 0 };
    countryTotals.set(o.country, { value: prev.value + o.amount, orders: prev.orders + 1 });
  }
  const overseas: RegionRank[] = [...countryTotals.entries()]
    .map(([name, v]) => ({ name, value: v.value, orders: v.orders }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ---- 经营总览 ----
  if (active === "overview") {
    const stats: Stat[] = [
      { label: "销售额", value: "¥1,284,560", sub: "本月 GMV", icon: "dollar", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
      { label: "有效订单", value: "3,642", sub: "已支付订单", icon: "bag", iconColor: "#c2703d", iconBg: "#fff5ec" },
      { label: "客单价", value: "¥352.7", sub: "AOV", icon: "chartLine", iconColor: "#2b6cb0", iconBg: "#eef4ff" },
      { label: "回款金额", value: "¥1,196,200", sub: "回款率 93.1%", icon: "cash", iconColor: "#16894f", iconBg: "#e9f5ef", valueColor: "#16894f" },
    ];
    return (
      <>
        <StatStrip stats={stats} />
        <SubTabs item={item} active={active} />
        <TrendChart />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <ProductRanking />
          <RegionRanking domestic={provinceRanking} overseas={overseas} />
        </div>
      </>
    );
  }

  // ---- 消费者分析 ----
  if (active === "consumer") {
    const consumers = customers.filter((c) => c.type === "individual");
    const newConsumers = consumers.filter((c) => c.created_at >= "2026-05-01").length;
    const repeat = consumers.filter((c) => c.orders_count > 1).length;
    const repeatRate = consumers.length ? Math.round((repeat / consumers.length) * 100) : 0;
    const totalOrders = consumers.reduce((s, c) => s + c.orders_count, 0);
    const totalSpent = consumers.reduce((s, c) => s + c.total_spent, 0);
    const aov = totalOrders ? Math.round(totalSpent / totalOrders) : 0;
    const vip = consumers.filter((c) => c.level === "VIP").length;

    const freq = [
      { label: "1 单（新客）", value: consumers.filter((c) => c.orders_count <= 1).length },
      { label: "2–3 单", value: consumers.filter((c) => c.orders_count >= 2 && c.orders_count <= 3).length },
      { label: "4–9 单", value: consumers.filter((c) => c.orders_count >= 4 && c.orders_count <= 9).length },
      { label: "10 单以上", value: consumers.filter((c) => c.orders_count >= 10).length },
    ];
    const freqMax = Math.max(1, ...freq.map((f) => f.value));

    const stats: Stat[] = [
      { label: "新增消费者", value: String(newConsumers), sub: "近 60 天", icon: "userPlus", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
      { label: "复购率", value: repeatRate + "%", sub: "下单 ≥ 2 次", icon: "refund", iconColor: "#16894f", iconBg: "#e9f5ef", valueColor: "#16894f" },
      { label: "平均客单价", value: fmtCurrency(aov), sub: "消费者口径", icon: "chartLine", iconColor: "#2b6cb0", iconBg: "#eef4ff" },
      { label: "高价值客户", value: String(vip), sub: "VIP 等级", icon: "check", iconColor: "#b07d18", iconBg: "#fbf4e3", valueColor: "#b07d18" },
    ];

    return (
      <>
        <StatStrip stats={stats} />
        <SubTabs item={item} active={active} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <RatioDonut
            title="客户来源占比"
            subtitle="消费者最早从哪里认识瑰野"
            centerValue="962"
            centerLabel="新增客户"
            slices={customerSources}
          />
          <RegionRanking domestic={provinceRanking} overseas={overseas} title="消费者城市分布" />
        </div>
        <div style={{ marginTop: 16 }}>
          <BarRows
            title="消费频次分布"
            subtitle="按累计下单次数分群"
            bars={freq.map((f) => ({ label: f.label, value: f.value, max: freqMax, hint: "人" }))}
          />
        </div>
      </>
    );
  }

  // ---- 渠道分析 ----
  if (active === "channel") {
    const newChannel = dealers.filter((d) => d.created_at >= "2024-01-01").length;
    const channelSales = dealers.reduce((s, d) => s + d.mtd_sales, 0);
    const activeDealers = dealers.filter((d) => d.status === "active").length;

    // 客户跟进阶段（示例漏斗）。
    const funnel = [
      { label: "意向客户", value: 24 },
      { label: "已报价", value: 16 },
      { label: "已寄样", value: 9 },
      { label: "已成交", value: 6 },
    ];
    const funnelMax = funnel[0].value;
    const quoteConv = Math.round((6 / 16) * 100);
    const sampleConv = Math.round((6 / 9) * 100);

    const stats: Stat[] = [
      { label: "渠道客户", value: String(dealers.length), sub: "合作 B 端客户", icon: "share", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
      { label: "新增渠道客户", value: String(newChannel), sub: "今年新增", icon: "userPlus", iconColor: "#c2703d", iconBg: "#fff5ec" },
      { label: "渠道订单额", value: fmtCurrency(channelSales), sub: "本月进货合计", icon: "dollar", iconColor: "#16894f", iconBg: "#e9f5ef", valueColor: "#16894f" },
      { label: "合作中", value: String(activeDealers), sub: `报价转化 ${quoteConv}% · 样品转化 ${sampleConv}%`, icon: "check", iconColor: "#2b6cb0", iconBg: "#eef4ff" },
    ];

    return (
      <>
        <StatStrip stats={stats} />
        <SubTabs item={item} active={active} />
        <ChannelMix />
        <div style={{ marginTop: 16 }}>
          <BarRows
            title="客户跟进阶段"
            subtitle="意向 → 报价 → 样品 → 成交"
            bars={funnel.map((f, i) => ({
              label: f.label,
              value: f.value,
              max: funnelMax,
              hint: "客户",
              color: ["#2b6cb0", "#b45309", "#8a6fb0", "var(--accent)"][i],
            }))}
          />
        </div>
      </>
    );
  }

  // ---- 商品分析 ----
  const activeSku = products.filter((p) => p.status === "active").length;
  const lowSku = products.filter((p) => {
    const lines = inventory.filter((r) => r.product_id === p.id);
    return lines.some((r) => r.sellable < r.safety_stock);
  }).length;

  const stats: Stat[] = [
    { label: "在售 SKU", value: String(activeSku), sub: `共 ${products.length} 个`, icon: "box", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
    { label: "库存预警", value: String(lowSku), sub: "低于安全线", icon: "alert", iconColor: "#c0392b", iconBg: "#fdf0ef", valueColor: "#c0392b" },
    { label: "库存周转", value: "5.2", sub: "次 / 月", icon: "refund", iconColor: "#2b6cb0", iconBg: "#eef4ff" },
    { label: "退货率", value: "1.8%", sub: "本月", icon: "barChart", iconColor: "#b45309", iconBg: "#fff7ec" },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />
      <ProductRanking />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <TopSku />
        <Warehouses />
      </div>
    </>
  );
}

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
import { fmtCurrency, fmtNumber, fmtPercent, ratio } from "@/lib/tokens";
import {
  getCustomers,
  getDealers,
  getInventory,
  getOrders,
  getProducts,
  getRefunds,
} from "@/lib/data/queries";
import {
  businessDayStart,
  businessMonthStart,
  getCustomerSources,
  getProductRanking,
  getRegionRanking,
  getSalesChannels,
  getTopSku,
  getTrendSeries,
  getWarehouseStock,
} from "@/lib/data/metrics";
import { getProductAnalytics, getProductWebDetail } from "@/lib/data/web";
import { loadSettings } from "@/lib/data/settings";
import { fetchTrendSeriesAction } from "@/lib/actions/series";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { requireModule } from "@/lib/auth/context";
import type { Range } from "@/lib/charts";
import { WebAnalytics } from "./WebAnalytics";
import { ProductFunnel } from "./ProductFunnel";

export const dynamic = "force-dynamic";

interface Bar {
  label: string;
  value: number;
  max: number;
  color?: string;
  hint?: string;
}

function BarRows({
  title,
  subtitle,
  bars,
  empty = "暂无数据",
}: {
  title: string;
  subtitle: string;
  bars: Bar[];
  empty?: string;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
      </div>
      {bars.length === 0 ? (
        <div style={{ padding: "22px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
          {empty}
        </div>
      ) : (
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
      )}
    </Card>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; product?: string }>;
}) {
  await requireModule("analytics");

  const { view, product } = await searchParams;
  const item = navItemByKey("analytics");
  const active = activeSubView(item, view)?.key ?? "overview";
  const settings = await loadSettings();
  const tz = settings.analytics.tzOffsetHours;

  // ---- 官网数据（流量与兴趣，独立于成交）----
  if (active === "web") {
    if (product) {
      const [detail, products, all] = await Promise.all([
        getProductWebDetail(product),
        getProducts(),
        getProductAnalytics(),
      ]);
      const analytics = detail?.analytics ?? all.find((p) => p.id === product) ?? null;
      const name = products.find((p) => p.id === product)?.name ?? analytics?.name ?? product;
      if (analytics) {
        return (
          <>
            <SubTabs item={item} active={active} />
            <ProductFunnel
              product={analytics}
              productName={name}
              avgStaySeconds={detail?.avgStaySeconds ?? null}
              revenue={detail?.revenue ?? 0}
              units={detail?.units ?? 0}
              analytics={settings.analytics}
            />
          </>
        );
      }
    }
    return (
      <>
        <SubTabs item={item} active={active} />
        <WebAnalytics />
      </>
    );
  }

  // ---- 经营总览 ----
  if (active === "overview") {
    const monthStart = businessMonthStart(tz, 0);
    const [orders, ranking, regions, series] = await Promise.all([
      getOrders(),
      getProductRanking(6),
      getRegionRanking(),
      getTrendSeries("sales", String(settings.analytics.defaultRangeDays) as Range),
    ]);

    const thisMonth = orders.filter((o) => new Date(o.created_at) >= monthStart);
    const paid = thisMonth.filter((o) => ["paid", "partial_refund"].includes(o.pay_status));
    const gmv = paid.reduce((s, o) => s + o.amount, 0);
    const received = paid.reduce((s, o) => s + o.amount_received, 0);
    const aov = paid.length ? gmv / paid.length : 0;
    const collectRate = ratio(received, gmv);

    const stats: Stat[] = [
      {
        label: "销售额",
        value: fmtCurrency(gmv),
        sub: "本月 GMV",
        icon: "dollar",
        iconColor: "var(--accent)",
        iconBg: "var(--accent-soft)",
      },
      {
        label: "有效订单",
        value: fmtNumber(paid.length),
        sub: `本月共 ${thisMonth.length} 单`,
        icon: "bag",
        iconColor: "#c2703d",
        iconBg: "#fff5ec",
      },
      {
        label: "客单价",
        value: fmtCurrency(aov),
        sub: "AOV = GMV ÷ 有效订单",
        icon: "chartLine",
        iconColor: "#2b6cb0",
        iconBg: "#eef4ff",
      },
      {
        label: "回款金额",
        value: fmtCurrency(received),
        sub: collectRate === null ? "本月暂无成交" : `回款率 ${fmtPercent(collectRate)}`,
        icon: "cash",
        iconColor: "#16894f",
        iconBg: "#e9f5ef",
        valueColor: "#16894f",
      },
    ];
    return (
      <>
        <StatStrip stats={stats} empty="本月还没有订单" />
        <SubTabs item={item} active={active} />
        <TrendChart
          initialSeries={series}
          initialMetric="sales"
          initialRange={String(settings.analytics.defaultRangeDays) as Range}
          fetchSeries={fetchTrendSeriesAction}
          metrics={["sales", "orders", "received", "refunds"]}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <ProductRanking rows={ranking} />
          <RegionRanking domestic={regions.domestic} overseas={regions.overseas} />
        </div>
      </>
    );
  }

  // ---- 消费者分析 ----
  if (active === "consumer") {
    const [customers, regions, customerSources, tiersOrders] = await Promise.all([
      getCustomers(),
      getRegionRanking(),
      getCustomerSources(),
      getOrders(),
    ]);

    const consumers = customers.filter((c) => c.type === "individual");
    // 「新增」的基准日不再写死成 "2026-05-01"：按配置的默认区间倒推。
    const windowDays = settings.analytics.defaultRangeDays;
    const since = businessDayStart(tz, windowDays - 1);
    const newConsumers = consumers.filter((c) => new Date(c.created_at) >= since).length;

    const repeat = consumers.filter((c) => c.orders_count > 1).length;
    const repeatRate = ratio(repeat, consumers.length);
    const totalOrders = consumers.reduce((s, c) => s + c.orders_count, 0);
    const totalSpent = consumers.reduce((s, c) => s + c.total_spent, 0);
    const aov = totalOrders ? totalSpent / totalOrders : 0;
    const topTier = [...consumers].sort((a, b) => b.total_spent - a.total_spent)[0];
    const highValue = consumers.filter((c) => c.total_spent >= (topTier?.total_spent ?? 0) * 0.5).length;

    const freq = [
      { label: "1 单（新客）", value: consumers.filter((c) => c.orders_count <= 1).length },
      { label: "2–3 单", value: consumers.filter((c) => c.orders_count >= 2 && c.orders_count <= 3).length },
      { label: "4–9 单", value: consumers.filter((c) => c.orders_count >= 4 && c.orders_count <= 9).length },
      { label: "10 单以上", value: consumers.filter((c) => c.orders_count >= 10).length },
    ].filter((f) => f.value > 0);
    const freqMax = Math.max(1, ...freq.map((f) => f.value));

    const stats: Stat[] = [
      {
        label: "新增消费者",
        value: String(newConsumers),
        sub: `近 ${windowDays} 天`,
        icon: "userPlus",
        iconColor: "var(--accent)",
        iconBg: "var(--accent-soft)",
      },
      {
        label: "复购率",
        value: fmtPercent(repeatRate, 0),
        sub: "下单 ≥ 2 次",
        icon: "refund",
        iconColor: "#16894f",
        iconBg: "#e9f5ef",
        valueColor: "#16894f",
      },
      {
        label: "平均客单价",
        value: fmtCurrency(aov),
        sub: "消费者口径",
        icon: "chartLine",
        iconColor: "#2b6cb0",
        iconBg: "#eef4ff",
      },
      {
        label: "高价值客户",
        value: String(highValue),
        sub: "消费额达头部客户一半以上",
        icon: "check",
        iconColor: "#b07d18",
        iconBg: "#fbf4e3",
        valueColor: "#b07d18",
      },
    ];

    return (
      <>
        <StatStrip stats={stats} empty="还没有消费者数据" />
        <SubTabs item={item} active={active} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <RatioDonut
            title="客户来源占比"
            subtitle="按本月订单的客户来源统计"
            centerValue={fmtNumber(customerSources.reduce((s, c) => s + c.val, 0))}
            centerLabel="本月订单"
            slices={customerSources}
          />
          <RegionRanking
            domestic={regions.domestic}
            overseas={regions.overseas}
            title="消费者地区分布"
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <BarRows
            title="消费频次分布"
            subtitle="按累计下单次数分群"
            bars={freq.map((f) => ({ label: f.label, value: f.value, max: freqMax, hint: "人" }))}
            empty="还没有消费者"
          />
        </div>
        <div style={{ marginTop: 16, fontSize: 11.5, color: "var(--muted)" }}>
          共 {fmtNumber(consumers.length)} 位消费者 · {fmtNumber(tiersOrders.length)} 笔订单参与统计
        </div>
      </>
    );
  }

  // ---- 渠道分析 ----
  if (active === "channel") {
    const [dealers, salesChannels, customerSources] = await Promise.all([
      getDealers(),
      getSalesChannels(),
      getCustomerSources(),
    ]);

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    // 原来这里写死 "2024-01-01" 当作「今年」，实际统计的是近 2.7 年累计。
    const newChannel = dealers.filter((d) => new Date(d.created_at) >= yearStart).length;
    const channelSales = dealers.reduce((s, d) => s + d.mtd_sales, 0);
    const activeDealers = dealers.filter((d) => d.status === "active").length;
    const totalDebt = dealers.reduce((s, d) => s + d.debt, 0);
    const creditUsed = ratio(
      totalDebt,
      dealers.reduce((s, d) => s + d.credit_limit, 0),
    );

    // 原「客户跟进阶段」漏斗（意向 24 / 报价 16 / 寄样 9 / 成交 6）没有任何表支撑，
    // 「转化率」是 6/16、6/9 两个常数除法。改为按等级统计的真实分布。
    const byLevel = new Map<string, number>();
    for (const d of dealers) byLevel.set(d.level, (byLevel.get(d.level) ?? 0) + 1);
    const levelBars = [...byLevel.entries()].map(([label, value]) => ({ label, value }));
    const levelMax = Math.max(1, ...levelBars.map((b) => b.value));

    const stats: Stat[] = [
      {
        label: "渠道客户",
        value: String(dealers.length),
        sub: "合作 B 端客户",
        icon: "share",
        iconColor: "var(--accent)",
        iconBg: "var(--accent-soft)",
      },
      {
        label: "今年新增",
        value: String(newChannel),
        sub: `${yearStart.getFullYear()} 年至今`,
        icon: "userPlus",
        iconColor: "#c2703d",
        iconBg: "#fff5ec",
      },
      {
        label: "渠道订单额",
        value: fmtCurrency(channelSales),
        sub: "本月进货合计",
        icon: "dollar",
        iconColor: "#16894f",
        iconBg: "#e9f5ef",
        valueColor: "#16894f",
      },
      {
        label: "合作中",
        value: String(activeDealers),
        sub: creditUsed === null ? "暂未设置授信" : `授信占用 ${fmtPercent(creditUsed, 0)}`,
        icon: "check",
        iconColor: "#2b6cb0",
        iconBg: "#eef4ff",
      },
    ];

    return (
      <>
        <StatStrip stats={stats} empty="还没有渠道客户" />
        <SubTabs item={item} active={active} />
        <ChannelMix salesChannels={salesChannels} customerSources={customerSources} />
        <div style={{ marginTop: 16 }}>
          <BarRows
            title="渠道客户等级分布"
            subtitle="按合作等级统计的真实客户数"
            bars={levelBars.map((b, i) => ({
              ...b,
              max: levelMax,
              hint: "家",
              color: ["var(--accent)", "#b45309", "#2b6cb0", "#8a6fb0"][i % 4],
            }))}
            empty="还没有渠道客户"
          />
        </div>
      </>
    );
  }

  // ---- 商品分析 ----
  const [products, inventory, ranking, topSku, warehouses, orders, refunds] = await Promise.all([
    getProducts(),
    getInventory(),
    getProductRanking(8),
    getTopSku(5),
    getWarehouseStock(),
    getOrders(),
    getRefunds(),
  ]);

  const activeSku = products.filter((p) => p.status === "active").length;
  const lowSku = products.filter((p) => {
    const lines = inventory.filter((r) => r.product_id === p.id);
    return lines.some((r) => {
      const avail = r.sellable + (settings.inventory.countTransit ? r.transit : 0);
      return avail < r.safety_stock;
    });
  }).length;

  const monthStart = businessMonthStart(tz, 0);
  const monthOrders = orders.filter((o) => new Date(o.created_at) >= monthStart);
  const monthRefunds = refunds.filter(
    (r) => new Date(r.applied_at) >= monthStart && ["success", "reconciled"].includes(r.status),
  );
  const refundedOrderNos = new Set(monthRefunds.map((r) => r.order_no));
  const returnRate = ratio(refundedOrderNos.size, monthOrders.length);

  // 库存周转 = 本月出库件数 ÷ 平均可售库存（真实计算，不再是写死的 5.2）
  const soldUnits = ranking.reduce((s, r) => s + r.units, 0);
  const avgStock = inventory.reduce((s, r) => s + r.sellable, 0);
  const turnover = avgStock > 0 ? soldUnits / avgStock : null;

  const stats: Stat[] = [
    {
      label: "在售 SKU",
      value: String(activeSku),
      sub: `共 ${products.length} 个`,
      icon: "box",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "库存预警",
      value: String(lowSku),
      sub: "低于安全线",
      icon: "alert",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: lowSku > 0 ? "#c0392b" : undefined,
      href: "/inventory?view=alerts",
    },
    {
      label: "库存周转",
      value: turnover === null ? "—" : turnover.toFixed(2),
      sub: "本月出库件数 ÷ 当前可售",
      icon: "refund",
      iconColor: "#2b6cb0",
      iconBg: "#eef4ff",
    },
    {
      label: "退货率",
      value: fmtPercent(returnRate),
      sub: "本月有退款的订单占比",
      icon: "barChart",
      iconColor: "#b45309",
      iconBg: "#fff7ec",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} empty="还没有商品数据" />
      <SubTabs item={item} active={active} />
      <ProductRanking rows={ranking} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <TopSku rows={topSku} />
        <Warehouses rows={warehouses} />
      </div>
    </>
  );
}

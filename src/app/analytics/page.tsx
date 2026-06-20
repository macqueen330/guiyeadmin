import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { Card } from "@/components/ui/Card";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { ChannelDonut } from "@/components/dashboard/ChannelDonut";
import { TopSku } from "@/components/dashboard/TopSku";
import { Warehouses } from "@/components/dashboard/Warehouses";
import { fmtCurrency, ORDER_SOURCE } from "@/lib/tokens";
import { getOrders } from "@/lib/data/queries";
import type { OrderSource } from "@/lib/types";

interface BarRow {
  label: string;
  value: number;
  color: string;
}

function BarList({ rows }: { rows: BarRow[] }) {
  const max = rows.length > 0 ? rows[0].value : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 14 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e" }}>{r.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmtCurrency(r.value)}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 5, background: "var(--bg)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 5,
                background: r.color,
                width: `${max > 0 ? (r.value / max) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
    </div>
  );
}

export default async function AnalyticsPage() {
  const orders = await getOrders();

  const countryTotals = new Map<string, number>();
  for (const o of orders) {
    countryTotals.set(o.country, (countryTotals.get(o.country) ?? 0) + o.amount);
  }
  const byCountry: BarRow[] = [...countryTotals.entries()]
    .map(([label, value]) => ({ label, value, color: "var(--accent)" }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const sourceTotals = new Map<OrderSource, number>();
  for (const o of orders) {
    sourceTotals.set(o.source, (sourceTotals.get(o.source) ?? 0) + o.amount);
  }
  const bySource: BarRow[] = [...sourceTotals.entries()]
    .map(([source, value]) => ({
      label: ORDER_SOURCE[source].text,
      value,
      color: ORDER_SOURCE[source].color,
    }))
    .sort((a, b) => b.value - a.value);

  const stats: Stat[] = [
    { label: "销售额 GMV", value: "¥1,284,560", sub: "本月", icon: "dollar", iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
    { label: "订单数", value: "3,642", sub: "本月", icon: "bag", iconColor: "#c2703d", iconBg: "#fff5ec" },
    { label: "客单价", value: "¥352.7", sub: "AOV", icon: "chartLine", iconColor: "#2b6cb0", iconBg: "#eef4ff" },
    { label: "毛利率", value: "54.6%", sub: "本月", icon: "barChart", iconColor: "#16894f", iconBg: "#e9f5ef" },
  ];

  return (
    <>
      <StatStrip stats={stats} />

      <div style={{ display: "grid", gridTemplateColumns: "1.85fr 1fr", gap: 16, marginTop: 16 }}>
        <TrendChart />
        <ChannelDonut />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Card>
          <CardTitle title="销售额 · 地区 TOP" subtitle="按收货国家/地区汇总" />
          <BarList rows={byCountry} />
        </Card>
        <Card>
          <CardTitle title="销售额 · 渠道" subtitle="按下单来源汇总" />
          <BarList rows={bySource} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <TopSku />
        <Warehouses />
      </div>
    </>
  );
}

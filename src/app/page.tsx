import { KpiRow } from "@/components/dashboard/KpiRow";
import { Pipeline } from "@/components/dashboard/Pipeline";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { ChannelDonut } from "@/components/dashboard/ChannelDonut";
import { Alerts } from "@/components/dashboard/Alerts";
import { Warehouses } from "@/components/dashboard/Warehouses";
import { TopSku } from "@/components/dashboard/TopSku";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { getRecentOrders } from "@/lib/data/queries";

export default async function DashboardPage() {
  const orders = await getRecentOrders(6);

  return (
    <>
      <KpiRow />
      <Pipeline />

      <div style={{ display: "grid", gridTemplateColumns: "1.85fr 1fr", gap: 16, marginTop: 16 }}>
        <TrendChart />
        <ChannelDonut />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 0.95fr", gap: 16, marginTop: 16 }}>
        <Alerts />
        <Warehouses />
        <TopSku />
      </div>

      <RecentOrders orders={orders} />
    </>
  );
}

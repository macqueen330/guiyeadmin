import { Card } from "@/components/ui/Card";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import {
  getInventory,
  getInventoryMoves,
  getPriceTiers,
  getProductCategories,
  getProductPrices,
  getProducts,
  getWarehouses,
} from "@/lib/data/queries";
import { loadSettings } from "@/lib/data/settings";
import { fmtNumber } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { requireModule } from "@/lib/auth/context";
import { InventoryView, type InventoryRowView } from "./InventoryView";

export const dynamic = "force-dynamic";

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; new?: string; q?: string }>;
}) {
  await requireModule("inventory");

  const { view, q } = await searchParams;
  const item = navItemByKey("inventory");
  const active = activeSubView(item, view)?.key ?? "products";

  const [products, inventory, warehouses, tiers, prices, categories, moves, settings] =
    await Promise.all([
      getProducts(),
      getInventory(),
      getWarehouses(),
      getPriceTiers(),
      getProductPrices(),
      getProductCategories(),
      getInventoryMoves(200),
      loadSettings(),
    ]);

  const { countTransit, urgentRatio, defaultSafetyStock } = settings.inventory;

  // 每个 SKU 跨仓汇总。安全库存口径统一用 products.safety_stock（缺省用全局默认），
  // 不再出现「按库存行判定预警、按商品行算缺口」两套口径打架。
  const rows: InventoryRowView[] = products.map((p) => {
    const lines = inventory.filter((r) => r.product_id === p.id);
    const sellable = lines.reduce((s, r) => s + r.sellable, 0);
    const locked = lines.reduce((s, r) => s + r.locked, 0);
    const transit = lines.reduce((s, r) => s + r.transit, 0);
    const safety = p.safety_stock || defaultSafetyStock;
    const available = sellable + (countTransit ? transit : 0);
    const low = available < safety;
    return {
      id: p.id,
      name: p.name,
      sku_code: p.sku_code,
      category: p.category,
      category_id: p.category_id,
      price: p.price,
      cost: p.cost,
      safety_stock: safety,
      status: p.status,
      unit: p.unit,
      spec: p.spec ?? null,
      sellable,
      locked,
      transit,
      low,
      urgent: available < safety * urgentRatio,
      gap: Math.max(0, safety - available),
    };
  });

  // 每个仓库的汇总（与首页多仓库存同源）。
  const warehouseSummary = warehouses
    .filter((w) => w.is_active)
    .map((w) => {
      const lines = inventory.filter((r) => r.warehouse_id === w.id);
      const sellable = lines.reduce((s, r) => s + r.sellable, 0);
      const locked = lines.reduce((s, r) => s + r.locked, 0);
      const transit = lines.reduce((s, r) => s + r.transit, 0);
      const lowCount = lines.filter((r) => {
        const avail = r.sellable + (countTransit ? r.transit : 0);
        return avail < r.safety_stock;
      }).length;
      return { ...w, sellable, locked, transit, lowCount };
    });

  const activeCount = products.filter((p) => p.status === "active").length;
  const lowCount = rows.filter((r) => r.low).length;
  const totalSellable = inventory.reduce((s, r) => s + r.sellable, 0);

  const stats: Stat[] = [
    {
      label: "SKU 总数",
      value: String(products.length),
      sub: `${categories.length} 个分类`,
      icon: "box",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "在售",
      value: String(activeCount),
      sub: "已上架商品",
      icon: "check",
      iconColor: "#16894f",
      iconBg: "#e9f5ef",
      valueColor: "#16894f",
    },
    {
      label: "低于安全线",
      value: String(lowCount),
      sub: countTransit ? "可售 + 在途口径" : "仅按可售口径",
      icon: "alert",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: lowCount > 0 ? "#c0392b" : undefined,
      href: "/inventory?view=alerts",
    },
    {
      label: "可售总量",
      value: fmtNumber(totalSellable),
      sub: "全仓可售件数",
      icon: "barChart",
      iconColor: "#2b6cb0",
      iconBg: "#eef4ff",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} empty="还没有商品数据" />
      <SubTabs item={item} active={active} />

      {active === "stock" && warehouseSummary.length > 0 && (
        <Card style={{ display: "flex", flexDirection: "column", marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700 }}>多仓库存分布</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--muted)" }}>
              <LegendDot color="var(--accent)" label="可售" />
              <LegendDot color="#e0a44a" label="锁定" />
              <LegendDot color="#cdd2cb" label="在途" />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 14 }}>
            {warehouseSummary.map((w) => {
              const total = w.sellable + w.locked + w.transit;
              const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) + "%" : "0%");
              return (
                <div key={w.id} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{w.name}</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: "var(--muted)",
                        background: "var(--bg)",
                        padding: "1px 7px",
                        borderRadius: 5,
                      }}
                    >
                      {w.code}
                    </span>
                    {w.lowCount > 0 && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: "#c0392b",
                          background: "#fdf0ef",
                          padding: "1px 7px",
                          borderRadius: 5,
                        }}
                      >
                        {w.lowCount} SKU 预警
                      </span>
                    )}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 13,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtNumber(total)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      height: 8,
                      borderRadius: 5,
                      overflow: "hidden",
                      background: "var(--bg)",
                    }}
                  >
                    <div style={{ background: "var(--accent)", width: pct(w.sellable) }} />
                    <div style={{ background: "#e0a44a", width: pct(w.locked) }} />
                    <div style={{ background: "#cdd2cb", width: pct(w.transit) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <InventoryView
        rows={rows}
        view={active}
        tiers={tiers}
        prices={prices}
        categories={categories}
        warehouses={warehouses.filter((w) => w.is_active).map((w) => ({ id: w.id, name: w.name }))}
        moves={moves}
        countTransit={countTransit}
        query={q}
      />
    </>
  );
}

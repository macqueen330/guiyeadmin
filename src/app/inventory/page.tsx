import { Card } from "@/components/ui/Card";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { SubTabs } from "@/components/ui/SubTabs";
import { ModulePlaceholder } from "@/components/ui/ModulePlaceholder";
import { getProducts, getInventory, getWarehouses } from "@/lib/data/queries";
import { fmtNumber } from "@/lib/tokens";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { InventoryView, type InventoryRowView } from "./InventoryView";

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
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const item = navItemByKey("inventory");
  const active = activeSubView(item, view)?.key ?? "products";

  const [products, inventory, warehouses] = await Promise.all([
    getProducts(),
    getInventory(),
    getWarehouses(),
  ]);

  // Per-product roll-up across all inventory rows with a matching product_id.
  const rows: InventoryRowView[] = products.map((p) => {
    const lines = inventory.filter((r) => r.product_id === p.id);
    const sellable = lines.reduce((s, r) => s + r.sellable, 0);
    const locked = lines.reduce((s, r) => s + r.locked, 0);
    const transit = lines.reduce((s, r) => s + r.transit, 0);
    const low = lines.some((r) => r.sellable < r.safety_stock);
    return {
      id: p.id,
      name: p.name,
      sku_code: p.sku_code,
      category: p.category,
      price: p.price,
      cost: p.cost,
      safety_stock: p.safety_stock,
      status: p.status,
      sellable,
      locked,
      transit,
      low,
    };
  });

  // Per-warehouse roll-up across its inventory rows.
  const warehouseSummary = warehouses.map((w) => {
    const lines = inventory.filter((r) => r.warehouse_id === w.id);
    const sellable = lines.reduce((s, r) => s + r.sellable, 0);
    const locked = lines.reduce((s, r) => s + r.locked, 0);
    const transit = lines.reduce((s, r) => s + r.transit, 0);
    const lowCount = lines.filter((r) => r.sellable < r.safety_stock).length;
    return { ...w, sellable, locked, transit, lowCount };
  });

  const categories = new Set(products.map((p) => p.category));
  const activeCount = products.filter((p) => p.status === "active").length;
  const lowCount = rows.filter((r) => r.low).length;
  const totalSellable = inventory.reduce((s, r) => s + r.sellable, 0);

  const stats: Stat[] = [
    {
      label: "SKU 总数",
      value: String(products.length),
      sub: `${categories.size} 个分类`,
      icon: "box",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "在售",
      value: String(activeCount),
      icon: "check",
      iconColor: "#16894f",
      iconBg: "#e9f5ef",
      valueColor: "#16894f",
    },
    {
      label: "低于安全线",
      value: String(lowCount),
      sub: "需补货 SKU",
      icon: "alert",
      iconColor: "#c0392b",
      iconBg: "#fdf0ef",
      valueColor: "#c0392b",
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
      <StatStrip stats={stats} />
      <SubTabs item={item} active={active} />

      {active === "moves" ? (
        <ModulePlaceholder
          icon="layers"
          title="入库 / 出库记录"
          description="按批次记录每一次入库与出库，支持采购入库、退货入库、销售出库、调拨与盘点，形成完整的库存流水。"
          fields={["入库单", "出库单", "批次 / 效期", "经办人", "关联订单", "调拨单", "盘点差异"]}
        />
      ) : (
        <>
          {active === "stock" && (
            <Card style={{ display: "flex", flexDirection: "column", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#2c322e" }}>{w.name}</span>
                        <span style={{ fontSize: 10.5, color: "var(--muted)", background: "var(--bg)", padding: "1px 7px", borderRadius: 5 }}>
                          {w.code}
                        </span>
                        {w.lowCount > 0 && (
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: "#c0392b", background: "#fdf0ef", padding: "1px 7px", borderRadius: 5 }}>
                            {w.lowCount} SKU预警
                          </span>
                        )}
                        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {fmtNumber(total)}
                        </span>
                      </div>
                      <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "var(--bg)" }}>
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

          <InventoryView rows={rows} view={active} />
        </>
      )}
    </>
  );
}

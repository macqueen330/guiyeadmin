import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { fmtCurrency, fmtNumber } from "@/lib/tokens";
import type { ProductAnalytics } from "@/lib/types";
import { Funnel } from "./Funnel";

function pct(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0;
}

// 简单诊断：从漏斗各环节的转化率推断卡点在哪一步。
function diagnostics(p: ProductAnalytics): { tone: "warn" | "bad"; text: string }[] {
  const out: { tone: "warn" | "bad"; text: string }[] = [];
  if (pct(p.clicks, p.impressions) < 30) out.push({ tone: "warn", text: "曝光高、点击低：主图或标题吸引力不足，建议优化产品封面与卖点。" });
  if (pct(p.views, p.clicks) < 55) out.push({ tone: "warn", text: "点击后流失快：详情页内容或首屏体验需加强。" });
  if (pct(p.add_cart, p.views) < 20) out.push({ tone: "bad", text: "停留后加购低：价格或产品说服力可能存在问题。" });
  if (pct(p.paid, p.orders) < 80) out.push({ tone: "bad", text: "下单后支付低：检查运费、支付流程与信任感。" });
  return out.length ? out : [{ tone: "warn", text: "各环节转化健康，可继续放大曝光。" }];
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.3px", color: accent ? "var(--accent)" : "var(--ink)" }}>{value}</span>
    </div>
  );
}

export function ProductFunnel({ product: p }: { product: ProductAnalytics }) {
  const revenue = p.paid * 210; // 估算销售额（示例 AOV）
  const steps = [
    { label: "产品曝光", count: p.impressions },
    { label: "产品点击", count: p.clicks },
    { label: "详情深度浏览", count: p.views },
    { label: "加入购物车", count: p.add_cart },
    { label: "提交订单", count: p.orders },
    { label: "支付成功", count: p.paid },
  ];
  const diags = diagnostics(p);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Link href="/analytics?view=web" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
        <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
        返回官网数据
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.4px" }}>{p.name}</h2>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>官网数据详情</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Metric label="曝光量" value={fmtNumber(p.impressions)} />
        <Metric label="点击量" value={fmtNumber(p.clicks)} />
        <Metric label="详情页访问" value={fmtNumber(p.views)} />
        <Metric label="平均停留" value="2分36秒" />
        <Metric label="加购人数" value={fmtNumber(p.add_cart)} />
        <Metric label="下单人数" value={fmtNumber(p.orders)} />
        <Metric label="估算销售额" value={fmtCurrency(revenue)} accent />
        <Metric label="转化率" value={pct(p.paid, p.impressions).toFixed(2) + "%"} accent />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>转化漏斗</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>曝光 → 点击 → 详情 → 加购 → 下单 → 支付</span>
          </div>
          <Funnel steps={steps} />
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>卡点诊断</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {diags.map((d, i) => (
              <div key={i} style={{ display: "flex", gap: 9, padding: "11px 12px", borderRadius: 10, background: d.tone === "bad" ? "#fdf0ef" : "#fff7ec", border: `1px solid ${d.tone === "bad" ? "#f6dcd8" : "#f2e2c4"}` }}>
                <Icon name="alert" size={15} color={d.tone === "bad" ? "#c0392b" : "#b45309"} style={{ flex: "none", marginTop: 1 }} />
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: d.tone === "bad" ? "#a03227" : "#8a5a12" }}>{d.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

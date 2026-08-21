import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { fmtCurrency, fmtDuration, fmtNumber, fmtPercent, ratio } from "@/lib/tokens";
import type { ProductAnalytics } from "@/lib/types";
import type { AnalyticsSettings } from "@/lib/settings";
import { Funnel } from "./Funnel";

// 单品官网漏斗。
//
// 三处修正：
//   * 「平均停留 2分36秒」原来对所有产品显示同一个写死值（类型里根本没这个字段），
//     现在来自该产品页的 page_leave 埋点；
//   * 「估算销售额」原来 = 支付数 × 写死的客单价 210，礼盒与小样收入被严重错估；
//     现在是该 SKU 在同一区间内的真实成交额；
//   * 诊断阈值（30 / 55 / 20 / 80）原来写死在组件里，现在来自
//     app_settings.analytics.product_diagnosis。

function diagnostics(
  p: ProductAnalytics,
  t: AnalyticsSettings["productDiagnosis"],
): { tone: "warn" | "bad"; text: string }[] {
  const out: { tone: "warn" | "bad"; text: string }[] = [];
  const ctr = ratio(p.clicks, p.impressions);
  const viewRate = ratio(p.views, p.clicks);
  const cartRate = ratio(p.add_cart, p.views);
  const payRate = ratio(p.paid, p.orders);

  if (ctr !== null && ctr < t.ctr_low) {
    out.push({ tone: "warn", text: "曝光高、点击低：主图或标题吸引力不足，建议优化产品封面与卖点。" });
  }
  if (viewRate !== null && viewRate < t.view_rate_low) {
    out.push({ tone: "warn", text: "点击后流失快：详情页内容或首屏体验需加强。" });
  }
  if (cartRate !== null && cartRate < t.cart_rate_low) {
    out.push({ tone: "bad", text: "停留后加购低：价格或产品说服力可能存在问题。" });
  }
  if (payRate !== null && payRate < t.pay_rate_low) {
    out.push({ tone: "bad", text: "下单后支付低：检查运费、支付流程与信任感。" });
  }
  if (out.length === 0) {
    const anyData = p.impressions + p.clicks + p.views > 0;
    return [
      {
        tone: "warn",
        text: anyData ? "各环节转化健康，可继续放大曝光。" : "该产品在所选区间内还没有埋点数据。",
      },
    ];
  }
  return out;
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "13px 15px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "-.3px",
          color: accent ? "var(--accent)" : "var(--ink)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function ProductFunnel({
  product: p,
  productName,
  avgStaySeconds,
  revenue,
  units,
  analytics,
}: {
  product: ProductAnalytics;
  productName: string;
  avgStaySeconds: number | null;
  revenue: number;
  units: number;
  analytics: AnalyticsSettings;
}) {
  const steps = [
    { label: "产品曝光", count: p.impressions },
    { label: "产品点击", count: p.clicks },
    { label: "详情深度浏览", count: p.views },
    { label: "加入购物车", count: p.add_cart },
    { label: "提交订单", count: p.orders },
    { label: "支付成功", count: p.paid },
  ];
  const diags = diagnostics(p, analytics.productDiagnosis);
  // 「转化率」在本页与列表页统一口径：支付 ÷ 曝光（列表页显示的是下单 ÷ 详情，
  // 两者含义不同，因此列表页那一列已单独标注口径）。
  const convRate = ratio(p.paid, p.impressions);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Link
        href="/analytics?view=web"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}
      >
        <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
        返回官网数据
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.4px" }}>{productName}</h2>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>官网数据详情 · 近 30 天</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Metric label="曝光量" value={fmtNumber(p.impressions)} />
        <Metric label="点击量" value={fmtNumber(p.clicks)} />
        <Metric label="详情页访问" value={fmtNumber(p.views)} />
        <Metric label="平均停留" value={fmtDuration(avgStaySeconds)} />
        <Metric label="加购人数" value={fmtNumber(p.add_cart)} />
        <Metric label="下单人数" value={fmtNumber(p.orders)} />
        <Metric label={`成交额（${fmtNumber(units)} 件）`} value={fmtCurrency(revenue)} accent />
        <Metric label="转化率（支付 ÷ 曝光）" value={fmtPercent(convRate, 2)} accent />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>转化漏斗</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              曝光 → 点击 → 详情 → 加购 → 下单 → 支付
            </span>
          </div>
          <Funnel steps={steps} good={analytics.funnelGood} warn={analytics.funnelWarn} />
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>卡点诊断</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
            阈值可在 系统设置 → 业务规则 中调整
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {diags.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 9,
                  padding: "11px 12px",
                  borderRadius: 10,
                  background: d.tone === "bad" ? "#fdf0ef" : "#fff7ec",
                  border: `1px solid ${d.tone === "bad" ? "#f6dcd8" : "#f2e2c4"}`,
                }}
              >
                <Icon
                  name="alert"
                  size={15}
                  color={d.tone === "bad" ? "#c0392b" : "#b45309"}
                  style={{ flex: "none", marginTop: 1 }}
                />
                <span
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: d.tone === "bad" ? "#a03227" : "#8a5a12",
                  }}
                >
                  {d.text}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

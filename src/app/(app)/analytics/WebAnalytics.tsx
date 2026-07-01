import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { InfoHint } from "@/components/ui/InfoHint";
import { RatioDonut } from "@/components/dashboard/RatioDonut";
import { fmtNumber } from "@/lib/tokens";
import {
  getWebOverview,
  getProductAnalytics,
  getPageStats,
  getTrafficSources,
  getDeviceSplit,
  getWebCities,
  getOverallFunnel,
  getEventCounts,
} from "@/lib/data/queries";
import { WebViews } from "@/components/dashboard/WebViews";
import { WebTrend } from "./WebTrend";
import { Funnel } from "./Funnel";

function pct(n: number, d: number): string {
  return d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "—";
}

function WebKpi({ label, value, delta, sub, hint }: { label: string; value: string; delta?: number; sub?: string; hint?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500, display: "flex", alignItems: "center" }}>
        {label}
        {hint && <InfoHint text={hint} />}
      </span>
      <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1 }}>{value}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {delta !== undefined && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11.5, fontWeight: 600, color: delta >= 0 ? "#16894f" : "#c0392b" }}>
            <Icon name={delta >= 0 ? "chevronUp" : "caretDown"} size={12} strokeWidth={2.6} />
            {Math.abs(delta)}%
          </span>
        )}
        {sub && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</span>}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9a9f9a", padding: "10px 8px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "right", padding: "12px 8px", borderBottom: "1px solid var(--line)", fontSize: 12.5, fontVariantNumeric: "tabular-nums" };

export function WebAnalytics() {
  const o = getWebOverview();
  const products = getProductAnalytics();
  const pages = getPageStats();
  const sources = getTrafficSources();
  const devices = getDeviceSplit();
  const cities = getWebCities();
  const funnel = getOverallFunnel();
  const events = getEventCounts();

  const cityMax = Math.max(...cities.map((c) => c.visitors));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <WebViews />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        <WebKpi label="网站浏览量" value={fmtNumber(o.pv)} delta={o.pvDelta} sub="PV" hint="页面被打开的总次数，同一访客多次打开会重复计数。" />
        <WebKpi label="独立访客" value={fmtNumber(o.uv)} delta={o.uvDelta} sub="UV" hint="去重后的独立访客数，同一访客多次访问只算一次。" />
        <WebKpi label="新访客" value={fmtNumber(o.newVisitors)} sub={`占比 ${o.newRate}%`} hint="首次访问官网的访客数。" />
        <WebKpi label="产品点击" value={fmtNumber(o.productClicks)} sub={`点击率 ${o.ctr}%`} hint="用户从首页、产品列表、推荐位点击进入产品详情页的总次数。" />
        <WebKpi label="平均停留" value={o.avgStay} delta={o.avgStayDelta} hint="访客在官网的平均停留时长。" />
        <WebKpi label="下单转化" value={`${o.convRate}%`} sub={`咨询 ${o.inquiries}`} hint="下单人数 ÷ 独立访客。" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.85fr 1fr", gap: 16 }}>
        <WebTrend />
        <RatioDonut title="流量来源" subtitle="访客从哪里进入官网" centerValue={fmtNumber(o.uv)} centerLabel="独立访客" slices={sources} />
      </div>

      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>产品关注度排行</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>点击产品名查看单品转化漏斗</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>产品</th>
                <th style={th}>曝光<InfoHint text="产品被展示的次数（首页 / 列表 / 推荐位）。" /></th>
                <th style={th}>点击<InfoHint text="用户点击进入产品详情页的次数。" /></th>
                <th style={th}>点击率<InfoHint text="点击 ÷ 曝光。绝对点击量高不代表更受欢迎，点击率更能反映吸引力。" /></th>
                <th style={th}>加购</th>
                <th style={th}>下单</th>
                <th style={th}>转化率<InfoHint text="下单 ÷ 详情页深度浏览。" /></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="row-hover">
                  <td style={{ ...td, textAlign: "left" }}>
                    <Link href={`/analytics?view=web&product=${p.id}`} style={{ fontWeight: 600, color: "var(--accent)" }}>
                      {p.name}
                    </Link>
                  </td>
                  <td style={td}>{fmtNumber(p.impressions)}</td>
                  <td style={td}>{fmtNumber(p.clicks)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{pct(p.clicks, p.impressions)}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{fmtNumber(p.add_cart)}</td>
                  <td style={td}>{fmtNumber(p.orders)}</td>
                  <td style={{ ...td, color: "#16894f", fontWeight: 700 }}>{pct(p.orders, p.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>热门页面</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>用户最常访问与停留的页面</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>页面</th>
                <th style={th}>浏览量</th>
                <th style={th}>独立访客</th>
                <th style={th}>平均停留</th>
                <th style={th}>跳出率<InfoHint text="进入页面后直接离开的比例，越高说明页面越留不住人。" /></th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.page} className="row-hover">
                  <td style={{ ...td, textAlign: "left", fontWeight: 600, color: "#2c322e" }}>{p.page}</td>
                  <td style={td}>{fmtNumber(p.pv)}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{fmtNumber(p.uv)}</td>
                  <td style={td}>{p.avg_stay}</td>
                  <td style={{ ...td, color: p.bounce >= 45 ? "#c0392b" : "#4a514c", fontWeight: 600 }}>{p.bounce}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>访问地区 · 国内省市</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>访客数 / 产品点击 / 下单</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {cities.map((c) => (
              <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e" }}>{c.name}</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    <b style={{ color: "#2c322e" }}>{fmtNumber(c.visitors)}</b> 访客 · {fmtNumber(c.clicks)} 点击 · {c.orders} 单
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 5, background: "var(--bg)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 5, background: "var(--accent)", width: `${(c.visitors / cityMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>转化漏斗</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>访问 → 点击产品 → 加购 → 下单 → 支付</span>
          </div>
          <Funnel steps={funnel} />
        </Card>

        <RatioDonut title="访问设备" subtitle="移动端占比通常最高，需单独看" centerValue={`${devices[0].val}%`} centerLabel="手机占比" slices={devices} />
      </div>

      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>用户行为事件</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>记录用户在官网做了什么，还原「从哪来 → 看什么 → 点什么 → 是否成交」</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {events.map((e) => (
            <div key={e.event} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", borderRadius: 10, background: "var(--bg)", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 12.5, color: "#3a403c" }}>{e.event}</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtNumber(e.count)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TrackerHealth } from "./TrackerHealth";
import { Icon } from "@/components/ui/Icon";
import { InfoHint } from "@/components/ui/InfoHint";
import { RatioDonut } from "@/components/dashboard/RatioDonut";
import { fmtDuration, fmtNumber, fmtPercent, ratio } from "@/lib/tokens";
import {
  getDeviceSplit,
  getEventCounts,
  getOverallFunnel,
  getPageStats,
  getProductAnalytics,
  getTrafficSources,
  getWebCities,
  getWebOverview,
  getWebTrend,
  getWebViews,
  getTrackerHealth,
} from "@/lib/data/web";
import { loadSettings } from "@/lib/data/settings";
import { fetchWebSeriesAction } from "@/lib/actions/series";
import { WebViews } from "@/components/dashboard/WebViews";
import { WebTrend } from "./WebTrend";
import { Funnel } from "./Funnel";

function WebKpi({
  label,
  value,
  delta,
  sub,
  hint,
}: {
  label: string;
  value: string;
  delta?: number | null;
  sub?: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 12.5,
          color: "var(--muted)",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
        }}
      >
        {label}
        {hint && <InfoHint text={hint} />}
      </span>
      <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1 }}>{value}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {delta !== undefined && delta !== null && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              fontSize: 11.5,
              fontWeight: 600,
              color: delta >= 0 ? "#16894f" : "#c0392b",
            }}
          >
            <Icon name={delta >= 0 ? "chevronUp" : "caretDown"} size={12} strokeWidth={2.6} />
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</span>}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "right",
  fontSize: 11,
  fontWeight: 600,
  color: "#9a9f9a",
  padding: "10px 8px",
  borderBottom: "1px solid var(--line)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  textAlign: "right",
  padding: "12px 8px",
  borderBottom: "1px solid var(--line)",
  fontSize: 12.5,
  fontVariantNumeric: "tabular-nums",
};

export async function WebAnalytics() {
  const settings = await loadSettings();
  const days = 30;

  const [o, products, pages, sources, devices, cities, funnel, events, views, series, prevSeries, health] =
    await Promise.all([
      getWebOverview(days),
      getProductAnalytics(days),
      getPageStats(days),
      getTrafficSources(days),
      getDeviceSplit(days),
      getWebCities(days),
      getOverallFunnel(days),
      getEventCounts(days),
      getWebViews(),
      getWebTrend("pv", days),
      getWebTrend("pv", days * 2),
      getTrackerHealth(),
    ]);

  const prevTotal = prevSeries
    .slice(0, Math.max(0, prevSeries.length - series.length))
    .reduce((s, p) => s + p.value, 0);

  const cityMax = cities.length > 0 ? Math.max(...cities.map((c) => c.visitors)) : 0;
  const mobile = devices.find((d) => d.label === "手机");
  const deviceTotal = devices.reduce((s, d) => s + d.val, 0);
  const mobilePct = mobile && deviceTotal > 0 ? (mobile.val / deviceTotal) * 100 : null;

  const hasAnyData = o.pv > 0 || o.uv > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <WebViews data={views} />

      <TrackerHealth health={health} />

      {!hasAnyData && (
        <Card style={{ background: "#fff7ec", border: "1px solid #f2e2c4" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <Icon name="alert" size={16} color="#b45309" style={{ flex: "none", marginTop: 2 }} />
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#8a5a12" }}>
              <b>还没有收到官网埋点数据。</b>
              <br />
              页面浏览已经在上报给 Vercel Web Analytics（Vercel 控制台 → Analytics）。
              要让本页的漏斗、来源、地域、单品数据也变成真实数字，在官网
              <code>&lt;/body&gt;</code> 前加这一行就够了：
              <br />
              <code style={{ fontSize: 11.5 }}>
                {`<script defer src="https://<后台域名>/guiye-track.js" data-endpoint="https://<后台域名>/api/analytics/collect"></script>`}
              </code>
              <br />
              商品详情页再标一个 <code>&lt;body data-gy-product=&quot;商品ID&quot;&gt;</code>，
              单品漏斗和平均停留就有数据了。
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        <WebKpi
          label="网站浏览量"
          value={fmtNumber(o.pv)}
          delta={o.pvDelta}
          sub="PV"
          hint="页面被打开的总次数，同一访客多次打开会重复计数。"
        />
        <WebKpi
          label="独立访客"
          value={fmtNumber(o.uv)}
          delta={o.uvDelta}
          sub={o.uvExact ? "UV" : "UV · 每日相加"}
          hint={
            o.uvExact
              ? "整个区间内去重后的访客数，同一访客访问多天也只算一次。"
              : "埋点明细已超出保留期，此处为各日 UV 相加，回访客会被重复计数。"
          }
        />
        <WebKpi
          label="新访客"
          value={fmtNumber(o.newVisitors)}
          sub={`占比 ${fmtPercent(o.newRate)}`}
          hint="首次访问官网的访客数。"
        />
        <WebKpi
          label="产品点击"
          value={fmtNumber(o.productClicks)}
          sub={`点击率 ${fmtPercent(o.ctr)}`}
          hint="用户点击进入产品详情页的次数 ÷ 页面浏览量。"
        />
        <WebKpi
          label="平均停留"
          value={fmtDuration(o.avgStaySeconds)}
          sub={`跳出率 ${fmtPercent(o.bounceRate)}`}
          hint="访客在官网的平均停留时长，来自 page_leave 埋点。"
        />
        <WebKpi
          label="下单转化"
          value={fmtPercent(o.convRate)}
          sub={`咨询 ${fmtNumber(o.inquiries)}`}
          hint="支付成功人数 ÷ 独立访客。"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.85fr 1fr", gap: 16 }}>
        <WebTrend
          initialSeries={series}
          initialPrevTotal={prevTotal}
          fetchSeries={fetchWebSeriesAction}
        />
        <RatioDonut
          title="流量来源"
          subtitle="访客从哪里进入官网"
          centerValue={fmtNumber(o.uv)}
          centerLabel="独立访客"
          slices={sources}
        />
      </div>

      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>产品关注度排行</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>点击产品名查看单品转化漏斗</span>
        </div>
        {products.length === 0 ? (
          <div style={{ padding: "26px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
            暂无产品埋点数据
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>产品</th>
                  <th style={th}>
                    曝光
                    <InfoHint text="产品被展示的次数（首页 / 列表 / 推荐位）。" />
                  </th>
                  <th style={th}>
                    点击
                    <InfoHint text="用户点击进入产品详情页的次数。" />
                  </th>
                  <th style={th}>
                    点击率
                    <InfoHint text="点击 ÷ 曝光。绝对点击量高不代表更受欢迎，点击率更能反映吸引力。" />
                  </th>
                  <th style={th}>加购</th>
                  <th style={th}>下单</th>
                  <th style={th}>
                    下单转化
                    <InfoHint text="下单 ÷ 详情页深度浏览。注意与单品页的「转化率（支付 ÷ 曝光）」口径不同。" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="row-hover">
                    <td style={{ ...td, textAlign: "left" }}>
                      <Link
                        href={`/analytics?view=web&product=${encodeURIComponent(p.id)}`}
                        style={{ fontWeight: 600, color: "var(--accent)" }}
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td style={td}>{fmtNumber(p.impressions)}</td>
                    <td style={td}>{fmtNumber(p.clicks)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmtPercent(ratio(p.clicks, p.impressions))}</td>
                    <td style={{ ...td, color: "var(--muted)" }}>{fmtNumber(p.add_cart)}</td>
                    <td style={td}>{fmtNumber(p.orders)}</td>
                    <td style={{ ...td, color: "#16894f", fontWeight: 700 }}>
                      {fmtPercent(ratio(p.orders, p.views))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>热门页面</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>用户最常访问与停留的页面</span>
          </div>
          {pages.length === 0 ? (
            <div style={{ padding: "22px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
              暂无页面数据
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>页面</th>
                  <th style={th}>浏览量</th>
                  <th style={th}>独立访客</th>
                  <th style={th}>平均停留</th>
                  <th style={th}>
                    跳出率
                    <InfoHint text="进入页面后直接离开的比例，越高说明页面越留不住人。告警线可在系统设置调整。" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.page} className="row-hover">
                    <td style={{ ...td, textAlign: "left", fontWeight: 600, color: "#2c322e" }}>{p.page}</td>
                    <td style={td}>{fmtNumber(p.pv)}</td>
                    <td style={{ ...td, color: "var(--muted)" }}>{fmtNumber(p.uv)}</td>
                    <td style={td}>{fmtDuration(p.avg_stay_seconds)}</td>
                    <td
                      style={{
                        ...td,
                        color: p.bounce >= settings.analytics.bounceAlert ? "#c0392b" : "#4a514c",
                        fontWeight: 600,
                      }}
                    >
                      {fmtPercent(p.bounce, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>访问地区 · 国内省市</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>访客数 / 产品点击 / 下单</span>
          </div>
          {cities.length === 0 ? (
            <div style={{ padding: "22px 0", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
              暂无地域数据
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {cities.map((c) => (
                <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2c322e" }}>{c.name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      <b style={{ color: "#2c322e" }}>{fmtNumber(c.visitors)}</b> 访客 ·{" "}
                      {fmtNumber(c.clicks)} 点击 · {c.orders} 单
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 5, background: "var(--bg)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 5,
                        background: "var(--accent)",
                        width: `${cityMax > 0 ? (c.visitors / cityMax) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>转化漏斗</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              访问 → 点击产品 → 加购 → 下单 → 支付
            </span>
          </div>
          <Funnel
            steps={funnel}
            good={settings.analytics.funnelGood}
            warn={settings.analytics.funnelWarn}
          />
        </Card>

        <RatioDonut
          title="访问设备"
          subtitle="移动端占比通常最高，需单独看"
          centerValue={mobilePct === null ? "—" : fmtPercent(mobilePct, 0)}
          centerLabel="手机占比"
          slices={devices}
        />
      </div>

      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>用户行为事件</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            事件字典存在 web_event_types 表，官网新增一个按钮只需加一行数据，不必改代码发版
          </span>
        </div>
        {events.length === 0 ? (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>暂无事件数据</span>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {events.map((e) => (
              <div
                key={e.event_key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 13px",
                  borderRadius: 10,
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                }}
              >
                <span style={{ fontSize: 12.5, color: "#3a403c" }}>{e.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {fmtNumber(e.count)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

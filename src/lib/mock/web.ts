import type { ChannelSlice, FunnelStep, PageStat, ProductAnalytics, WebCity } from "../types";

// 官网整体数据（本月）。PV = 页面被打开次数；UV = 去重访客数。
export const webOverview = {
  pv: 28460,
  pvDelta: 18.6,
  uv: 12385,
  uvDelta: 11.2,
  newVisitors: 7920,
  newRate: 63.9, // 新访客占比
  productClicks: 8642,
  ctr: 30.4, // 产品点击率
  avgStay: "2分18秒",
  avgStayDelta: 6.4,
  inquiries: 126, // 咨询提交
  convRate: 3.7, // 下单转化
};

// 阅览量 · 当日 / 本月 / 累计（PV + UV）。
export const webViews = {
  pvToday: 1284,
  pvTodayDelta: 8.2, // 较昨日
  uvToday: 612,
  pvMonth: 28460,
  pvMonthDelta: 18.6, // 较上月
  uvMonth: 12385,
  pvTotal: 486200, // 累计（上线至今）
  uvTotal: 198400,
  since: "2025-09 上线至今",
};

// 每个产品的官网表现。点击率 = 点击 ÷ 曝光；转化率 = 支付 ÷ 详情浏览。
export const productAnalytics: ProductAnalytics[] = [
  { id: "wp-1", name: "Rose Field 350ml", impressions: 12860, clicks: 4642, views: 2897, add_cart: 527, orders: 224, paid: 175 },
  { id: "wp-2", name: "Rose Tisane 50g", impressions: 9200, clicks: 3210, views: 1980, add_cart: 372, orders: 138, paid: 112 },
  { id: "wp-3", name: "Rose Field 50ml", impressions: 7600, clicks: 2495, views: 1642, add_cart: 356, orders: 156, paid: 128 },
  { id: "wp-4", name: "香薰系列", impressions: 5400, clicks: 1344, views: 760, add_cart: 92, orders: 30, paid: 22 },
  { id: "wp-5", name: "礼盒系列", impressions: 4100, clicks: 1180, views: 705, add_cart: 84, orders: 41, paid: 33 },
];

// 官网各页面表现。
export const pageStats: PageStat[] = [
  { page: "首页", pv: 18620, uv: 10280, avg_stay: "1:28", bounce: 42 },
  { page: "Rose Field 产品页", pv: 6420, uv: 4718, avg_stay: "2:36", bounce: 31 },
  { page: "Rose Tisane 产品页", pv: 4860, uv: 3465, avg_stay: "2:18", bounce: 36 },
  { page: "品牌故事", pv: 3860, uv: 2791, avg_stay: "3:12", bounce: 28 },
  { page: "联系我们", pv: 1420, uv: 1110, avg_stay: "1:06", bounce: 51 },
];

// 流量来源（口径一：客户从哪里进入官网）。
export const trafficSources: ChannelSlice[] = [
  { label: "微信", val: 26, color: "#2f7d4f" },
  { label: "小红书", val: 20, color: "#c0392b" },
  { label: "直接访问", val: 16, color: "var(--accent)" },
  { label: "搜索引擎", val: 12, color: "#2b6cb0" },
  { label: "抖音", val: 10, color: "#3a403c" },
  { label: "Instagram", val: 8, color: "#8a6fb0" },
  { label: "展会二维码", val: 5, color: "#b07d18" },
  { label: "其他外链", val: 3, color: "#cdd2cb" },
];

// 访问设备（手机端占比通常最高，需单独看移动端表现）。
export const deviceSplit: ChannelSlice[] = [
  { label: "手机", val: 72, color: "var(--accent)" },
  { label: "电脑", val: 22, color: "#2b6cb0" },
  { label: "平板", val: 6, color: "#e0a44a" },
];

// 访问地域 · 国内省市。
export const webCities: WebCity[] = [
  { name: "苏州", visitors: 1860, clicks: 742, orders: 82 },
  { name: "上海", visitors: 1540, clicks: 618, orders: 61 },
  { name: "北京", visitors: 1220, clicks: 503, orders: 45 },
  { name: "杭州", visitors: 980, clicks: 420, orders: 37 },
  { name: "广州", visitors: 760, clicks: 312, orders: 28 },
  { name: "成都", visitors: 640, clicks: 265, orders: 22 },
];

// 官网整体转化漏斗：访问 → 点击产品 → 加购 → 下单 → 支付。
export const overallFunnel: FunnelStep[] = [
  { label: "访问官网", count: 28460 },
  { label: "点击产品", count: 8642 },
  { label: "加入购物车", count: 1431 },
  { label: "提交订单", count: 589 },
  { label: "支付成功", count: 470 },
];

// 用户行为事件（本月触发次数）。
export const eventCounts: { event: string; count: number }[] = [
  { event: "点击产品", count: 8642 },
  { event: "查看产品详情", count: 6120 },
  { event: "播放视频", count: 540 },
  { event: "视频观看完成", count: 318 },
  { event: "点击品牌故事", count: 386 },
  { event: "加入购物车", count: 1431 },
  { event: "开始结账", count: 712 },
  { event: "支付成功", count: 470 },
  { event: "点击微信", count: 210 },
  { event: "点击 WhatsApp", count: 96 },
  { event: "提交联系表单", count: 126 },
  { event: "下载产品资料", count: 84 },
];

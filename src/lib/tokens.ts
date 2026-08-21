// Shared palette helpers for status / source tags.
//
// 这些 Record 是**内置默认值**：它们保证每个合法取值都有中文名和配色（TS 会检查
// 完整性）。运营在系统设置里改的标签存在 Supabase 的 dictionaries 表，运行时覆盖
// 这里的默认值 —— 见 src/lib/dict.ts 与 src/lib/data/dict.ts。
//
// 重要：不要再直接 `ORDER_STATUS[value]` 索引。数据库返回的字符串不受 TS 约束，
// 未知取值会得到 undefined 并在 `.text` 处抛错。统一用 toneOr() / useDict()。

import type {
  OrderSource,
  OrderStatus,
  OrderType,
  OrderChannel,
  CustomerSource,
  PaymentMethod,
  PayStatus,
  FulfillStatus,
  SettleStatus as OrderSettleStatus,
  RefundStatus,
  AdminLevel,
  AdminStatus,
  DealerStatus,
  ShipmentStatus,
  SettlementStatus,
} from "./types";

export interface Tone {
  text: string;
  color: string;
  bg: string;
}

/** 未知 / 缺失取值的兜底样式 —— 永远不要让字典查找抛错。 */
export const UNKNOWN_TONE: Tone = { text: "未知", color: "#6b716d", bg: "#f1f2f0" };

/** 总函数式字典查找。`code` 可以是 null / 未知字符串。 */
export function toneOr(
  map: Record<string, Tone> | undefined,
  code: string | null | undefined,
  fallbackText?: string,
): Tone {
  if (!code) return fallbackText ? { ...UNKNOWN_TONE, text: fallbackText } : UNKNOWN_TONE;
  const hit = map?.[code];
  if (hit) return hit;
  return { ...UNKNOWN_TONE, text: fallbackText ?? code };
}

export const ORDER_STATUS: Record<OrderStatus, Tone> = {
  pending: { text: "待付款", color: "#6b716d", bg: "#f1f2f0" },
  review: { text: "待审核", color: "#b45309", bg: "#fff7ec" },
  assign: { text: "待分配", color: "#2b6cb0", bg: "#eef4ff" },
  prep: { text: "备货中", color: "#8a6fb0", bg: "#f4f0fa" },
  shipped: { text: "已发货", color: "#1f7a5c", bg: "#e9f5ef" },
  signed: { text: "已签收", color: "#16894f", bg: "#e9f7ef" },
  settled: { text: "已结算", color: "#4a514c", bg: "#eef0ed" },
  refund: { text: "已退款", color: "#c0392b", bg: "#fdf0ef" },
};

export const ORDER_SOURCE: Record<OrderSource, Tone> = {
  web: { text: "GUIYE 官网", color: "#1f7a5c", bg: "#e9f5ef" },
  dealer: { text: "经销商代下单", color: "#c2703d", bg: "#fbf0e6" },
  fair: { text: "展会现场", color: "#b07d18", bg: "#fbf4e3" },
  whatsapp: { text: "WhatsApp", color: "#1f8a5b", bg: "#e7f6ee" },
  instagram: { text: "Instagram", color: "#8a6fb0", bg: "#f3eefa" },
  wechat: { text: "微信", color: "#2f7d4f", bg: "#e9f4ec" },
  wholesale: { text: "批发订单", color: "#5b6470", bg: "#eef0f2" },
};

export const DEALER_STATUS: Record<DealerStatus, Tone> = {
  active: { text: "合作中", color: "#16894f", bg: "#e9f5ef" },
  pending: { text: "待审核", color: "#b45309", bg: "#fff7ec" },
  suspended: { text: "已暂停", color: "#c0392b", bg: "#fdf0ef" },
};

export const SHIPMENT_STATUS: Record<ShipmentStatus, Tone> = {
  preparing: { text: "备货中", color: "#8a6fb0", bg: "#f4f0fa" },
  in_transit: { text: "运输中", color: "#2b6cb0", bg: "#eef4ff" },
  customs: { text: "清关中", color: "#b45309", bg: "#fff7ec" },
  delivered: { text: "已送达", color: "#16894f", bg: "#e9f5ef" },
  exception: { text: "异常", color: "#c0392b", bg: "#fdf0ef" },
};

export const SETTLEMENT_STATUS: Record<SettlementStatus, Tone> = {
  pending: { text: "待结算", color: "#b45309", bg: "#fff7ec" },
  paid: { text: "已结清", color: "#16894f", bg: "#e9f5ef" },
  overdue: { text: "已逾期", color: "#c0392b", bg: "#fdf0ef" },
};

export const SETTLEMENT_TYPE: Record<string, Tone> = {
  dealer_payout: { text: "渠道结算", color: "#c2703d", bg: "#fbf0e6" },
  refund: { text: "退款", color: "#c0392b", bg: "#fdf0ef" },
  receivable: { text: "应收账款", color: "#2b6cb0", bg: "#eef4ff" },
  invoice: { text: "开票", color: "#5b6470", bg: "#eef0f2" },
};

// ---- Order Center: separated dimensions & status lines ----

export const ORDER_TYPE: Record<OrderType, Tone> = {
  retail: { text: "零售订单", color: "#1f7a5c", bg: "#e9f5ef" },
  channel: { text: "渠道订单", color: "#c2703d", bg: "#fbf0e6" },
  enterprise: { text: "企业采购", color: "#2b6cb0", bg: "#eef4ff" },
  sample: { text: "样品订单", color: "#8a6fb0", bg: "#f4f0fa" },
  event: { text: "活动订单", color: "#b07d18", bg: "#fbf4e3" },
  reissue: { text: "售后补发", color: "#5b6470", bg: "#eef0f2" },
};

export const ORDER_CHANNEL: Record<OrderChannel, Tone> = {
  web_store: { text: "官网商城", color: "#1f7a5c", bg: "#e9f5ef" },
  wechat_store: { text: "微信商城", color: "#2f7d4f", bg: "#e9f4ec" },
  backend: { text: "后台代下单", color: "#c2703d", bg: "#fbf0e6" },
  offline_pos: { text: "线下收银", color: "#b07d18", bg: "#fbf4e3" },
  api: { text: "API 导入", color: "#5b6470", bg: "#eef0f2" },
};

export const CUSTOMER_SOURCE: Record<CustomerSource, Tone> = {
  wechat: { text: "微信", color: "#2f7d4f", bg: "#e9f4ec" },
  xhs: { text: "小红书", color: "#c0392b", bg: "#fdf0ef" },
  instagram: { text: "Instagram", color: "#8a6fb0", bg: "#f3eefa" },
  whatsapp: { text: "WhatsApp", color: "#1f8a5b", bg: "#e7f6ee" },
  fair: { text: "展会", color: "#b07d18", bg: "#fbf4e3" },
  referral: { text: "转介绍", color: "#c2703d", bg: "#fbf0e6" },
  organic: { text: "自然搜索", color: "#5b6470", bg: "#eef0f2" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, Tone> = {
  wechat_pay: { text: "微信支付", color: "#2f7d4f", bg: "#e9f4ec" },
  alipay: { text: "支付宝", color: "#2b6cb0", bg: "#eef4ff" },
  unionpay: { text: "银联", color: "#c0392b", bg: "#fdf0ef" },
  bank_transfer: { text: "银行转账", color: "#5b6470", bg: "#eef0f2" },
  offline: { text: "线下收款", color: "#b07d18", bg: "#fbf4e3" },
  credit_term: { text: "账期", color: "#8a6fb0", bg: "#f4f0fa" },
  unpaid: { text: "未支付", color: "#6b716d", bg: "#f1f2f0" },
};

export const PAY_STATUS: Record<PayStatus, Tone> = {
  unpaid: { text: "待支付", color: "#6b716d", bg: "#f1f2f0" },
  paying: { text: "支付中", color: "#2b6cb0", bg: "#eef4ff" },
  paid: { text: "支付成功", color: "#16894f", bg: "#e9f5ef" },
  failed: { text: "支付失败", color: "#c0392b", bg: "#fdf0ef" },
  partial_refund: { text: "部分退款", color: "#b45309", bg: "#fff7ec" },
  refunded: { text: "已退款", color: "#c0392b", bg: "#fdf0ef" },
  pay_exception: { text: "支付异常", color: "#c0392b", bg: "#fdf0ef" },
};

export const FULFILL_STATUS: Record<FulfillStatus, Tone> = {
  assign: { text: "待分配", color: "#2b6cb0", bg: "#eef4ff" },
  prep: { text: "备货中", color: "#8a6fb0", bg: "#f4f0fa" },
  wait_ship: { text: "待发货", color: "#b45309", bg: "#fff7ec" },
  shipped: { text: "已发货", color: "#1f7a5c", bg: "#e9f5ef" },
  signed: { text: "已签收", color: "#16894f", bg: "#e9f7ef" },
  fulfill_exception: { text: "发货异常", color: "#c0392b", bg: "#fdf0ef" },
};

export const SETTLE_STATUS: Record<OrderSettleStatus, Tone> = {
  unsettled: { text: "未结算", color: "#6b716d", bg: "#f1f2f0" },
  reconciling: { text: "对账中", color: "#2b6cb0", bg: "#eef4ff" },
  settled: { text: "已结算", color: "#16894f", bg: "#e9f5ef" },
  settle_exception: { text: "结算异常", color: "#c0392b", bg: "#fdf0ef" },
};

export const REFUND_STATUS: Record<RefundStatus, Tone> = {
  applying: { text: "申请中", color: "#6b716d", bg: "#f1f2f0" },
  reviewing: { text: "审核中", color: "#b45309", bg: "#fff7ec" },
  processing: { text: "处理中", color: "#2b6cb0", bg: "#eef4ff" },
  success: { text: "退款成功", color: "#16894f", bg: "#e9f5ef" },
  reconciled: { text: "对账完成", color: "#1f7a5c", bg: "#e9f7ef" },
  rejected: { text: "已驳回", color: "#c0392b", bg: "#fdf0ef" },
};

// ---- Admin levels & account status ----

export const ADMIN_LEVEL: Record<AdminLevel, Tone> = {
  L1: { text: "一级", color: "#b07d18", bg: "#fbf4e3" },
  L2: { text: "二级", color: "#2b6cb0", bg: "#eef4ff" },
  L3: { text: "三级", color: "#5b6470", bg: "#eef0f2" },
};

export const ADMIN_STATUS: Record<AdminStatus, Tone> = {
  pending: { text: "待激活", color: "#b45309", bg: "#fff7ec" },
  active: { text: "正常", color: "#16894f", bg: "#e9f5ef" },
  suspended: { text: "暂停使用", color: "#b45309", bg: "#fff7ec" },
  locked: { text: "已锁定", color: "#c0392b", bg: "#fdf0ef" },
  resigned: { text: "已离职", color: "#6b716d", bg: "#f1f2f0" },
  closed: { text: "已注销", color: "#6b716d", bg: "#f1f2f0" },
};

// 手机号脱敏。可见完整号码的最低等级由 security.mask_phone_min_level 配置决定。
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return phone;
  return `${d.slice(0, 3)}****${d.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const head = name.slice(0, Math.min(2, name.length));
  return `${head}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

const LEVEL_RANK: Record<AdminLevel, number> = { L1: 3, L2: 2, L3: 1 };

/** 该等级是否可以看到完整手机号 / 邮箱。 */
export function canSeeFullContact(
  level: AdminLevel,
  minLevel: AdminLevel = "L2",
): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

// Deterministic avatar palette (matches the prototype's `av` array).
export const AVATAR_TONES: { bg: string; color: string }[] = [
  { bg: "#e7f1ec", color: "#1f7a5c" },
  { bg: "#fbf0e6", color: "#b06028" },
  { bg: "#fbf4e3", color: "#9a7016" },
  { bg: "#f3eefa", color: "#6f53a0" },
  { bg: "#eaf1f7", color: "#2b6cb0" },
  { bg: "#fdeeec", color: "#b03a2e" },
];

export function avatarTone(seed: number) {
  return AVATAR_TONES[Math.abs(seed) % AVATAR_TONES.length];
}

/** 名字首字母，空值安全。 */
export function initial(name: string | null | undefined): string {
  return name && name.length > 0 ? name[0] : "?";
}

export const TONE_BG: Record<string, string> = {
  accent: "var(--accent-soft)",
  clay: "#fff5ec",
  amber: "#fff7ec",
  blue: "#eef4ff",
  red: "#fdf0ef",
  violet: "#f4f0fa",
};

export const TONE_FG: Record<string, string> = {
  accent: "var(--accent)",
  clay: "#c2703d",
  amber: "#b45309",
  blue: "#2b6cb0",
  red: "#c0392b",
  violet: "#8a6fb0",
};

// ---- 数值 / 时间格式化 -------------------------------------------------------

export interface CurrencyOptions {
  /** 小数位。默认 0（整单金额）；手续费等小额传 2，否则明细与合计对不上。 */
  decimals?: number;
  symbol?: string;
}

export function fmtCurrency(n: number | null | undefined, opts: CurrencyOptions = {}): string {
  const { decimals = 0, symbol = "¥" } = opts;
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return (
    symbol +
    v.toLocaleString("zh-CN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

/** 金额精确显示：有小数就显示 2 位，没有就显示整数。 */
export function fmtMoney(n: number | null | undefined, symbol = "¥"): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return fmtCurrency(v, { decimals: Number.isInteger(v) ? 0 : 2, symbol });
}

export function fmtNumber(n: number | null | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.round(v).toLocaleString("zh-CN");
}

export function fmtPercent(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(decimals)}%`;
}

/** 安全的百分比：分母为 0 时返回 null 而不是 NaN / Infinity。 */
export function ratio(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 秒 → "2分18秒"（统一口径，取代 "2:36" 与 "2分36秒" 混用）。 */
export function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}分${pad(s % 60)}秒` : `${s}秒`;
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return fmtDate(iso);
}

/** 距今天数（负数 = 已逾期）。 */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

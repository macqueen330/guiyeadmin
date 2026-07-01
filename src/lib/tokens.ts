// Shared palette helpers for status / source tags, kept in one place so every
// module renders the same colors as the original design.

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

export const SETTLEMENT_TYPE: Record<string, string> = {
  dealer_payout: "渠道结算",
  refund: "退款",
  receivable: "应收账款",
  invoice: "开票",
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

// 手机号脱敏（三级默认脱敏；一级 / 授权财务可见完整）。
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return phone;
  return `${d.slice(0, 3)}****${d.slice(-4)}`;
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
  return AVATAR_TONES[seed % AVATAR_TONES.length];
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

export function fmtCurrency(n: number): string {
  return "¥" + Math.round(n).toLocaleString("en-US");
}

export function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// Shared palette helpers for status / source tags, kept in one place so every
// module renders the same colors as the original design.

import type {
  OrderSource,
  OrderStatus,
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

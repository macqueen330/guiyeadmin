// 运行时业务字典：内置默认值 + Supabase `dictionaries` 表的覆盖。
//
// 为什么需要这一层：原来「订单状态」等 16 张映射表写死在 tokens.ts，运营想把
// 「待付款」改成「待支付」就得改代码发版。现在标签 / 配色 / 排序 / 启用状态都存库，
// 页面通过 useDict()（客户端）或 loadDict()（服务端）读取，默认值只作兜底。
//
// 取值集合（code）仍由 TS 联合类型约束 —— 那是数据完整性问题，不是运营配置。

import {
  ADMIN_LEVEL,
  ADMIN_STATUS,
  CUSTOMER_SOURCE,
  DEALER_STATUS,
  FULFILL_STATUS,
  ORDER_CHANNEL,
  ORDER_SOURCE,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAY_STATUS,
  REFUND_STATUS,
  SETTLEMENT_STATUS,
  SETTLEMENT_TYPE,
  SETTLE_STATUS,
  SHIPMENT_STATUS,
  toneOr,
  type Tone,
} from "./tokens";

export type DictGroup =
  | "order_status"
  | "order_source"
  | "order_type"
  | "order_channel"
  | "customer_source"
  | "payment_method"
  | "pay_status"
  | "fulfill_status"
  | "settle_status"
  | "refund_status"
  | "shipment_status"
  | "settlement_status"
  | "settlement_type"
  | "dealer_status"
  | "admin_level"
  | "admin_status";

export type DictMap = Record<string, Tone>;
export type DictMaps = Record<string, DictMap>;

/** 内置默认字典 —— 与 supabase/seed_reference.sql 的初始行一致。 */
export const DEFAULT_DICT: DictMaps = {
  order_status: ORDER_STATUS,
  order_source: ORDER_SOURCE,
  order_type: ORDER_TYPE,
  order_channel: ORDER_CHANNEL,
  customer_source: CUSTOMER_SOURCE,
  payment_method: PAYMENT_METHOD,
  pay_status: PAY_STATUS,
  fulfill_status: FULFILL_STATUS,
  settle_status: SETTLE_STATUS,
  refund_status: REFUND_STATUS,
  shipment_status: SHIPMENT_STATUS,
  settlement_status: SETTLEMENT_STATUS,
  settlement_type: SETTLEMENT_TYPE,
  dealer_status: DEALER_STATUS,
  admin_level: ADMIN_LEVEL,
  admin_status: ADMIN_STATUS,
};

export const DICT_GROUP_NAMES: Record<DictGroup, string> = {
  order_status: "订单总状态",
  order_source: "订单来源",
  order_type: "订单类型",
  order_channel: "下单渠道",
  customer_source: "客户来源",
  payment_method: "支付方式",
  pay_status: "支付状态",
  fulfill_status: "履约状态",
  settle_status: "结算状态",
  refund_status: "退款状态",
  shipment_status: "物流状态",
  settlement_status: "结算单状态",
  settlement_type: "结算单类型",
  dealer_status: "经销商状态",
  admin_level: "管理员等级",
  admin_status: "管理员账号状态",
};

/** 字典行在界面上的顺序（DB 的 sort 优先，缺失时按内置顺序）。 */
export interface DictOption {
  value: string;
  label: string;
  tone: Tone;
}

/** 覆盖顺序：DB 行 > 内置默认。DB 里 is_active=false 的取值不出现在下拉里。 */
export function mergeDict(
  defaults: DictMaps,
  rows: {
    group_key: string;
    code: string;
    label: string;
    color: string;
    bg: string;
    sort: number;
    is_active: boolean;
  }[],
): { maps: DictMaps; order: Record<string, string[]> } {
  const maps: DictMaps = {};
  const order: Record<string, string[]> = {};

  for (const [group, map] of Object.entries(defaults)) {
    maps[group] = { ...map };
    order[group] = Object.keys(map);
  }

  const sorted = [...rows].sort((a, b) => a.sort - b.sort);
  const dbOrder: Record<string, string[]> = {};
  for (const r of sorted) {
    (maps[r.group_key] ??= {})[r.code] = { text: r.label, color: r.color, bg: r.bg };
    if (r.is_active) (dbOrder[r.group_key] ??= []).push(r.code);
  }
  for (const [group, codes] of Object.entries(dbOrder)) {
    if (codes.length > 0) order[group] = codes;
  }
  return { maps, order };
}

export interface Dict {
  maps: DictMaps;
  order: Record<string, string[]>;
}

export const DEFAULT_DICT_BUNDLE: Dict = {
  maps: DEFAULT_DICT,
  order: Object.fromEntries(
    Object.entries(DEFAULT_DICT).map(([g, m]) => [g, Object.keys(m)]),
  ),
};

export function dictTone(dict: Dict, group: DictGroup | string, code: string | null | undefined): Tone {
  return toneOr(dict.maps[group], code);
}

export function dictLabel(
  dict: Dict,
  group: DictGroup | string,
  code: string | null | undefined,
  fallback = "—",
): string {
  if (!code) return fallback;
  return dict.maps[group]?.[code]?.text ?? code;
}

export function dictOptions(dict: Dict, group: DictGroup | string): DictOption[] {
  const map = dict.maps[group] ?? {};
  const codes = dict.order[group] ?? Object.keys(map);
  return codes
    .filter((c) => map[c])
    .map((c) => ({ value: c, label: map[c].text, tone: map[c] }));
}

/** 给 FilterableTable 用的「全部 + 各取值」下拉项。 */
export function dictFilterOptions(
  dict: Dict,
  group: DictGroup | string,
  allLabel = "全部",
): { value: string; label: string }[] {
  return [
    { value: "all", label: allLabel },
    ...dictOptions(dict, group).map((o) => ({ value: o.value, label: o.label })),
  ];
}

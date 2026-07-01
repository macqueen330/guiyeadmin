import type { IconName } from "@/components/ui/Icon";

// A second-level menu entry. `view` is the query value carried on the parent
// route (`/orders?view=retail`); the entry marked `default` owns the bare route
// (`/orders`) so the parent link and its first child resolve to the same place.
export interface SubNavItem {
  key: string;
  label: string;
  view: string;
  default?: boolean;
}

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  badge?: { text: string; tone: "accent" | "red" };
  title: string;
  subtitle: string;
  children?: SubNavItem[];
}

// `label` is optional — the 首页 and 系统 groups render without a section title,
// matching the spec's "分组逻辑可以不显示标题" guidance.
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Information architecture per the restructure spec (section 八 / 十二):
// 首页 · 交易管理 · 客户经营 · 品牌运营 · 经营管理 · 系统，ordered by how often
// each module is touched day-to-day.
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        key: "home",
        label: "首页概览",
        href: "/",
        icon: "home",
        title: "首页概览",
        subtitle: "今天要处理的订单、客户、库存与回款",
      },
    ],
  },
  {
    label: "交易管理",
    items: [
      {
        key: "orders",
        label: "订单中心",
        href: "/orders",
        icon: "bag",
        badge: { text: "128", tone: "accent" },
        title: "订单中心",
        subtitle: "零售、渠道、企业采购与售后的全量订单",
        children: [
          { key: "all", label: "全部订单", view: "all", default: true },
          { key: "retail", label: "零售订单", view: "retail" },
          { key: "channel", label: "渠道订单", view: "channel" },
          { key: "enterprise", label: "企业采购", view: "enterprise" },
          { key: "refund", label: "售后退款", view: "refund" },
          { key: "exception", label: "发货异常", view: "exception" },
        ],
      },
      {
        key: "inventory",
        label: "商品与库存",
        href: "/inventory",
        icon: "box",
        title: "商品与库存",
        subtitle: "商品资料、SKU、多档价格与多仓库存",
        children: [
          { key: "products", label: "商品管理", view: "products", default: true },
          { key: "pricing", label: "价格管理", view: "pricing" },
          { key: "stock", label: "库存管理", view: "stock" },
          { key: "moves", label: "入库出库", view: "moves" },
          { key: "alerts", label: "库存预警", view: "alerts" },
        ],
      },
      {
        key: "logistics",
        label: "仓储物流",
        href: "/logistics",
        icon: "truck",
        badge: { text: "3", tone: "red" },
        title: "仓储物流",
        subtitle: "待发货、物流跟踪、仓库与异常包裹",
        children: [
          { key: "pending", label: "待发货", view: "pending", default: true },
          { key: "tracking", label: "物流跟踪", view: "tracking" },
          { key: "warehouse", label: "仓库管理", view: "warehouse" },
          { key: "exception", label: "异常包裹", view: "exception" },
        ],
      },
    ],
  },
  {
    label: "客户经营",
    items: [
      {
        key: "crm",
        label: "客户中心",
        href: "/crm",
        icon: "users",
        title: "客户中心",
        subtitle: "消费者、会员、标签与消费记录",
        children: [
          { key: "consumers", label: "消费者", view: "consumers", default: true },
          { key: "members", label: "会员", view: "members" },
          { key: "tags", label: "客户标签", view: "tags" },
          { key: "records", label: "消费记录", view: "records" },
        ],
      },
      {
        key: "channel",
        label: "渠道管理",
        href: "/channel",
        icon: "share",
        badge: { text: "5", tone: "red" },
        title: "渠道管理",
        subtitle: "合作客户、跟进、报价与合同（通用 CRM）",
        children: [
          { key: "clients", label: "渠道客户", view: "clients", default: true },
          { key: "apply", label: "合作申请", view: "apply" },
          { key: "followup", label: "跟进记录", view: "followup" },
          { key: "quote", label: "报价管理", view: "quote" },
          { key: "sample", label: "样品寄送", view: "sample" },
          { key: "contract", label: "合同资料", view: "contract" },
        ],
      },
    ],
  },
  {
    label: "品牌运营",
    items: [
      {
        key: "brand",
        label: "品牌内容",
        href: "/brand",
        icon: "file",
        title: "品牌内容",
        subtitle: "官网内容、图片视频、宣传与多语言素材",
        children: [
          { key: "website", label: "官网内容", view: "website", default: true },
          { key: "media", label: "图片视频", view: "media" },
          { key: "promo", label: "宣传资料", view: "promo" },
          { key: "channel", label: "渠道资料", view: "channel" },
          { key: "i18n", label: "多语言内容", view: "i18n" },
        ],
      },
    ],
  },
  {
    label: "经营管理",
    items: [
      {
        key: "finance",
        label: "财务结算",
        href: "/finance",
        icon: "dollar",
        title: "财务结算",
        subtitle: "收款、退款、发票、对账与应收款",
        children: [
          { key: "receipts", label: "收款", view: "receipts", default: true },
          { key: "refunds", label: "退款", view: "refunds" },
          { key: "invoices", label: "发票", view: "invoices" },
          { key: "reconcile", label: "对账", view: "reconcile" },
          { key: "receivable", label: "应收款", view: "receivable" },
        ],
      },
      {
        key: "payments",
        label: "支付中心",
        href: "/payments",
        icon: "cash",
        title: "支付中心",
        subtitle: "支付流水、异常、退款与渠道对账",
        children: [
          { key: "flow", label: "支付流水", view: "flow", default: true },
          { key: "exception", label: "支付异常", view: "exception" },
          { key: "refunds", label: "退款管理", view: "refunds" },
          { key: "reconcile", label: "渠道对账", view: "reconcile" },
          { key: "config", label: "支付配置", view: "config" },
        ],
      },
      {
        key: "analytics",
        label: "数据分析",
        href: "/analytics",
        icon: "chartLine",
        title: "数据分析",
        subtitle: "经营、消费者、渠道与商品四类分析",
        children: [
          { key: "overview", label: "经营总览", view: "overview", default: true },
          { key: "consumer", label: "消费者分析", view: "consumer" },
          { key: "channel", label: "渠道分析", view: "channel" },
          { key: "product", label: "商品分析", view: "product" },
        ],
      },
    ],
  },
  {
    items: [
      {
        key: "settings",
        label: "系统设置",
        href: "/settings",
        icon: "settings",
        title: "系统设置",
        subtitle: "账号权限、员工、规则与操作日志",
        children: [
          { key: "account", label: "账号与权限", view: "account", default: true },
          { key: "staff", label: "员工管理", view: "staff" },
          { key: "product", label: "商品设置", view: "product" },
          { key: "order", label: "订单规则", view: "order" },
          { key: "notify", label: "消息通知", view: "notify" },
          { key: "logs", label: "操作日志", view: "logs" },
        ],
      },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function navItemByKey(key: string): NavItem {
  const hit = ALL_NAV.find((n) => n.key === key);
  if (!hit) throw new Error(`Unknown nav key: ${key}`);
  return hit;
}

export function navMetaForPath(pathname: string): NavItem {
  // Longest-prefix match so nested routes (e.g. /orders/GY-1) resolve correctly.
  const sorted = [...ALL_NAV].sort((a, b) => b.href.length - a.href.length);
  const match = sorted.find(
    (n) => pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href)),
  );
  return match ?? ALL_NAV[0];
}

// The bare route owns the default child; every other child carries `?view=`.
export function subHref(item: NavItem, sub: SubNavItem): string {
  return sub.default ? item.href : `${item.href}?view=${sub.view}`;
}

export function defaultSubView(item: NavItem): SubNavItem | undefined {
  return item.children?.find((c) => c.default) ?? item.children?.[0];
}

// Resolve the active child for a module given the current `?view=` value,
// falling back to the default child when the param is absent.
export function activeSubView(item: NavItem, view?: string | null): SubNavItem | undefined {
  if (!item.children) return undefined;
  if (view) {
    const hit = item.children.find((c) => c.view === view);
    if (hit) return hit;
  }
  return defaultSubView(item);
}

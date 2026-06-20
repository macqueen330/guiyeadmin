import type { IconName } from "@/components/ui/Icon";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  badge?: { text: string; tone: "accent" | "red" };
  title: string;
  subtitle: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "运营",
    items: [
      {
        key: "home",
        label: "首页概览",
        href: "/",
        icon: "home",
        title: "首页概览",
        subtitle: "掌握订单、渠道、库存与履约的全局动态",
      },
      {
        key: "orders",
        label: "订单中心",
        href: "/orders",
        icon: "bag",
        badge: { text: "128", tone: "accent" },
        title: "订单中心",
        subtitle: "查询、录单、分配与拆合单",
      },
      {
        key: "channel",
        label: "渠道管理",
        href: "/channel",
        icon: "share",
        badge: { text: "5", tone: "red" },
        title: "渠道管理",
        subtitle: "经销商档案、授权、合同与结算",
      },
      {
        key: "inventory",
        label: "商品库存",
        href: "/inventory",
        icon: "box",
        title: "商品库存",
        subtitle: "产品 SKU、多仓库存与批次追溯",
      },
      {
        key: "crm",
        label: "客户中心",
        href: "/crm",
        icon: "users",
        title: "客户中心",
        subtitle: "客户档案、销售线索与跟进",
      },
    ],
  },
  {
    label: "履约与分析",
    items: [
      {
        key: "logistics",
        label: "物流财务",
        href: "/logistics",
        icon: "truck",
        badge: { text: "3", tone: "red" },
        title: "物流财务",
        subtitle: "物流追踪、异常包裹、对账与发票",
      },
      {
        key: "brand",
        label: "品牌资料",
        href: "/brand",
        icon: "file",
        title: "品牌资料",
        subtitle: "产品资料、图片视频与培训物料",
      },
      {
        key: "analytics",
        label: "数据分析",
        href: "/analytics",
        icon: "chartLine",
        title: "数据分析",
        subtitle: "销售、产品、渠道与库存分析",
      },
      {
        key: "settings",
        label: "系统设置",
        href: "/settings",
        icon: "settings",
        title: "系统设置",
        subtitle: "权限、币种、税率与操作日志",
      },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function navMetaForPath(pathname: string): NavItem {
  // Longest-prefix match so nested routes (e.g. /orders/GY-1) resolve correctly.
  const sorted = [...ALL_NAV].sort((a, b) => b.href.length - a.href.length);
  const match = sorted.find(
    (n) => pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href)),
  );
  return match ?? ALL_NAV[0];
}

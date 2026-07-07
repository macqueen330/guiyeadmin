// Static RBAC configuration for the admin system:
//   管理员等级 (level) + 模块权限 (module × action) + 数据范围 (scope).
// This is reference config, not user data — components read it directly.

import type { IconName } from "@/components/ui/Icon";
import type { AdminLevel, DataScope } from "./types";

export interface LevelInfo {
  level: AdminLevel;
  name: string;
  tagline: string;
  audience: string[];
  keywords: string[];
}

export const LEVELS: LevelInfo[] = [
  {
    level: "L1",
    name: "超级管理员",
    tagline: "系统、权限、财务与最终审批",
    audience: ["公司老板", "核心负责人", "系统最高管理者"],
    keywords: ["全部权限", "权限管理", "财务控制", "系统设置", "最终审批"],
  },
  {
    level: "L2",
    name: "业务管理员",
    tagline: "部门管理、业务审核与人员分配",
    audience: ["运营 / 销售 / 仓储 / 财务负责人", "部门主管"],
    keywords: ["部门管理", "业务审核", "数据管理", "下属管理"],
  },
  {
    level: "L3",
    name: "操作员",
    tagline: "执行业务，不负责重要审批",
    audience: ["客服", "销售", "仓库员工", "内容编辑"],
    keywords: ["执行业务", "有限查看", "提交申请", "不能审批"],
  },
];

export const LEVEL_NAME: Record<AdminLevel, string> = {
  L1: "超级管理员",
  L2: "业务管理员",
  L3: "操作员",
};

export interface DataScopeInfo {
  key: DataScope;
  label: string;
  desc: string;
}

export const DATA_SCOPES: DataScopeInfo[] = [
  { key: "all", label: "全部数据", desc: "可查看全平台订单与客户，如全国运营负责人" },
  { key: "region", label: "指定区域", desc: "仅本区域，如华东（江苏 / 上海 / 浙江）" },
  { key: "dept", label: "指定部门", desc: "仅本部门数据，如销售部" },
  { key: "subordinate", label: "自己及下属", desc: "仅本人与下属负责的数据" },
  { key: "self", label: "仅本人数据", desc: "只能查看自己负责的客户 / 订单" },
  { key: "warehouse", label: "指定仓库", desc: "仅指定仓库的发货与库存" },
];

export const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  all: "全部数据",
  region: "指定区域",
  dept: "指定部门",
  subordinate: "自己及下属",
  self: "仅本人数据",
  warehouse: "指定仓库",
};

export interface PermAction {
  name: string;
  sensitive?: boolean; // 高风险：需一级权限 / 审批 / 二次确认
}

export interface PermModule {
  key: string;
  name: string;
  icon: IconName;
  actions: PermAction[];
}

const a = (name: string, sensitive = false): PermAction => ({ name, sensitive });

export const PERMISSION_MODULES: PermModule[] = [
  { key: "home", name: "首页概览", icon: "home", actions: [a("查看经营数据"), a("查看敏感金额", true), a("查看待办事项")] },
  { key: "orders", name: "订单中心", icon: "bag", actions: [a("查看订单"), a("新建订单"), a("修改订单"), a("审核订单"), a("取消订单"), a("导出订单"), a("处理退款"), a("修改订单金额", true)] },
  { key: "inventory", name: "商品与库存", icon: "box", actions: [a("查看商品"), a("新建商品"), a("修改商品"), a("修改价格", true), a("调整库存", true), a("商品上下架"), a("查看成本", true)] },
  { key: "crm", name: "客户中心", icon: "users", actions: [a("查看客户"), a("新建客户"), a("修改客户"), a("导出客户", true), a("查看手机号", true), a("修改客户归属"), a("删除客户", true)] },
  { key: "logistics", name: "仓储物流", icon: "truck", actions: [a("查看发货订单"), a("分配仓库"), a("打印面单"), a("填写物流"), a("确认出库"), a("处理物流异常")] },
  { key: "brand", name: "品牌内容", icon: "file", actions: [a("查看素材"), a("上传素材"), a("编辑内容"), a("提交审核"), a("发布内容"), a("删除素材", true)] },
  { key: "finance", name: "财务结算", icon: "dollar", actions: [a("查看支付流水", true), a("查看订单实收"), a("确认收款"), a("审核退款"), a("导出财务数据", true), a("查看成本与利润", true)] },
  { key: "analytics", name: "数据分析", icon: "chartLine", actions: [a("查看经营分析"), a("查看客户分析"), a("查看渠道分析"), a("导出报表")] },
  { key: "system", name: "系统设置", icon: "settings", actions: [a("管理管理员", true), a("设置角色", true), a("设置支付方式", true), a("设置通知规则"), a("查看操作日志", true)] },
];

type Grant = "all" | "view" | string[];

export interface RoleTemplate {
  key: string;
  name: string;
  level: AdminLevel;
  scope: DataScope;
  desc: string;
  grants: Record<string, Grant>;
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  { key: "super", name: "超级管理员", level: "L1", scope: "all", desc: "全部模块与系统设置", grants: Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, "all" as Grant])) },
  { key: "order_mgr", name: "订单管理员", level: "L2", scope: "all", desc: "全量订单与履约，不含财务 / 商品", grants: { home: "view", orders: "all", logistics: "all", crm: "view", analytics: ["查看经营分析"] } },
  { key: "finance_mgr", name: "财务管理员", level: "L2", scope: "all", desc: "支付、收款、退款审核与财务报表", grants: { home: ["查看经营数据", "查看敏感金额"], orders: ["查看订单"], finance: "all", analytics: "all" } },
  { key: "customer_mgr", name: "客户管理员", level: "L2", scope: "dept", desc: "消费者与会员运营", grants: { home: "view", crm: "all", channel: "view", analytics: ["查看客户分析"] } },
  { key: "product_mgr", name: "商品管理员", level: "L2", scope: "all", desc: "商品资料、价格与库存", grants: { home: "view", inventory: "all", analytics: ["查看经营分析"] } },
  { key: "content_mgr", name: "内容管理员", level: "L2", scope: "all", desc: "官网内容与品牌素材", grants: { home: "view", brand: "all" } },
  { key: "warehouse_mgr", name: "仓储管理员", level: "L2", scope: "warehouse", desc: "发货、仓库与库存", grants: { home: "view", logistics: "all", inventory: ["查看商品", "调整库存"], orders: ["查看订单"] } },
  { key: "sales_mgr", name: "销售管理员", level: "L2", scope: "subordinate", desc: "渠道客户与销售团队", grants: { home: "view", channel: "all", crm: ["查看客户", "新建客户", "修改客户"], orders: ["查看订单", "新建订单"], analytics: ["查看渠道分析"] } },
  { key: "cs_op", name: "客服操作员", level: "L3", scope: "self", desc: "订单查询与售后受理，不可直接退款", grants: { orders: ["查看订单", "处理退款"], crm: ["查看客户", "修改客户"] } },
  { key: "sales_op", name: "销售操作员", level: "L3", scope: "self", desc: "客户跟进、报价与代客下单", grants: { crm: ["查看客户", "新建客户", "修改客户"], channel: ["查看渠道客户", "新建渠道客户", "创建报价"], orders: ["新建订单"] } },
  { key: "wh_op", name: "仓库操作员", level: "L3", scope: "warehouse", desc: "备货、面单与出库", grants: { logistics: ["查看发货订单", "打印面单", "填写物流", "确认出库"], orders: ["查看订单"] } },
  { key: "content_op", name: "内容操作员", level: "L3", scope: "self", desc: "素材上传与内容编辑，不可发布", grants: { brand: ["查看素材", "上传素材", "编辑内容", "提交审核"] } },
];

// Resolve the granted action names for a module under a grant spec.
export function grantedActions(module: PermModule, grant: Grant | undefined): Set<string> {
  if (!grant) return new Set();
  if (grant === "all") return new Set(module.actions.map((x) => x.name));
  if (grant === "view") return new Set(module.actions.filter((x) => x.name.startsWith("查看")).map((x) => x.name));
  return new Set(grant);
}

// 一级管理员独有权限（仅 L1 可操作）。
export const L1_ONLY: string[] = [
  "创建一级管理员",
  "修改支付账户",
  "修改微信 / 支付宝 / 银联配置",
  "修改佣金 / 返利规则",
  "修改管理员权限",
  "导出完整客户资料",
  "删除订单或客户",
  "修改已完成订单金额",
  "查看管理员操作记录",
  "重置其他管理员密码",
];

// 即使一级管理员，也必须二次确认的操作。
export const CONFIRM_ACTIONS: string[] = [
  "删除数据",
  "大额退款",
  "修改实收金额",
  "修改支付配置",
  "批量导出客户",
  "批量调整库存",
  "停用其他管理员",
];

// 审批流：三级发起 → 二级审批。
export const APPROVAL_L2: string[] = ["普通退款申请", "客户归属调整", "商品下架申请", "库存差异调整", "活动物料申请"];

// 审批流：二级发起 → 一级审批。
export const APPROVAL_L1: string[] = ["大额退款", "修改商品价格", "修改渠道合作状态", "批量导出客户资料", "大批量库存调整", "删除订单", "修改财务记录"];

export interface RefundTier {
  range: string;
  approver: string;
  note?: string;
}

// 退款金额分级审批（阈值可在系统设置调整，不写死）。
export const REFUND_TIERS: RefundTier[] = [
  { range: "¥0 – 500", approver: "二级管理员审批", note: "负责范围内" },
  { range: "¥500 – 5,000", approver: "一级管理员审批" },
  { range: "¥5,000 以上", approver: "一级管理员 + 二次验证", note: "手机验证码 / 二次密码" },
];

// 安全策略。
export const LOGIN_POLICY: string[] = [
  "密码至少 8 位，且包含字母 + 数字",
  "连续输错 5 次锁定账号",
  "锁定 30 分钟后自动解锁，或一级管理员手动解锁",
  "新设备登录需手机验证码",
  "一级管理员强制开启二次验证",
  "30 分钟无操作自动退出",
];

export const MASKING_EXAMPLES: { label: string; value: string }[] = [
  { label: "手机号", value: "138****5678" },
  { label: "身份证", value: "320***********1234" },
  { label: "银行卡", value: "**** **** **** 8890" },
];

export const EXPORT_AUDIT_FIELDS: string[] = ["操作人", "导出数据", "导出数量", "导出时间", "导出原因", "导出 IP"];

// 必须留痕的重要操作。
export const AUDITED_ACTIONS: string[] = [
  "登录",
  "查看敏感信息",
  "修改订单",
  "修改价格",
  "调整库存",
  "导出数据",
  "创建退款",
  "审批退款",
  "修改客户归属",
  "新建 / 停用管理员",
  "修改权限",
  "修改系统设置",
];

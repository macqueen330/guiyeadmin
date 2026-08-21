// RBAC 的**结构**定义：有哪些等级、哪些模块、每个模块有哪些动作。
//
// 与旧版的区别：
//   * 角色模板不再是唯一事实来源 —— Supabase 的 `roles` 表才是（见
//     supabase/seed_reference.sql）。这里的 ROLE_TEMPLATES 只作为首次导入的
//     默认值与类型参考。
//   * 审批阈值（原 APPROVAL_L1 / APPROVAL_L2 / REFUND_TIERS）已迁到
//     `approval_rules` 表，金额是可比较的 numeric，不再是「¥500 – 5,000」这种
//     无法参与判断的中文字符串。见 src/lib/approvals.ts。
//   * 安全策略文案（原 LOGIN_POLICY）改由 src/lib/data/policy.ts 依据
//     app_settings 与真实实现情况生成，不再把没实现的能力打绿勾。
//   * 已删除三个角色模板里对并不存在的 `channel` 模块的授权（渠道管理已下线，
//     can() 与 canViewModule() 对它的行为原本互相矛盾）。

import type { IconName } from "@/components/ui/Icon";
import type { AdminGrant, AdminLevel, DataScope } from "./types";

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

export const LEVEL_NAME: Record<AdminLevel, string> = Object.fromEntries(
  LEVELS.map((l) => [l.level, l.name]),
) as Record<AdminLevel, string>;

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

// 单一来源：标签从 DATA_SCOPES 派生，不再维护第二份拷贝。
export const DATA_SCOPE_LABEL: Record<DataScope, string> = Object.fromEntries(
  DATA_SCOPES.map((s) => [s.key, s.label]),
) as Record<DataScope, string>;

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
  { key: "crm", name: "客户中心", icon: "users", actions: [a("查看客户"), a("新建客户"), a("修改客户"), a("导出客户", true), a("查看手机号", true), a("修改客户归属"), a("调整积分", true), a("删除客户", true)] },
  { key: "logistics", name: "仓储物流", icon: "truck", actions: [a("查看发货订单"), a("分配仓库"), a("打印面单"), a("填写物流"), a("确认出库"), a("处理物流异常")] },
  { key: "brand", name: "品牌内容", icon: "file", actions: [a("查看素材"), a("上传素材"), a("编辑内容"), a("提交审核"), a("发布内容"), a("删除素材", true)] },
  { key: "finance", name: "财务结算", icon: "dollar", actions: [a("查看支付流水", true), a("查看订单实收"), a("确认收款"), a("审核退款"), a("导入对账文件"), a("导出财务数据", true), a("查看成本与利润", true)] },
  { key: "analytics", name: "数据分析", icon: "chartLine", actions: [a("查看经营分析"), a("查看客户分析"), a("查看渠道分析"), a("导出报表")] },
  { key: "system", name: "系统设置", icon: "settings", actions: [a("管理管理员", true), a("设置角色", true), a("设置支付方式", true), a("设置通知规则"), a("修改业务字典"), a("修改安全策略", true), a("查看操作日志", true)] },
];

export const MODULE_KEYS = new Set(PERMISSION_MODULES.map((m) => m.key));

export interface RoleTemplate {
  key: string;
  name: string;
  level: AdminLevel;
  scope: DataScope;
  desc: string;
  grants: Record<string, AdminGrant>;
}

/** 首次导入用的默认角色。运行时以 Supabase 的 `roles` 表为准。 */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  { key: "super", name: "超级管理员", level: "L1", scope: "all", desc: "全部模块与系统设置", grants: Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, "all" as AdminGrant])) },
  { key: "order_mgr", name: "订单管理员", level: "L2", scope: "all", desc: "全量订单与履约，不含财务 / 商品", grants: { home: "view", orders: "all", logistics: "all", crm: "view", analytics: ["查看经营分析"] } },
  { key: "finance_mgr", name: "财务管理员", level: "L2", scope: "all", desc: "支付、收款、退款审核与财务报表", grants: { home: ["查看经营数据", "查看敏感金额"], orders: ["查看订单"], finance: "all", analytics: "all" } },
  { key: "customer_mgr", name: "客户管理员", level: "L2", scope: "dept", desc: "消费者与会员运营", grants: { home: "view", crm: "all", analytics: ["查看客户分析"] } },
  { key: "product_mgr", name: "商品管理员", level: "L2", scope: "all", desc: "商品资料、价格与库存", grants: { home: "view", inventory: "all", analytics: ["查看经营分析"] } },
  { key: "content_mgr", name: "内容管理员", level: "L2", scope: "all", desc: "官网内容与品牌素材", grants: { home: "view", brand: "all" } },
  { key: "warehouse_mgr", name: "仓储管理员", level: "L2", scope: "warehouse", desc: "发货、仓库与库存", grants: { home: "view", logistics: "all", inventory: ["查看商品", "调整库存"], orders: ["查看订单"] } },
  { key: "sales_mgr", name: "销售管理员", level: "L2", scope: "subordinate", desc: "客户与销售团队", grants: { home: "view", crm: ["查看客户", "新建客户", "修改客户", "修改客户归属"], orders: ["查看订单", "新建订单"], analytics: ["查看渠道分析"] } },
  { key: "cs_op", name: "客服操作员", level: "L3", scope: "self", desc: "订单查询与售后受理，不可直接退款", grants: { orders: ["查看订单", "处理退款"], crm: ["查看客户", "修改客户"] } },
  { key: "sales_op", name: "销售操作员", level: "L3", scope: "self", desc: "客户跟进与代客下单", grants: { crm: ["查看客户", "新建客户", "修改客户"], orders: ["新建订单"] } },
  { key: "wh_op", name: "仓库操作员", level: "L3", scope: "warehouse", desc: "备货、面单与出库", grants: { logistics: ["查看发货订单", "打印面单", "填写物流", "确认出库"], orders: ["查看订单"] } },
  { key: "content_op", name: "内容操作员", level: "L3", scope: "self", desc: "素材上传与内容编辑，不可发布", grants: { brand: ["查看素材", "上传素材", "编辑内容", "提交审核"] } },
];

// 开发期自检：角色模板不应引用不存在的模块（历史上 customer_mgr / sales_mgr /
// sales_op 引用过已下线的 `channel`，导致 can() 与 canViewModule() 结论相反）。
if (process.env.NODE_ENV !== "production") {
  for (const tpl of ROLE_TEMPLATES) {
    for (const key of Object.keys(tpl.grants)) {
      if (!MODULE_KEYS.has(key)) {
        console.warn(`[rbac] 角色模板 ${tpl.key} 引用了不存在的模块 "${key}"`);
      }
    }
  }
}

/** Resolve the granted action names for a module under a grant spec. */
export function grantedActions(module: PermModule, grant: AdminGrant | undefined): Set<string> {
  if (!grant) return new Set();
  if (grant === "all") return new Set(module.actions.map((x) => x.name));
  if (grant === "view") {
    return new Set(module.actions.filter((x) => x.name.startsWith("查看")).map((x) => x.name));
  }
  return new Set(grant);
}

/** 一级管理员独有权限（在对应 Server Action 里用 requireSuperAdmin 强制）。 */
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

/** 即使一级管理员，界面也必须弹二次确认的操作。 */
export const CONFIRM_ACTIONS: string[] = [
  "删除数据",
  "大额退款",
  "修改实收金额",
  "修改支付配置",
  "批量导出客户",
  "批量调整库存",
  "停用其他管理员",
];

export const EXPORT_AUDIT_FIELDS: string[] = ["操作人", "导出数据", "导出数量", "导出时间", "导出原因", "导出 IP"];

/** 必须留痕的重要操作（实现见 src/lib/auth/audit.ts logAudit）。 */
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
  "调整积分",
  "新建 / 停用管理员",
  "修改权限",
  "修改系统设置",
];

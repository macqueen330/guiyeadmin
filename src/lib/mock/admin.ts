import type { Admin } from "../types";

// Admin accounts across the three levels. Departed staff keep a "已离职" record
// (never hard-deleted) so their operation history stays intact.
export const admins: Admin[] = [
  { id: "a-001", name: "陈思远", phone: "138 0013 8000", email: "siyuan.chen@guiye.com", level: "L1", role: "超级管理员", dept: "管理层", scope: "all", scope_label: "全部", status: "active", last_login: "今天 09:32" },
  { id: "a-002", name: "李明", phone: "139 0013 6621", email: "ming.li@guiye.com", level: "L2", role: "订单管理员", dept: "运营部", scope: "all", scope_label: "全国订单", status: "active", last_login: "昨天 18:20" },
  { id: "a-003", name: "张薇", phone: "137 8890 4412", email: "wei.zhang@guiye.com", level: "L2", role: "财务管理员", dept: "财务部", scope: "all", scope_label: "全部财务", status: "active", last_login: "今天 08:12" },
  { id: "a-004", name: "孙磊", phone: "150 2231 7788", email: "lei.sun@guiye.com", level: "L2", role: "销售管理员", dept: "销售部", scope: "region", scope_label: "华东（江苏 / 上海 / 浙江）", status: "active", last_login: "昨天 20:15" },
  { id: "a-005", name: "王浩", phone: "158 6612 3390", email: "hao.wang@guiye.com", level: "L3", role: "客服操作员", dept: "客服部", scope: "self", scope_label: "自己负责客户", status: "active", last_login: "今天 08:56" },
  { id: "a-006", name: "赵敏", phone: "136 5540 9921", email: "min.zhao@guiye.com", level: "L3", role: "仓库操作员", dept: "仓储部", scope: "warehouse", scope_label: "华东仓", status: "active", last_login: "今天 07:40" },
  { id: "a-007", name: "周琳", phone: "135 7781 2043", email: "lin.zhou@guiye.com", level: "L3", role: "内容操作员", dept: "品牌部", scope: "self", scope_label: "仅本人数据", status: "pending", last_login: "—" },
  { id: "a-008", name: "刘洋", phone: "132 9902 5567", email: "yang.liu@guiye.com", level: "L3", role: "销售操作员", dept: "销售部", scope: "self", scope_label: "仅本人客户", status: "suspended", last_login: "3 天前" },
  { id: "a-009", name: "Sophie Tran", phone: "133 4410 8890", email: "sophie.tran@guiye.com", level: "L2", role: "内容管理员", dept: "品牌部", scope: "all", scope_label: "全部内容", status: "resigned", last_login: "2026-05-12 09:14" },
];

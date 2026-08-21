import "server-only";

import { loadSettings } from "./settings";
import type { Settings } from "@/lib/settings";

// 安全策略的**真实**状态。
//
// 旧的 SecurityPolicy 组件把 rbac.ts 里 6 条 LOGIN_POLICY 文案一律打绿色对勾，
// 其中「新设备登录需手机验证码」「一级管理员强制二次验证」「导出超阈值需审批」
// 在代码里根本不存在 —— 这是最危险的一种假数据：它让人以为管控已经生效。
//
// 现在每条策略都带 status：
//   enforced  已实现且正在生效（点出具体实现位置）
//   disabled  已实现但当前配置为关闭
//   planned   尚未实现（界面必须显示「规划中」，不得显示对勾）

export type PolicyStatus = "enforced" | "disabled" | "planned";

export interface PolicyItem {
  key: string;
  text: string;
  status: PolicyStatus;
  /** 生效位置 / 未实现原因，展示给管理员 */
  note: string;
  /** 该策略由哪个配置项控制（系统设置里可改） */
  settingKey?: string;
}

export async function loadSecurityPolicies(): Promise<PolicyItem[]> {
  const s: Settings = await loadSettings();
  const sec = s.security;

  return [
    {
      key: "password_strength",
      text: sec.passwordRequireMix
        ? `密码至少 ${sec.passwordMinLength} 位，且包含字母 + 数字`
        : `密码至少 ${sec.passwordMinLength} 位`,
      status: "enforced",
      note: "修改密码与创建管理员时校验",
      settingKey: "security.password_min_length",
    },
    {
      key: "lockout",
      text: `连续输错 ${sec.maxLoginAttempts} 次锁定账号`,
      status: "enforced",
      note: "登录失败计数写入 admins.failed_attempts",
      settingKey: "security.max_login_attempts",
    },
    {
      key: "auto_unlock",
      text: `锁定 ${sec.lockMinutes} 分钟后自动解锁，或一级管理员手动解锁`,
      status: "enforced",
      note: "下次登录时检查 locked_until 自动放行",
      settingKey: "security.lock_minutes",
    },
    {
      key: "idle_logout",
      text: `${sec.idleLogoutMinutes} 分钟无操作自动退出`,
      status: "enforced",
      note: "前端计时器到点调用退出并清除会话 Cookie",
      settingKey: "security.idle_logout_minutes",
    },
    {
      key: "session_ttl",
      text: `会话最长 ${sec.sessionHours} 小时，可强制下线其它设备`,
      status: "enforced",
      note: "session_epoch 自增后旧 Cookie 立即失效",
      settingKey: "security.session_hours",
    },
    {
      key: "mask_contact",
      text: `低于${sec.maskPhoneMinLevel === "L1" ? "一级" : sec.maskPhoneMinLevel === "L2" ? "二级" : "三级"}的管理员只看到脱敏手机号 / 邮箱`,
      status: "enforced",
      note: "客户中心表格按查看者等级脱敏",
      settingKey: "security.mask_phone_min_level",
    },
    {
      key: "new_device_otp",
      text: "新设备登录需手机验证码",
      status: sec.newDeviceOtp ? "planned" : "planned",
      note: "尚未实现：需要先接入短信服务商；开启开关不会产生任何效果",
      settingKey: "security.new_device_otp",
    },
    {
      key: "force_2fa",
      text: "一级管理员强制开启二次验证",
      status: "planned",
      note: "尚未实现：需要先接入 TOTP / 短信二次验证",
      settingKey: "security.force_2fa_l1",
    },
    {
      key: "export_approval",
      text: `单次导出超过 ${sec.exportApprovalRows} 行需审批`,
      status: "enforced",
      note: "导出动作调用 approval_rules 判定，超阈值生成审批单",
      settingKey: "security.export_approval_rows",
    },
  ];
}

export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  enforced: "已生效",
  disabled: "已关闭",
  planned: "规划中",
};

export const POLICY_STATUS_TONE: Record<PolicyStatus, { color: string; bg: string }> = {
  enforced: { color: "#16894f", bg: "#e9f5ef" },
  disabled: { color: "#6b716d", bg: "#f1f2f0" },
  planned: { color: "#b45309", bg: "#fff7ec" },
};

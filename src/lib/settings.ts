// 全局业务配置的形状与默认值。
//
// 真正生效的值存在 Supabase 的 app_settings 表里（见 supabase/seed_reference.sql）；
// 这里的 DEFAULT_SETTINGS 只在「该 key 还没入库」时兜底，并给 TS 提供类型。
// 客户端组件也可以 import 本文件（无 server-only），服务端读取见 data/settings.ts。

export interface SecuritySettings {
  maxLoginAttempts: number;
  lockMinutes: number;
  idleLogoutMinutes: number;
  sessionHours: number;
  passwordMinLength: number;
  passwordRequireMix: boolean;
  /** 尚未实现的能力：开启前需要先接入短信 / TOTP */
  newDeviceOtp: boolean;
  force2faL1: boolean;
  /** 低于该等级的管理员看到脱敏手机号 */
  maskPhoneMinLevel: "L1" | "L2" | "L3";
  exportApprovalRows: number;
}

export interface InventorySettings {
  defaultSafetyStock: number;
  countTransit: boolean;
  urgentRatio: number;
}

export interface CrmSettings {
  followUpDays: number;
  pointsExpireMonths: number;
}

export interface OrderSettings {
  overdueShipHours: number;
  recentLimit: number;
}

export interface FinanceSettings {
  currency: string;
  currencySymbol: string;
  amountDecimals: number;
  receivableAlertDays: number;
}

export interface AnalyticsSettings {
  defaultRangeDays: number;
  bounceAlert: number;
  funnelGood: number;
  funnelWarn: number;
  productDiagnosis: {
    ctr_low: number;
    view_rate_low: number;
    cart_rate_low: number;
    pay_rate_low: number;
  };
  vercelEnabled: boolean;
  webRetentionDays: number;
  /** 经营日切时区偏移（小时）。中国区 = 8，服务器按 UTC 运行。 */
  tzOffsetHours: number;
}

export interface Settings {
  security: SecuritySettings;
  inventory: InventorySettings;
  crm: CrmSettings;
  orders: OrderSettings;
  finance: FinanceSettings;
  analytics: AnalyticsSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  security: {
    maxLoginAttempts: 5,
    lockMinutes: 30,
    idleLogoutMinutes: 30,
    sessionHours: 12,
    passwordMinLength: 8,
    passwordRequireMix: true,
    newDeviceOtp: false,
    force2faL1: false,
    maskPhoneMinLevel: "L2",
    exportApprovalRows: 500,
  },
  inventory: { defaultSafetyStock: 200, countTransit: false, urgentRatio: 0.5 },
  crm: { followUpDays: 7, pointsExpireMonths: 24 },
  orders: { overdueShipHours: 48, recentLimit: 6 },
  finance: {
    currency: "CNY",
    currencySymbol: "¥",
    amountDecimals: 2,
    receivableAlertDays: 0,
  },
  analytics: {
    defaultRangeDays: 7,
    bounceAlert: 45,
    funnelGood: 50,
    funnelWarn: 25,
    productDiagnosis: {
      ctr_low: 30,
      view_rate_low: 55,
      cart_rate_low: 20,
      pay_rate_low: 80,
    },
    vercelEnabled: true,
    webRetentionDays: 400,
    tzOffsetHours: 8,
  },
};

/** app_settings.key ↔ Settings 路径的映射（读写共用，避免两边写两遍）。 */
export const SETTING_KEYS: Record<string, [keyof Settings, string]> = {
  "security.max_login_attempts": ["security", "maxLoginAttempts"],
  "security.lock_minutes": ["security", "lockMinutes"],
  "security.idle_logout_minutes": ["security", "idleLogoutMinutes"],
  "security.session_hours": ["security", "sessionHours"],
  "security.password_min_length": ["security", "passwordMinLength"],
  "security.password_require_mix": ["security", "passwordRequireMix"],
  "security.new_device_otp": ["security", "newDeviceOtp"],
  "security.force_2fa_l1": ["security", "force2faL1"],
  "security.mask_phone_min_level": ["security", "maskPhoneMinLevel"],
  "security.export_approval_rows": ["security", "exportApprovalRows"],
  "inventory.default_safety_stock": ["inventory", "defaultSafetyStock"],
  "inventory.count_transit": ["inventory", "countTransit"],
  "inventory.urgent_ratio": ["inventory", "urgentRatio"],
  "crm.follow_up_days": ["crm", "followUpDays"],
  "crm.points_expire_months": ["crm", "pointsExpireMonths"],
  "orders.overdue_ship_hours": ["orders", "overdueShipHours"],
  "orders.recent_limit": ["orders", "recentLimit"],
  "finance.currency": ["finance", "currency"],
  "finance.currency_symbol": ["finance", "currencySymbol"],
  "finance.amount_decimals": ["finance", "amountDecimals"],
  "finance.receivable_alert_days": ["finance", "receivableAlertDays"],
  "analytics.default_range_days": ["analytics", "defaultRangeDays"],
  "analytics.bounce_alert": ["analytics", "bounceAlert"],
  "analytics.funnel_good": ["analytics", "funnelGood"],
  "analytics.funnel_warn": ["analytics", "funnelWarn"],
  "analytics.product_diagnosis": ["analytics", "productDiagnosis"],
  "analytics.vercel_enabled": ["analytics", "vercelEnabled"],
  "analytics.web_retention_days": ["analytics", "webRetentionDays"],
  "analytics.tz_offset_hours": ["analytics", "tzOffsetHours"],
};

/** 密码强度校验 —— 规则来自配置，不再是三处各写一遍的正则。 */
export function validatePassword(pw: string, s: SecuritySettings): string | null {
  if (pw.length < s.passwordMinLength) {
    return `新密码至少 ${s.passwordMinLength} 位`;
  }
  if (s.passwordRequireMix && !(/[A-Za-z]/.test(pw) && /\d/.test(pw))) {
    return "新密码需同时包含字母和数字";
  }
  return null;
}

export function passwordHint(s: SecuritySettings): string {
  return s.passwordRequireMix
    ? `至少 ${s.passwordMinLength} 位，且包含字母 + 数字`
    : `至少 ${s.passwordMinLength} 位`;
}

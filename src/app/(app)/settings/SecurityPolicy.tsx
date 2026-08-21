"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  ActionForm,
  Field,
  FieldGrid,
  Select,
  SubmitButton,
  TextInput,
  Toggle,
} from "@/components/ui/Form";
import { useViewer } from "@/components/shell/AdminProvider";
import { EXPORT_AUDIT_FIELDS } from "@/lib/rbac";
import type { PolicyItem, PolicyStatus } from "@/lib/data/policy";
import type { SecuritySettings } from "@/lib/settings";
import { saveSettingsAction } from "./actions";

// 安全策略。
//
// 原来这里把 rbac.ts 的 6 条 LOGIN_POLICY 文案一律打上绿色对勾，其中
// 「新设备登录需手机验证码」「一级管理员强制二次验证」「导出超阈值需审批」
// 在代码里根本不存在 —— 这是最危险的一种假数据：让人以为管控已经生效。
//
// 现在每条策略都带真实状态（已生效 / 已关闭 / 规划中），阈值可以直接改。

const STATUS_STYLE: Record<PolicyStatus, { text: string; color: string; bg: string; icon: "check" | "alert" | "clock" }> = {
  enforced: { text: "已生效", color: "#16894f", bg: "#e9f5ef", icon: "check" },
  disabled: { text: "已关闭", color: "#6b716d", bg: "#f1f2f0", icon: "alert" },
  planned: { text: "规划中", color: "#b45309", bg: "#fff7ec", icon: "clock" },
};

export function SecurityPolicy({
  policies,
  security,
}: {
  policies: PolicyItem[];
  security: SecuritySettings;
}) {
  const viewer = useViewer();
  const canEdit = viewer.level === "L1";
  const planned = policies.filter((p) => p.status === "planned");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>登录与会话安全</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            每条策略的状态都对应真实实现，未实现的明确标注「规划中」
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
          {policies.map((p) => {
            const s = STATUS_STYLE[p.status];
            return (
              <div key={p.key} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 0" }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: s.bg,
                    color: s.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                    marginTop: 1,
                  }}
                >
                  <Icon name={s.icon} size={12} strokeWidth={2.8} />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, color: "#3a403c" }}>
                    {p.text}
                    <span
                      style={{
                        marginLeft: 7,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: s.color,
                        background: s.bg,
                        padding: "1px 7px",
                        borderRadius: 20,
                      }}
                    >
                      {s.text}
                    </span>
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.note}</span>
                </div>
              </div>
            );
          })}
        </div>
        {planned.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 9,
              background: "#fff7ec",
              border: "1px solid #f2e2c4",
            }}
          >
            <Icon name="alert" size={15} color="#b45309" style={{ flex: "none", marginTop: 1 }} />
            <span style={{ fontSize: 12, color: "#8a5a12", lineHeight: 1.6 }}>
              有 {planned.length} 项能力尚未实现（{planned.map((p) => p.text).join("、")}）。
              开关打开也不会产生任何效果，请先完成对应接入。
            </span>
          </div>
        )}
      </Card>

      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>安全阈值</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            登录页、锁定逻辑、空闲退出、脱敏规则读的都是这一份配置
            {!canEdit && " · 仅一级管理员可修改"}
          </span>
        </div>
        <ActionForm action={saveSettingsAction} hidden={{ category: "security" }}>
          <FieldGrid columns={4}>
            <Field label="连续输错锁定次数" required>
              <TextInput
                name="security.max_login_attempts"
                type="number"
                min={1}
                max={20}
                defaultValue={security.maxLoginAttempts}
                disabled={!canEdit}
              />
            </Field>
            <Field label="锁定时长（分钟）" required>
              <TextInput
                name="security.lock_minutes"
                type="number"
                min={1}
                defaultValue={security.lockMinutes}
                disabled={!canEdit}
              />
            </Field>
            <Field label="无操作退出（分钟）" required>
              <TextInput
                name="security.idle_logout_minutes"
                type="number"
                min={1}
                defaultValue={security.idleLogoutMinutes}
                disabled={!canEdit}
              />
            </Field>
            <Field label="会话有效期（小时）" required>
              <TextInput
                name="security.session_hours"
                type="number"
                min={1}
                defaultValue={security.sessionHours}
                disabled={!canEdit}
              />
            </Field>
          </FieldGrid>
          <FieldGrid columns={4}>
            <Field label="密码最小长度" required>
              <TextInput
                name="security.password_min_length"
                type="number"
                min={6}
                defaultValue={security.passwordMinLength}
                disabled={!canEdit}
              />
            </Field>
            <Field label="可见完整手机号的最低等级">
              <Select
                name="security.mask_phone_min_level"
                defaultValue={security.maskPhoneMinLevel}
                disabled={!canEdit}
                options={[
                  { value: "L1", label: "仅一级" },
                  { value: "L2", label: "二级及以上" },
                  { value: "L3", label: "全部管理员" },
                ]}
              />
            </Field>
            <Field label="导出需审批的行数">
              <TextInput
                name="security.export_approval_rows"
                type="number"
                min={1}
                defaultValue={security.exportApprovalRows}
                disabled={!canEdit}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 9 }}>
              <Toggle
                name="security.password_require_mix"
                defaultChecked={security.passwordRequireMix}
                disabled={!canEdit}
              />
              <span style={{ fontSize: 12.5 }}>密码需含字母和数字</span>
            </div>
          </FieldGrid>
          {canEdit && (
            <div>
              <SubmitButton>保存安全阈值</SubmitButton>
            </div>
          )}
        </ActionForm>
      </Card>

      <Card style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>导出限制</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            每次导出留痕；超过 {security.exportApprovalRows} 行需审批
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {EXPORT_AUDIT_FIELDS.map((f) => (
            <span
              key={f}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "#4a514c",
                background: "var(--bg)",
                border: "1px solid var(--line)",
                padding: "5px 11px",
                borderRadius: 7,
              }}
            >
              {f}
            </span>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 9,
            background: "#e9f5ef",
            border: "1px solid #cfe6da",
          }}
        >
          <Icon name="check" size={15} color="#16894f" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#16894f" }}>
            导出动作会调用审批规则判定，超阈值自动生成审批单，三级管理员不可导出含联系方式的客户资料
          </span>
        </div>
      </Card>
    </div>
  );
}

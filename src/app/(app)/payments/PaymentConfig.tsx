"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
import { fmtDate, fmtDateTime, fmtPercent } from "@/lib/tokens";
import { savePaymentGatewayAction, testPaymentGatewayAction } from "./actions";
import type { PaymentGateway } from "@/lib/types";
import type { GatewayReadiness } from "@/lib/payments/registry";

// 支付配置。
//
// 原来整页是「静态截图式 JSX」：22 个配置值全是字面量字符串，没有 state、
// 没有 input、没有保存按钮。最刺眼的是银联卡片写着「证书：即将过期」「待启用」
// —— 界面明确提示需要人工处理，却不提供任何处理入口。
//
// 现在：配置存 payment_gateways 表，一级管理员可改；密钥只登记环境变量名，
// 值配置在 Vercel，永不入库也永不回显。

const STATUS_OPTIONS = [
  { value: "enabled", label: "已启用" },
  { value: "pending", label: "待启用" },
  { value: "disabled", label: "已停用" },
];

const STATUS_TONE: Record<string, { text: string; color: string; bg: string }> = {
  enabled: { text: "已启用", color: "#16894f", bg: "#e9f5ef" },
  pending: { text: "待启用", color: "#b45309", bg: "#fff7ec" },
  disabled: { text: "已停用", color: "#6b716d", bg: "#f1f2f0" },
};

const TEST_TONE: Record<string, { text: string; color: string }> = {
  passed: { text: "自检通过", color: "#16894f" },
  failed: { text: "自检未通过", color: "#c0392b" },
  untested: { text: "未自检", color: "#6b716d" },
};

const ONLINE_PROVIDERS = new Set(["wechat_pay", "alipay", "unionpay"]);

export function PaymentConfig({
  gateways,
  readiness,
  siteOrigin,
}: {
  gateways: PaymentGateway[];
  readiness: Record<string, GatewayReadiness>;
  siteOrigin: string;
}) {
  const viewer = useViewer();
  const [editing, setEditing] = useState<string | null>(null);
  const canEdit = viewer.level === "L1";

  if (gateways.length === 0) {
    return (
      <Card>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>
          还没有支付渠道配置。请先导入 <code>supabase/seed_reference.sql</code>，
          它会创建微信支付 / 支付宝 / 银联 / 银行转账 / 线下收款 / 账期六条渠道记录。
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!canEdit && (
        <Card style={{ background: "#fff7ec", border: "1px solid #f2e2c4" }}>
          <span style={{ fontSize: 12.5, color: "#8a5a12" }}>
            支付渠道配置属于一级管理员独有权限，当前账号只能查看。
          </span>
        </Card>
      )}

      {gateways.map((g) => {
        const r = readiness[g.provider];
        const tone = STATUS_TONE[g.status] ?? STATUS_TONE.disabled;
        const test = TEST_TONE[g.test_status] ?? TEST_TONE.untested;
        const isEditing = editing === g.provider;
        const online = ONLINE_PROVIDERS.has(g.provider);
        const notifyUrl = g.notify_url
          ? g.notify_url.startsWith("http")
            ? g.notify_url
            : `${siteOrigin}${g.notify_url}`
          : `${siteOrigin}/api/pay/${g.provider}/notify`;

        return (
          <Card key={g.id} padding="18px 22px">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: tone.color,
                  background: tone.bg,
                  padding: "2px 9px",
                  borderRadius: 20,
                }}
              >
                {tone.text}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: test.color }}>{test.text}</span>
              {g.is_sandbox && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#2b6cb0",
                    background: "#eef4ff",
                    padding: "2px 8px",
                    borderRadius: 20,
                  }}
                >
                  沙箱
                </span>
              )}
              {r?.certExpired && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#c0392b" }}>证书已过期</span>
              )}
              {r?.certExpiringSoon && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#b45309" }}>
                  证书 {fmtDate(g.cert_expires_at)} 到期
                </span>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <ActionForm action={testPaymentGatewayAction} hidden={{ provider: g.provider }} style={{ gap: 0 }}>
                  <SubmitButton variant="secondary" style={{ height: 30, fontSize: 12 }}>
                    配置自检
                  </SubmitButton>
                </ActionForm>
                {canEdit && (
                  <Button
                    variant={isEditing ? "soft" : "secondary"}
                    icon="edit"
                    style={{ height: 30, fontSize: 12 }}
                    onClick={() => setEditing(isEditing ? null : g.provider)}
                  >
                    {isEditing ? "收起" : "编辑"}
                  </Button>
                )}
              </div>
            </div>

            {/* 状态摘要：缺什么就说什么，而不是一律显示「已通过」 */}
            {r && !r.ready && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "9px 12px",
                  borderRadius: 9,
                  background: "#fff7ec",
                  border: "1px solid #f2e2c4",
                  marginBottom: 12,
                }}
              >
                <Icon name="alert" size={14} color="#b45309" style={{ flex: "none", marginTop: 2 }} />
                <span style={{ fontSize: 12, color: "#8a5a12", lineHeight: 1.6 }}>
                  尚不能发起支付，还缺：{r.missing.join("；")}
                </span>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px 18px",
                fontSize: 12.5,
              }}
            >
              {g.merchant_no && <Info label="商户号" value={g.merchant_no} />}
              {g.app_id && <Info label="AppID" value={g.app_id} />}
              {g.scenarios.length > 0 && <Info label="支付场景" value={g.scenarios.join(" · ")} />}
              <Info label="费率" value={fmtPercent(g.fee_rate * 100, 2)} />
              {g.settle_cycle && <Info label="结算周期" value={g.settle_cycle} />}
              {online && <Info label="回调地址" value={notifyUrl} mono />}
              {g.credential_env && (
                <Info
                  label="密钥环境变量"
                  value={`${g.credential_env} · ${r?.credentialPresent ? "已配置" : "未配置"}`}
                  tone={r?.credentialPresent ? "#16894f" : "#c0392b"}
                />
              )}
              {g.bank_account_no && <Info label="收款账号" value={g.bank_account_no} mono />}
              {g.term_days !== null && g.term_days !== undefined && (
                <Info label="账期" value={`${g.term_days} 天`} />
              )}
              {g.last_test_at && (
                <Info label="最近自检" value={`${fmtDateTime(g.last_test_at)}`} />
              )}
            </div>

            {isEditing && canEdit && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                <ActionForm
                  action={savePaymentGatewayAction}
                  hidden={{ provider: g.provider }}
                  onSuccess={() => setEditing(null)}
                >
                  <FieldGrid columns={3}>
                    <Field label="商户号">
                      <TextInput name="merchant_no" defaultValue={g.merchant_no ?? ""} />
                    </Field>
                    <Field label="AppID">
                      <TextInput name="app_id" defaultValue={g.app_id ?? ""} />
                    </Field>
                    <Field label="状态">
                      <Select name="status" defaultValue={g.status} options={STATUS_OPTIONS} />
                    </Field>
                  </FieldGrid>

                  <FieldGrid columns={3}>
                    <Field
                      label="密钥环境变量名"
                      hint="只填变量名；密钥值配置在 Vercel，不入库"
                    >
                      <TextInput name="credential_env" defaultValue={g.credential_env ?? ""} />
                    </Field>
                    <Field label="证书引用">
                      <TextInput name="cert_ref" defaultValue={g.cert_ref ?? ""} />
                    </Field>
                    <Field label="证书到期日">
                      <TextInput
                        name="cert_expires_at"
                        type="date"
                        defaultValue={g.cert_expires_at ? g.cert_expires_at.slice(0, 10) : ""}
                      />
                    </Field>
                  </FieldGrid>

                  <FieldGrid columns={2}>
                    <Field label="异步通知地址" hint="填给支付平台的回调 URL">
                      <TextInput name="notify_url" defaultValue={g.notify_url ?? ""} />
                    </Field>
                    <Field label="同步返回地址">
                      <TextInput name="return_url" defaultValue={g.return_url ?? ""} />
                    </Field>
                  </FieldGrid>

                  <FieldGrid columns={4}>
                    <Field label="费率" hint="0.006 = 0.6%">
                      <TextInput name="fee_rate" type="number" step="0.0001" defaultValue={g.fee_rate} />
                    </Field>
                    <Field label="固定手续费">
                      <TextInput name="fee_fixed" type="number" step="0.01" defaultValue={g.fee_fixed} />
                    </Field>
                    <Field label="结算周期">
                      <TextInput name="settle_cycle" defaultValue={g.settle_cycle ?? ""} />
                    </Field>
                    <Field label="账期天数">
                      <TextInput name="term_days" type="number" defaultValue={g.term_days ?? ""} />
                    </Field>
                  </FieldGrid>

                  {!online && (
                    <FieldGrid columns={3}>
                      <Field label="收款户名">
                        <TextInput name="bank_account_name" defaultValue={g.bank_account_name ?? ""} />
                      </Field>
                      <Field label="收款账号">
                        <TextInput name="bank_account_no" defaultValue={g.bank_account_no ?? ""} />
                      </Field>
                      <Field label="开户行">
                        <TextInput name="bank_name" defaultValue={g.bank_name ?? ""} />
                      </Field>
                    </FieldGrid>
                  )}

                  <Field label="支付场景" hint="逗号分隔，例如 JSAPI,H5,Native">
                    <TextInput name="scenarios" defaultValue={g.scenarios.join(",")} />
                  </Field>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>沙箱环境</span>
                    <Toggle name="is_sandbox" defaultChecked={g.is_sandbox} />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                      取消
                    </Button>
                    <SubmitButton>保存配置</SubmitButton>
                  </div>
                </ActionForm>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Info({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          color: tone ?? "#2c322e",
          fontVariantNumeric: mono ? "tabular-nums" : undefined,
          wordBreak: "break-all",
          fontSize: mono ? 11.5 : 12.5,
        }}
      >
        {value}
      </span>
    </div>
  );
}

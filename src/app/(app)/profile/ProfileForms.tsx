"use client";

import {
  ActionForm,
  ConfirmSubmit,
  Field,
  FieldGrid,
  SubmitButton,
  TextInput,
} from "@/components/ui/Form";
import { passwordHint, type SecuritySettings } from "@/lib/settings";
import {
  updateOwnProfileAction,
  changeOwnPasswordAction,
  revokeSessionsFormAction,
} from "./actions";

export function ProfileBasicForm({
  name,
  phone,
  dept,
}: {
  name: string;
  phone: string;
  dept: string;
}) {
  return (
    <ActionForm action={updateOwnProfileAction}>
      <FieldGrid columns={3}>
        <Field label="姓名" required>
          <TextInput name="name" defaultValue={name} required maxLength={40} />
        </Field>
        <Field label="手机号" hint="用于接收提醒，非登录账号">
          <TextInput name="phone" defaultValue={phone} placeholder="选填" />
        </Field>
        <Field label="部门 / 职位">
          <TextInput name="dept" defaultValue={dept} placeholder="如 运营管理部" />
        </Field>
      </FieldGrid>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SubmitButton icon="check">保存资料</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ChangePasswordForm({ security }: { security: SecuritySettings }) {
  // 密码规则来自 app_settings.security.*，与登录页、创建管理员脚本、
  // 安全策略页展示的完全是同一份配置。
  return (
    <ActionForm action={changeOwnPasswordAction} resetOnSuccess style={{ maxWidth: 460 }}>
      <Field label="当前密码" required>
        <TextInput name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="新密码" required hint={passwordHint(security)}>
        <TextInput
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={security.passwordMinLength}
          required
        />
      </Field>
      <Field label="确认新密码" required>
        <TextInput name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <SubmitButton icon="key">修改密码</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RevokeSessionsForm({ others }: { others: number }) {
  return (
    <ActionForm action={revokeSessionsFormAction} style={{ gap: 8 }}>
      <ConfirmSubmit
        variant="soft"
        message={
          others > 0
            ? `将立即注销其它 ${others} 个设备上的登录，需要重新输入密码。确认继续？`
            : "将注销除当前设备外的所有登录会话。确认继续？"
        }
      >
        强制下线其它设备
      </ConfirmSubmit>
    </ActionForm>
  );
}

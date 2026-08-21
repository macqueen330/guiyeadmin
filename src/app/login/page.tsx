import { redirect } from "next/navigation";
import { getCurrentAdmin, isSystemConfigured, missingEnvVars } from "@/lib/auth/context";
import { loadSettingsUnauthenticated } from "@/lib/data/settings";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "登录 · GUIYE 瑰野 运营控制台" };

const REASONS: Record<string, string> = {
  idle: "长时间未操作，已自动退出，请重新登录",
  forced: "登录状态已失效，请重新登录",
  unconfigured: "系统尚未完成部署配置，暂时无法登录",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; reason?: string }>;
}) {
  const { redirect: redirectTo, reason } = await searchParams;

  // 原状：isDemoMode() 为真时，这里渲染一个「以超级管理员身份进入控制台」的按钮，
  // 并把 SUPABASE_SERVICE_ROLE_KEY 这个变量名直接印给任何访客看。
  // 演示身份已整体移除 —— 未配置就是不可用，而不是降级成无鉴权入口。
  const configured = isSystemConfigured();
  const missing = configured ? [] : missingEnvVars();

  if (configured) {
    const admin = await getCurrentAdmin();
    if (admin) redirect(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/");
  }

  const { security } = await loadSettingsUnauthenticated();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 15,
              background: "linear-gradient(140deg,#2a9c74,#c2703d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 20px rgba(31,122,92,.32)",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 22, letterSpacing: "-.5px" }}>瑰</span>
          </div>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: ".5px" }}>
              GUIYE 瑰野 · 运营控制台
            </span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>管理员登录</span>
          </div>
        </div>

        {reason && REASONS[reason] && (
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "#b45309",
              background: "#fff7ec",
              border: "1px solid #f2e2c4",
              borderRadius: 10,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            {REASONS[reason]}
          </div>
        )}

        {configured ? (
          <LoginForm redirectTo={redirectTo} />
        ) : (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 8px 30px rgba(20,40,30,.06)",
            }}
          >
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "#c0392b" }}>系统尚未配置</span>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.75 }}>
              控制台还没有连接数据库，因此无法登录，也不会提供任何降级入口。
              请部署者在运行环境中补齐 {missing.length} 项配置后重启服务。
            </div>
            <div style={{ fontSize: 12, color: "#4a514c", lineHeight: 1.8 }}>
              部署说明见仓库 <code>README.md</code> 与 <code>.env.example</code>。
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.7 }}>
          连续输错 {security.maxLoginAttempts} 次将锁定账号 {security.lockMinutes} 分钟 ·{" "}
          {security.idleLogoutMinutes} 分钟无操作自动退出
          <br />
          会话最长 {security.sessionHours} 小时
        </div>
      </div>
    </div>
  );
}

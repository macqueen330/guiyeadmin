import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin, isDemoMode } from "@/lib/auth/context";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "登录 · GUIYE 瑰野 运营控制台" };

const REASONS: Record<string, string> = {
  idle: "长时间未操作，已自动退出，请重新登录",
  forced: "登录状态已失效，请重新登录",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; reason?: string }>;
}) {
  const { redirect: redirectTo, reason } = await searchParams;
  const demo = isDemoMode();

  // Already signed in → go straight to the console.
  if (!demo) {
    const admin = await getCurrentAdmin();
    if (admin) redirect(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/");
  }

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
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: ".5px" }}>GUIYE 瑰野 · 运营控制台</span>
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

        {demo ? (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 8px 30px rgba(20,40,30,.06)",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
              当前为<strong style={{ color: "var(--ink)" }}>演示模式</strong>（未配置 Supabase 鉴权）。
              配置 <code>SUPABASE_SERVICE_ROLE_KEY</code> 后将启用真实登录、账号管理与权限校验。
            </div>
            <Link
              href="/"
              style={{
                height: 42,
                borderRadius: 10,
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
            >
              以超级管理员身份进入控制台
            </Link>
          </div>
        ) : (
          <LoginForm redirectTo={redirectTo} />
        )}

        <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.7 }}>
          连续输错 5 次将锁定账号 30 分钟 · 30 分钟无操作自动退出
          <br />
          一级管理员建议开启二次验证
        </div>
      </div>
    </div>
  );
}

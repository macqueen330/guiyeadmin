import { type ReactNode, Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { getAlerts } from "@/lib/data/metrics";

export async function AppShell({
  children,
  badges = {},
  pendingApprovals = 0,
}: {
  children: ReactNode;
  badges?: Record<string, number>;
  pendingApprovals?: number;
}) {
  // 侧边栏徽标、铃铛计数与首页待办来自同一次聚合，不会互相矛盾。
  const alerts = await getAlerts();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "250px 1fr",
        height: "100vh",
        width: "100%",
        background: "var(--bg)",
        color: "var(--ink)",
        overflow: "hidden",
      }}
    >
      {/* Sidebar reads ?view= via useSearchParams — a Suspense boundary keeps
          search-param-free pages prerenderable. */}
      <Suspense fallback={<aside style={{ background: "var(--sidebar)" }} />}>
        <Sidebar badges={badges} />
      </Suspense>
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <Suspense fallback={<div style={{ height: 71, borderBottom: "1px solid var(--line)" }} />}>
          <Header alerts={alerts} pendingApprovals={pendingApprovals} />
        </Suspense>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "22px 28px 40px",
            minHeight: 0,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

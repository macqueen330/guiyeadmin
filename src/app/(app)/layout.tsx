import type { ReactNode } from "react";
import { requireAdmin, viewerFor } from "@/lib/auth/context";
import { AdminProvider } from "@/components/shell/AdminProvider";
import { DictProvider } from "@/components/shell/DictProvider";
import { IdleLogout } from "@/components/shell/IdleLogout";
import { AppShell } from "@/components/shell/AppShell";
import { loadSettings } from "@/lib/data/settings";
import { loadDict } from "@/lib/data/dict";
import { getNavBadgeCounts } from "@/lib/data/metrics";
import { countPendingApprovals } from "@/lib/data/approvals";
import { canSeeFullContact } from "@/lib/tokens";

// Authed section layout. `requireAdmin()` redirects to /login when there is no
// valid, active session — this is the server-side gate that the client cannot
// bypass. 业务字典、阈值配置、侧边栏徽标计数都在这里读一次，向下传递，
// 避免每个页面各查一遍、各写一份常量。
export default async function AppLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const [settings, dict, badges, pendingApprovals] = await Promise.all([
    loadSettings(),
    loadDict(),
    getNavBadgeCounts(),
    countPendingApprovals(admin.level),
  ]);

  const viewer = viewerFor(
    admin,
    canSeeFullContact(admin.level, settings.security.maskPhoneMinLevel),
  );

  return (
    <AdminProvider viewer={viewer}>
      <DictProvider dict={dict} settings={settings}>
        <IdleLogout minutes={settings.security.idleLogoutMinutes} />
        <AppShell badges={badges} pendingApprovals={pendingApprovals}>
          {children}
        </AppShell>
      </DictProvider>
    </AdminProvider>
  );
}

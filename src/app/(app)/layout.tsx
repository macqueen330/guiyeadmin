import type { ReactNode } from "react";
import { requireAdmin, viewerFor, isDemoMode } from "@/lib/auth/context";
import { AdminProvider } from "@/components/shell/AdminProvider";
import { IdleLogout } from "@/components/shell/IdleLogout";
import { AppShell } from "@/components/shell/AppShell";

// Authed section layout. `requireAdmin()` redirects to /login when there is no
// valid, active session — this is the server-side gate that the client cannot
// bypass. The resolved viewer is handed to the shell for menu filtering & the
// user card.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const viewer = viewerFor(admin);

  return (
    <AdminProvider viewer={viewer}>
      <IdleLogout enabled={!isDemoMode()} />
      <AppShell>{children}</AppShell>
    </AdminProvider>
  );
}

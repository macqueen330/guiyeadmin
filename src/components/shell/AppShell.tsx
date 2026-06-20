import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
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
      <Sidebar />
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <Header />
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

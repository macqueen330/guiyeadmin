"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Viewer } from "@/lib/auth/context";

// Carries the current admin's identity + resolved capabilities to client
// components (sidebar menu filtering, user card, button visibility). Server-side
// checks remain authoritative — this is UX only.
const ViewerContext = createContext<Viewer | null>(null);

export function AdminProvider({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  const v = useContext(ViewerContext);
  if (!v) throw new Error("useViewer must be used within <AdminProvider>");
  return v;
}

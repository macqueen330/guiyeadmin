"use client";

import { useEffect, useRef } from "react";
import { signOutIdleAction } from "@/lib/auth/actions";

// Auto sign-out after `minutes` of no user interaction (30 分钟无操作自动退出).
// Disabled in demo mode (no real session to end).
export function IdleLogout({ minutes = 30, enabled = true }: { minutes?: number; enabled?: boolean }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ms = minutes * 60_000;

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        // Redirects to /login?reason=idle via the server action.
        void signOutIdleAction();
      }, ms);
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes, enabled]);

  return null;
}

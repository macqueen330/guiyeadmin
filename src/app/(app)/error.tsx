"use client";

// 数据读取失败的兜底屏。
//
// 以前取数层是 `if (error) return []`，于是「表读不到」「RLS 拒绝」「网络抖动」
// 全都渲染成「暂无数据」—— 和真的没有数据长得一模一样，故障能无声无息挂很久。
// 现在 DataReadError 会一路抛到这里，界面明确说「读不到」而不是「没有」。
//
// 注意：Next 在**生产环境**会把 Server Component 抛出的错误信息换成通用文案，
// 只保留 digest（见 next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md）。
// 所以具体原因要去服务端日志里按 digest 找，这里不假装知道。

import { useEffect } from "react";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] 页面渲染失败：", error);
  }, [error]);

  // 开发环境下 message 是真实的；生产环境是通用文案，此时只展示 digest。
  const detail = error.message && !/^An error occurred/i.test(error.message) ? error.message : null;

  return (
    <div style={{ padding: "48px 8px", maxWidth: 620 }}>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderLeft: "3px solid var(--red)",
          borderRadius: 14,
          padding: "24px 26px",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 650, margin: "0 0 8px", color: "var(--ink)" }}>
          数据读取失败
        </h1>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.8, color: "var(--muted)" }}>
          这一页的数据没有读到 —— 这不等于「没有数据」。在排查清楚之前，
          页面上任何数字都不可信，所以这里不显示空表格。
        </p>

        {detail && (
          <p
            style={{
              margin: "0 0 14px",
              padding: "10px 12px",
              background: "var(--red-soft, #fdf0ef)",
              borderRadius: 8,
              fontFamily: "var(--mono, ui-monospace, monospace)",
              fontSize: 12,
              lineHeight: 1.7,
              color: "var(--red)",
              wordBreak: "break-word",
            }}
          >
            {detail}
          </p>
        )}

        {error.digest && (
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--muted)" }}>
            服务端日志编号 <code style={{ fontSize: 11.5 }}>{error.digest}</code>
            {" "}—— 具体原因（表名、RLS 策略、连接超时）在服务端日志里按这个编号查。
          </p>
        )}

        <p style={{ margin: "0 0 18px", fontSize: 12.5, lineHeight: 1.8, color: "var(--muted)" }}>
          常见原因：Supabase 连接中断、迁移没跑全（表或视图不存在）、
          <code style={{ fontSize: 11.5 }}>SUPABASE_SERVICE_ROLE_KEY</code> 失效或被轮换。
        </p>

        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: 0,
            borderRadius: 9,
            padding: "9px 18px",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          重试
        </button>
      </div>
    </div>
  );
}

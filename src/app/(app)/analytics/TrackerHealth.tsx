"use client";

import { Card } from "@/components/ui/Card";
import { ActionForm, SubmitButton } from "@/components/ui/Form";
import { rollupWebRangeAction } from "./actions";
import { fmtDateTime, fmtNumber, fmtRelative } from "@/lib/tokens";
import type { TrackerHealth as Health } from "@/lib/data/web";

// 三方链路（guiyecy.com → 采集端点 → 数据库 → 日汇总）的实际状态。
//
// 以前后台没有任何地方能区分「官网没流量」和「链路断了」：跨域配错、
// 汇总挂掉、表读不到，界面上全都长成同一句「暂无数据」。
// 这一条把每一跳的真实证据摆出来，好让人一眼看出到底是哪儿断了。

const TONE: Record<Health["status"], { label: string; color: string; bg: string; hint: string }> = {
  ok: {
    label: "链路正常",
    color: "#16894f",
    bg: "#e9f5ef",
    hint: "官网正在上报，日汇总最近一次执行成功。",
  },
  stale: {
    label: "超过 24 小时没有上报",
    color: "#b45309",
    bg: "#fff7ec",
    hint: "官网可能没流量，也可能是脚本被移除、域名不在跨域白名单里、或上报密钥变了。",
  },
  never: {
    label: "从未收到上报",
    color: "#b45309",
    bg: "#fff7ec",
    hint: "官网还没接埋点脚本，或者请求一直被跨域拦下 —— 不是「没有访客」。",
  },
  rollup_failed: {
    label: "日汇总失败",
    color: "#c0392b",
    bg: "#fdf0ef",
    hint: "事件收到了，但汇总没跑成功，页面上的日数据会停在上一次成功的结果。",
  },
};

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</span>
      <span
        style={{
          fontSize: 12.5,
          color: "var(--ink)",
          fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function TrackerHealth({ health }: { health: Health }) {
  const tone = TONE[health.status];

  return (
    <Card style={{ background: tone.bg, border: `1px solid ${tone.color}33` }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 650, color: tone.color }}>
            官网埋点 · {tone.label}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{tone.hint}</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "10px 20px",
          }}
        >
          <Row
            label="最后一次上报"
            value={health.lastEventAt ? `${fmtRelative(health.lastEventAt)}（${fmtDateTime(health.lastEventAt)}）` : "从未"}
          />
          <Row label="最近 24 小时事件" value={fmtNumber(health.events24h)} />
          <Row label="累计事件" value={fmtNumber(health.eventsTotal)} />
          <Row
            label="最后一次日汇总"
            value={
              health.lastRollup
                ? `${health.lastRollup.statDate} · ${health.lastRollup.ok ? "成功" : `失败：${health.lastRollup.error ?? "未知"}`}`
                : "无记录"
            }
          />
          <Row
            label="跨域白名单"
            value={
              health.allowedOrigins.length > 0
                ? health.allowedOrigins.join("、")
                : "未配置（允许所有来源）"
            }
            mono={health.allowedOrigins.length > 0}
          />
          <Row label="上报密钥" value={health.tokenRequired ? "已启用，官网需带 x-guiye-token" : "未启用"} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <ActionForm<{ days: number }> action={rollupWebRangeAction} hidden={{ days: 30 }}>
            <SubmitButton variant="secondary">重算近 30 天汇总</SubmitButton>
          </ActionForm>
          <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.7 }}>
            改了统计时区、补录了历史事件、或上面显示汇总失败时用它 ——
            日汇总平时只在收到上报时算当天，不会自动回头补算。
          </span>
        </div>

        {health.allowedOrigins.length > 0 && (
          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.7, color: "var(--muted)" }}>
            白名单按整个 Origin 精确匹配。<code>guiyecy.com</code> 和{" "}
            <code>www.guiyecy.com</code> 是两个不同的来源，两个都要上报就都得列进
            <code>ANALYTICS_ALLOWED_ORIGIN</code>（逗号分隔）。
          </p>
        )}
      </div>
    </Card>
  );
}

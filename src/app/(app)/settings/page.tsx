import { Card } from "@/components/ui/Card";
import { SubTabs } from "@/components/ui/SubTabs";
import { listAuditLogs, type AuditLog } from "@/lib/auth/store";
import { navItemByKey, activeSubView } from "@/lib/nav";
import { fmtDateTime, toneOr } from "@/lib/tokens";
import { AUDITED_ACTIONS } from "@/lib/rbac";
import { requireModule } from "@/lib/auth/context";
import { loadSettings } from "@/lib/data/settings";
import { loadDict, listDictEntries } from "@/lib/data/dict";
import { loadSecurityPolicies } from "@/lib/data/policy";
import { listApprovalRules } from "@/lib/data/approvals";
import { getApprovalRequests, getNotificationRules } from "@/lib/data/queries";
import { SecurityPolicy } from "./SecurityPolicy";
import { ApprovalPanel, DictPanel, NotifyPanel, RulesPanel } from "./SettingsPanels";

export const dynamic = "force-dynamic";

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  color: "#9a9f9a",
  padding: "10px 8px",
  borderBottom: "1px solid var(--line)",
};
const td: React.CSSProperties = {
  padding: "11px 8px",
  borderBottom: "1px solid var(--line)",
  fontSize: 12.5,
};

function ResultTag({ result }: { result: string }) {
  const tone =
    result === "success"
      ? { c: "#16894f", b: "#e9f5ef", t: "成功" }
      : result === "denied"
        ? { c: "#c0392b", b: "#fdf0ef", t: "拒绝" }
        : { c: "#b45309", b: "#fff7ec", t: "失败" };
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: tone.c,
        background: tone.b,
        padding: "2px 8px",
        borderRadius: 20,
      }}
    >
      {tone.t}
    </span>
  );
}

function LogTable({
  title,
  subtitle,
  logs,
  levelLabel,
}: {
  title: string;
  subtitle: string;
  logs: AuditLog[];
  levelLabel: (code: string | null) => { text: string; color: string; bg: string };
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
      </div>
      {logs.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--muted)", padding: "12px 0" }}>
          暂无记录。所有写操作都会自动留痕在这里。
        </span>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>时间</th>
                <th style={th}>操作人</th>
                <th style={th}>操作内容</th>
                <th style={th}>对象</th>
                <th style={th}>设备</th>
                <th style={th}>IP</th>
                <th style={{ ...th, textAlign: "center" }}>结果</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const lvl = levelLabel(l.actor_level);
                return (
                  <tr key={l.id} className="row-hover">
                    <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {fmtDateTime(l.created_at)}
                    </td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600, color: "#2c322e" }}>{l.actor_name ?? "系统"}</span>
                        {l.actor_level && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: lvl.color,
                              background: lvl.bg,
                              padding: "1px 7px",
                              borderRadius: 20,
                            }}
                          >
                            {lvl.text}
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...td, color: "#4a514c" }}>{l.detail ?? l.action}</td>
                    <td style={{ ...td, color: "#4a514c" }}>{l.target_name ?? "—"}</td>
                    <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {l.device ?? "—"}
                    </td>
                    <td style={{ ...td, color: "var(--muted)" }}>{l.ip ?? "—"}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <ResultTag result={l.result} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const me = await requireModule("system");

  const { view } = await searchParams;
  const item = navItemByKey("settings");
  const active = activeSubView(item, view)?.key ?? "security";

  const [settings, dict, policies] = await Promise.all([
    loadSettings(),
    loadDict(),
    loadSecurityPolicies(),
  ]);

  // 原来这里在数据库不可用时会回落到 3 条带真人姓名的伪造日志。
  // 现在没有数据就是空态 —— 审计记录绝不能编造。
  const [opLogs, authLogs] = await Promise.all([
    listAuditLogs("operation", 100),
    listAuditLogs("auth", 100),
  ]);

  const levelLabel = (code: string | null) => {
    const t = toneOr(dict.maps.admin_level, code, "—");
    return { text: t.text, color: t.color, bg: t.bg };
  };

  return (
    <>
      <SubTabs item={item} active={active} />

      {active === "security" && (
        <SecurityPolicy policies={policies} security={settings.security} />
      )}

      {active === "notify" && <NotifyPanel rules={await getNotificationRules()} />}

      {active === "approval" && (
        <ApprovalPanel
          rules={await listApprovalRules()}
          requests={(await getApprovalRequests("pending")).filter((r) =>
            me.level === "L1" ? true : r.required_level !== "L1",
          )}
        />
      )}

      {active === "rules" && <RulesPanel settings={settings} />}

      {active === "dict" && <DictPanel entries={await listDictEntries()} />}

      {active === "logs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LogTable
            title="操作日志"
            subtitle="重要操作全程留痕"
            logs={opLogs ?? []}
            levelLabel={levelLabel}
          />
          <LogTable
            title="登录日志"
            subtitle="登录成功 / 失败 / 退出记录"
            logs={authLogs ?? []}
            levelLabel={levelLabel}
          />
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>留痕范围</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AUDITED_ACTIONS.map((x) => (
                <span
                  key={x}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "#4a514c",
                    background: "var(--bg)",
                    border: "1px solid var(--line)",
                    padding: "5px 11px",
                    borderRadius: 7,
                  }}
                >
                  {x}
                </span>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

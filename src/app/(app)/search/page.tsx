import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/Form";
import { requireAdmin } from "@/lib/auth/context";
import { searchAll, type SearchHit } from "@/lib/data/search";

export const dynamic = "force-dynamic";
export const metadata = { title: "全局搜索 · GUIYE 瑰野" };

const KIND_ICON: Record<SearchHit["kind"], "bag" | "users" | "box" | "truck"> = {
  order: "bag",
  customer: "users",
  product: "box",
  shipment: "truck",
};

function HitRow({ hit }: { hit: SearchHit }) {
  return (
    <Link
      href={hit.href}
      className="row-hover"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 8px",
        borderBottom: "1px solid var(--line)",
        textDecoration: "none",
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "var(--accent-soft)",
          color: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Icon name={KIND_ICON[hit.kind]} size={14} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#2c322e" }}>{hit.title}</span>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{hit.subtitle}</span>
      </div>
      <span
        style={{
          fontSize: 11.5,
          color: "var(--muted)",
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {hit.meta}
      </span>
      <Icon name="external" size={13} color="#c3c8c3" />
    </Link>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // 顶栏搜索框原来是一个没有 value / onChange / form 的纯装饰输入框。
  // 现在它会跳到这里，真的按关键词查库 —— 而且只查当前管理员有权看的模块。
  const me = await requireAdmin();
  const { q } = await searchParams;
  const results = await searchAll(q ?? "", me);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>
          {results.q ? `「${results.q}」的搜索结果` : "全局搜索"}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {results.q
            ? `命中 ${results.total} 条 · 覆盖订单号、客户、商品 SKU 与运单号${
                results.skipped.length > 0 ? `（无权限，已跳过：${results.skipped.join("、")}）` : ""
              }`
            : "在顶栏搜索框输入关键词，或按 ⌘K / Ctrl+K 聚焦"}
        </span>
      </Card>

      {results.q && results.total === 0 && (
        <Card>
          <EmptyState
            title="没有找到匹配的记录"
            hint="可以试试订单号（GY- 开头）、客户姓名或手机号、商品 SKU、物流单号。搜索只覆盖当前账号有权查看的模块。"
          />
        </Card>
      )}

      {results.groups.map((g) => (
        <Card key={g.key} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{g.label}</span>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {g.hits.length} 条{g.hits.length >= 20 ? "（仅显示前 20 条）" : ""}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {g.hits.map((h) => (
              <HitRow key={`${h.kind}-${h.id}`} hit={h} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { BrandAsset } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { ModulePlaceholder } from "@/components/ui/ModulePlaceholder";
import { Icon, type IconName } from "@/components/ui/Icon";

const kindMeta: Record<
  BrandAsset["kind"],
  { icon: IconName; color: string; bg: string }
> = {
  image: { icon: "image", color: "var(--accent)", bg: "#e9f5ef" },
  video: { icon: "video", color: "#8a6fb0", bg: "#f4f0fa" },
  doc: { icon: "file", color: "#2b6cb0", bg: "#eef4ff" },
  deck: { icon: "deck", color: "#c2703d", bg: "#fff5ec" },
};

// 官网内容 — editable site sections, not just file storage. This is the spec's
// key ask: the back-office should edit Banner / 产品介绍 / 品牌故事 directly.
const SITE_SECTIONS: {
  title: string;
  sub: string;
  icon: IconName;
  status: "published" | "draft";
  langs: string;
  updated: string;
}[] = [
  { title: "首页 Banner", sub: "主视觉 / 标语 / 跳转", icon: "image", status: "published", langs: "中 / EN", updated: "2026-06-18" },
  { title: "产品介绍", sub: "各产品详情与卖点", icon: "box", status: "published", langs: "中 / EN", updated: "2026-06-16" },
  { title: "品牌故事", sub: "瑰野品牌叙事", icon: "file", status: "published", langs: "中 / EN", updated: "2026-06-10" },
  { title: "饮用建议", sub: "搭配 / 场景 / 调饮", icon: "deck", status: "draft", langs: "中", updated: "2026-06-20" },
  { title: "新闻动态", sub: "活动与媒体报道", icon: "file", status: "published", langs: "中", updated: "2026-06-12" },
  { title: "联系方式", sub: "经销咨询 / 客服", icon: "mail", status: "published", langs: "中 / EN", updated: "2026-05-30" },
];

function WebsiteContent() {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>官网内容</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>直接编辑官网各板块，支持中英文文案</span>
        </div>
        <Button variant="primary" icon="plus">
          新增板块
        </Button>
      </div>
      <div>
        {SITE_SECTIONS.map((s, i) => (
          <div
            key={s.title}
            className="row-hover"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 4px",
              borderBottom: i === SITE_SECTIONS.length - 1 ? "none" : "1px solid var(--line)",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              <Icon name={s.icon} size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#2c322e" }}>{s.title}</span>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.sub}</span>
            </div>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                fontWeight: 600,
                color: "#5b6470",
                background: "var(--bg)",
                border: "1px solid var(--line)",
                padding: "3px 9px",
                borderRadius: 6,
                flex: "none",
              }}
            >
              {s.langs}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: s.status === "published" ? "#16894f" : "#b45309",
                background: s.status === "published" ? "#e9f5ef" : "#fff7ec",
                padding: "3px 10px",
                borderRadius: 20,
                flex: "none",
              }}
            >
              {s.status === "published" ? "已发布" : "草稿"}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)", flex: "none", width: 78, textAlign: "right" }}>
              {s.updated}
            </span>
            <Button variant="ghost" style={{ height: 30, padding: "0 12px", fontSize: 12.5, flex: "none" }}>
              编辑
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Which assets each library tab shows.
const VIEW_MATCH: Record<string, (a: BrandAsset) => boolean> = {
  media: (a) => a.kind === "image" || a.kind === "video",
  promo: (a) => a.category === "品牌手册",
  channel: (a) => a.category === "培训物料",
};

function AssetGrid({ assets, uploadLabel }: { assets: BrandAsset[]; uploadLabel: string }) {
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? assets.filter((a) => a.title.toLowerCase().includes(needle)) : assets;
  }, [assets, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 9,
            padding: "8px 12px",
            width: 240,
          }}
        >
          <Icon name="search" size={15} color="#9a9f9a" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索素材标题"
            style={{ border: "none", background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, color: "var(--ink)", width: "100%" }}
          />
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>共 {filtered.length} 个</span>
        <div style={{ marginLeft: "auto" }}>
          <Button variant="primary" icon="upload">
            {uploadLabel}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 0", fontSize: 13, color: "var(--muted)" }}>
          未找到匹配的素材
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(244px, 1fr))", gap: 14 }}>
          {filtered.map((asset) => {
            const meta = kindMeta[asset.kind];
            const isHovered = hovered === asset.id;
            return (
              <Card
                key={asset.id}
                padding="0"
                style={{
                  overflow: "hidden",
                  borderColor: isHovered ? "var(--accent-soft)" : "var(--line)",
                  boxShadow: isHovered ? "0 4px 14px rgba(31,122,92,.10)" : "none",
                  transition: "border-color .14s ease, box-shadow .14s ease",
                }}
              >
                <div onMouseEnter={() => setHovered(asset.id)} onMouseLeave={() => setHovered(null)}>
                  <div style={{ height: 124, display: "flex", alignItems: "center", justifyContent: "center", background: meta.bg }}>
                    <Icon name={meta.icon} size={30} color={meta.color} />
                  </div>
                  <div style={{ padding: 14 }}>
                    <Chip tone={{ text: asset.category, color: meta.color, bg: meta.bg }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#2c322e", marginTop: 8 }}>{asset.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{asset.size}</div>
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>更新 {asset.updated_at}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent)", cursor: "pointer" }}>查看</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const UPLOAD_LABEL: Record<string, string> = {
  media: "上传图片 / 视频",
  promo: "上传宣传资料",
  channel: "上传渠道资料",
};

export function BrandView({ assets, view = "website" }: { assets: BrandAsset[]; view?: string }) {
  if (view === "website") return <WebsiteContent />;
  if (view === "i18n") {
    return (
      <ModulePlaceholder
        icon="globe"
        title="多语言内容"
        description="统一管理官网与素材的多语言版本，支持中 / 英及更多语种，按字段维护翻译状态，面向海外渠道与展会。"
        fields={["语言", "对应页面 / 字段", "翻译状态", "负责人", "中文原文", "外文译文"]}
      />
    );
  }

  const match = VIEW_MATCH[view] ?? VIEW_MATCH.media;
  return <AssetGrid assets={assets.filter(match)} uploadLabel={UPLOAD_LABEL[view] ?? "上传素材"} />;
}

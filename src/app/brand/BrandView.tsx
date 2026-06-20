"use client";

import { useMemo, useState } from "react";
import type { BrandAsset } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";

const CATEGORIES = ["全部", "产品图", "视频", "培训物料", "品牌手册"] as const;

const kindMeta: Record<
  BrandAsset["kind"],
  { icon: IconName; color: string; bg: string }
> = {
  image: { icon: "image", color: "var(--accent)", bg: "#e9f5ef" },
  video: { icon: "video", color: "#8a6fb0", bg: "#f4f0fa" },
  doc: { icon: "file", color: "#2b6cb0", bg: "#eef4ff" },
  deck: { icon: "deck", color: "#c2703d", bg: "#fff5ec" },
};

export function BrandView({ assets }: { assets: BrandAsset[] }) {
  const [active, setActive] = useState<string>("全部");
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (active !== "全部" && a.category !== active) return false;
      if (needle && !a.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [assets, active, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              style={{
                padding: "7px 14px",
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                background: isActive ? "var(--accent)" : "var(--card)",
                color: isActive ? "#fff" : "#4a514c",
                border: isActive ? "1px solid var(--accent)" : "1px solid var(--line)",
              }}
            >
              {cat}
            </button>
          );
        })}

        <div
          style={{
            marginLeft: "auto",
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
            style={{
              border: "none",
              background: "none",
              outline: "none",
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--ink)",
              width: "100%",
            }}
          />
        </div>

        <Button variant="primary" icon="plus">
          上传素材
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "56px 0",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          未找到匹配的素材
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(244px, 1fr))",
            gap: 14,
          }}
        >
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
                <div
                  onMouseEnter={() => setHovered(asset.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    style={{
                      height: 124,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: meta.bg,
                    }}
                  >
                    <Icon name={meta.icon} size={30} color={meta.color} />
                  </div>

                  <div style={{ padding: 14 }}>
                    <Chip tone={{ text: asset.category, color: meta.color, bg: meta.bg }} />
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#2c322e",
                        marginTop: 8,
                        whiteSpace: "normal",
                      }}
                    >
                      {asset.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                      {asset.size}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
                        更新 {asset.updated_at}
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: "var(--accent)",
                          cursor: "pointer",
                        }}
                      >
                        查看
                      </span>
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

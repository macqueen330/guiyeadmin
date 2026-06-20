import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { getBrandAssets } from "@/lib/data/queries";
import { BrandView } from "./BrandView";

export default async function BrandPage() {
  const assets = await getBrandAssets();

  const countCat = (c: string) => assets.filter((a) => a.category === c).length;
  const docCount = assets.filter(
    (a) => a.category === "培训物料" || a.category === "品牌手册",
  ).length;

  const stats: Stat[] = [
    {
      label: "素材总数",
      value: String(assets.length),
      sub: "图片 / 视频 / 文档",
      icon: "file",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "产品图",
      value: String(countCat("产品图")),
      sub: "主图 / 详情页素材",
      icon: "image",
      iconColor: "var(--accent)",
      iconBg: "var(--accent-soft)",
    },
    {
      label: "视频",
      value: String(countCat("视频")),
      sub: "品牌片 / 产品视频",
      icon: "video",
      iconColor: "#8a6fb0",
      iconBg: "#f4f0fa",
    },
    {
      label: "文档与手册",
      value: String(docCount),
      sub: "培训物料 / 品牌手册",
      icon: "deck",
      iconColor: "#c2703d",
      iconBg: "#fff5ec",
    },
  ];

  return (
    <>
      <StatStrip stats={stats} />
      <BrandView assets={assets} />
    </>
  );
}

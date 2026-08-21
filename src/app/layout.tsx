import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://guiye-admin.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "GUIYE 瑰野 · 运营控制台",
  description: "瑰野 GUIYE 跨境订单、渠道、库存与履约数据总览后台",
  openGraph: {
    title: "GUIYE 瑰野 · 运营控制台",
    description: "跨境订单、渠道、库存与履约数据总览后台",
    url: siteUrl,
    siteName: "GUIYE 瑰野",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={manrope.variable}>
      <body>
        {children}
        {/*
          Vercel Web Analytics —— 页面浏览 / 访客数的实时看板（Vercel 控制台 →
          Analytics）。后台自己的一方埋点走 /api/analytics/collect → web_events，
          两者互补：Vercel 看流量，Supabase 看流量与订单的关系。
        */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

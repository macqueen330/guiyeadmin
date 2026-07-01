import type { Metadata } from "next";
import { Manrope } from "next/font/google";
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
      <body>{children}</body>
    </html>
  );
}

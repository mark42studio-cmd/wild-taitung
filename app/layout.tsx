import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_TC } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import TourGuide from '@/components/TourGuide';
import PwaInstallGuide from '@/components/PwaInstallGuide';
import { GoogleAnalytics } from '@next/third-parties/google';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifTC = Noto_Serif_TC({
  variable: "--font-noto-serif-tc",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wildtaitung.vercel.app';

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "野台東 Wild Taitung - 深度野旅行程規劃",
      "applicationCategory": ["TravelApplication", "GuideApplication"],
      "operatingSystem": "Web, iOS",
      "description": "專為台東深度探索者打造的 AI 野旅平台。聚合野溪溫泉、野外露營、隱藏秘境、衝浪潛水與生態保育資訊，規劃最具野性與療癒感的台東之旅。",
      "url": SITE_URL,
      "inLanguage": "zh-TW",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "TWD" },
      "featureList": ["野溪溫泉路線", "野旅露營規劃", "互動式探索地圖", "AI 野外嚮導", "衝浪浪況整合"],
      "author": {
        "@type": "Organization",
        "name": "一圈工作室 One Circle Studio",
        "email": "mark42studio@gmail.com",
      },
    },
    {
      "@type": "WebSite",
      "name": "野台東 Wild Taitung",
      "url": SITE_URL,
      "description": "台東深度野旅 AI 規劃平台，探索野溪溫泉、秘境露營與生態保育路線。",
      "inLanguage": "zh-TW",
      "publisher": {
        "@type": "Organization",
        "name": "一圈工作室 One Circle Studio",
      },
    },
  ],
};

export const viewport: Viewport = {
  themeColor: '#1B2E26',
};

export const metadata: Metadata = {
  title: {
    default: "野台東 Wild Taitung｜台東深度野旅行程規劃",
    template: "%s｜野台東 Wild Taitung",
  },
  description: "台東深度野旅 AI 規劃平台。聚合野溪溫泉、野外露營、隱藏秘境、衝浪潛水與生態保育路線，規劃最具野性與療癒感的台東之旅。栗松溫泉、卑南溪、都蘭山一鍵規劃。",
  keywords: ["台東野溪溫泉", "台東露營秘境", "台東衝浪", "栗松溫泉", "台東野旅", "台東溯溪", "台東登山", "台東 SUP", "台東生態旅遊", "台東秘境", "台東行程規劃", "台東深度旅遊"],
  manifest: "/manifest.json",
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "野台東",
  },
  openGraph: {
    title: "野台東 Wild Taitung｜台東深度野旅行程規劃",
    description: "台東深度野旅 AI 規劃平台。野溪溫泉、秘境露營、衝浪浪況一站整合。",
    locale: "zh_TW",
    type: "website",
    siteName: "野台東 Wild Taitung",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "野台東 Wild Taitung",
    description: "台東深度野旅 AI 規劃平台，探索野溪溫泉、露營秘境與生態路線。",
  },
  other: {
    "agd-partner-manual-verification": "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${geistSans.variable} ${geistMono.variable} ${notoSerifTC.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <GoogleAnalytics gaId="G-09SQ3LJ9GM" />

        <TourGuide />
        <PwaInstallGuide />

        {children}

        <footer className="mt-auto py-6 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Image src="/icon.png" alt="一圈工作室" width={24} height={24} className="opacity-70" />
          一圈工作室 | mark42studio@gmail.com
        </footer>
      </body>
    </html>
  );
}

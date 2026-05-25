import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.5.0.2"],

  async headers() {
    if (!isDev) return [];
    // 開發環境：允許 Turbopack HMR 所需的 eval 與 WebSocket 連線
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://maps.googleapis.com https://maps.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              // ws://* 允許 HMR WebSocket 不論 IP 為何
              "connect-src 'self' ws: wss: https: http:",
              "worker-src blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },

  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // 慢速硬碟環境關閉多進程編譯，降低記憶體峰值
    webpackBuildWorker: false,
    parallelServerCompiles: false,
  },
  images: {
    remotePatterns: [
      // ── 允許所有 HTTPS 外部圖片 ──────────────────────────────────
      // 爬蟲來源網域持續變動（縣府官網、售票平台、FB、活動管理系統…），
      // 無法逐一列舉，統一以雙星萬用字元開放 https，由前端的 isFbPageUrl
      // 守門員與 onError fallback 處理壞連結，不依賴白名單做安全邊界。
      { protocol: "https", hostname: "**" },

      // ── 保留 HTTP 僅限已知政府網域（部分縣府主機仍用 http）────────
      { protocol: "http", hostname: "**.gov.tw" },
      { protocol: "http", hostname: "culture.taitung.gov.tw" },
    ],

    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    // 此 CSP 僅作用於 /_next/image 圖片 API 回應，非頁面層級
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;

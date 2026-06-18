import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages デプロイ時はリポジトリ名に合わせて base を設定する(Phase 3)。
// 例: base: "/railmap/"。ローカル開発と相対配信のため既定は "./"。
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // PNG/SVG/ICO は workbox の globPatterns で取得するため includeAssets は空
      includeAssets: [],
      manifest: {
        name: "路線埋め立てマップ",
        short_name: "railmap",
        description: "乗った路線が光る！日本全国の鉄道路線埋め立てマップ",
        theme_color: "#0b0e14",
        background_color: "#0b0e14",
        display: "standalone",
        start_url: "./",
        icons: [
          { src: "pwa-64x64.png",          sizes: "64x64",   type: "image/png" },
          { src: "pwa-192x192.png",         sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png",         sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // data/*.geojson (路線/駅データ) をオフライン用にプレキャッシュ
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}", "data/*.{geojson,json}"],
        // lines.geojson は非圧縮 6MB 超のため制限を 10MB に引き上げ(gzip 後は ~0.5MB)
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
});

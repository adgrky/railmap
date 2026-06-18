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
      // data/*.geojson を含む precache は Phase 2(§11)で本設定。Phase1 は最小構成。
      includeAssets: [],
      manifest: {
        name: "路線埋め立てマップ",
        short_name: "railmap",
        theme_color: "#0b0e14",
        background_color: "#0b0e14",
        display: "standalone",
      },
      // Phase1 では SW を無効化(本実装は §11)
      disable: true,
    }),
  ],
});

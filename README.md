# 路線埋め立てマップ

乗った路線が光る、自分だけの日本地図を育てる鉄道乗りつぶしアプリ。

**[▶ アプリを開く](https://adgrky.github.io/railmap/)**

---

## 特徴

- **全597路線・27,725km** に対応（国土数値情報 N02-25 使用）
- 路線を塗るたびに光るアニメーション演出
- テーマカラー3色 / 効果音 ON/OFF
- 達成率・都道府県別統計
- 称号12種類
- SNS シェア画像を生成
- **データはすべて端末内のみ保存**（サーバー通信なし）
- PWA 対応・オフライン動作

## 使い方

1. 地図上の路線をタップ
2.「乗った！」ボタンを押すと路線が光る
3. 統計画面で走破距離・達成率を確認
4. シェア画像を作って X（Twitter）に投稿

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| UI | React 18 + TypeScript |
| 地図 | MapLibre GL JS |
| 状態管理 | Zustand |
| スタイル | Tailwind CSS |
| ビルド | Vite |
| PWA | vite-plugin-pwa |
| 地図タイル | OpenFreeMap |
| ホスティング | GitHub Pages |

## 出典

- 路線・駅データ: [国土数値情報 鉄道データ N02-25](https://nlftp.mlit.go.jp/ksj/)（国土交通省）
- 地図タイル: [OpenFreeMap](https://openfreemap.org/) / © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors

## ローカル開発

```bash
npm install
npm run dev
```

## ライセンス

MIT

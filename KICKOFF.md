# Claude Code 投入シーケンス

リポジトリ直下で Claude Code を起動し、各ブロックを **1メッセージずつ上から順に** 貼る。各フェーズ完了を確認してから次へ。仕様は `docs/SPEC.md` にあるので指示文に再記述しない。

> ⚠️ Phase 0 の前に: 国土数値情報 N02(鉄道)最新年度を https://nlftp.mlit.go.jp/ksj/ から手動DLし `tools/raw/` に置く(gitignore済)。

---

## 0. 初回(コードは書かない)
```
docs/SPEC.md と CLAUDE.md を読んで全体把握。§2のディレクトリ構成で空リポジトリを初期化。Vite+React18+TS(strict)+Tailwind v3+Zustand+MapLibre v4+vite-plugin-pwa を§1のバージョン方針で導入。完了したらPROGRESS.mdに記録。まだ機能実装はしない。
```

## 1. Phase 0(データパイプライン)
```
SPEC.md §1の⚠️事実確認を実施しVERIFIED.mdに記録 → §3を実装。N02実データの属性を確認してからpreprocess.pyを書く。受け入れ条件3点を満たし結果をVERIFIED.md/PROGRESS.mdに記録。
```

## 2. Phase 1(MVP)
```
SPEC.md Phase 1を実装(§5.1 / §5.2 / §4 / §8.1参照)。受け入れ条件3点を満たす。
```

## 3. Phase 2(1指示1機能。各完了で§12 Phase2の受け入れ条件を確認)
```
SPEC.md §6を実装(ダーク地図スタイル+グロー)。
```
↓確認後、以下を1つずつ
```
SPEC.md §7.1を実装(塗りアニメ)。
```
```
SPEC.md §5.3を実装(統計画面)。
```
```
SPEC.md §5.4と§9を実装(称号)。
```
```
SPEC.md §10を実装(シェア画像)。
```
```
SPEC.md §5.5を実装(設定+エクスポート/インポート/全消去)。
```
```
SPEC.md §11を実装(PWA)。
```

## 4. Phase 3(公開)
```
SPEC.md §11デプロイ + OGPメタタグ + README(スクショ入り)。受け入れ条件を満たす。区間塗りはPhase2の反応を見て別途判断。
```

## 最終
```
SPEC.md §13 検収チェックリストを全項目検証し、結果をPROGRESS.mdに記録。
```

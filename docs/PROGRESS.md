# 進捗・決定事項ログ

各フェーズ完了時、Claude Code が「完了 / 決定 / 残課題」を3行以内で追記する。

## Phase 0(データパイプライン) 2026-06-18
- 完了: §2構成へ整理+git初期化、preprocess.pyでN02-25→lines/stations/meta生成(597路線/10234駅/総延長27,725.7km)。受け入れ条件3点達成、VERIFIED.md記録。
- 決定: データはN02-25(令和7)をコードで自動DL。GeoJSON同梱を直接利用。gzip合計0.72MBで分割不要。地図ベースはdark実在を確認。
- 残課題: pref(都道府県)付与とrailType地下鉄判定の精緻化はPhase 2へ。

## Phase 1(MVP) 2026-06-18
- 完了: Vite+React18+TS(strict)+Tailwind+Zustand+MapLibre雛形、core層(store/persistence/progress)、app層(MapView/LineSheet/上部達成率バー/タブ器)。build・型チェック0エラー。
- 決定: geojson本体はMapLibreがURL直読み、metaのみApp fetch(§3.3)。Phase1ベース地図はpositron。地図検証用にDEV限定で window.__map 公開。
- 残課題: ①persistence/progress/リロード保持/全国%(山陰線685.2km→2.5%手計算一致)は検証済 ②地図描画と実タップ塗りは preview サンドボックスがMapLibreのload完了を通さず未検証→実ブラウザで要確認。アニメ/統計/称号/シェア/PWAはPhase2。

## Phase 2(体験を磨く) 2026-06-18〜19
- 完了: §6ダーク地図スタイル+グロー / §7.1塗りアニメ(光が走る600ms+グロー爆発150ms膨張→350ms収束) / §5.3統計 / §5.4称号 / §10シェア画像 / §5.5設定+入出力 / §11PWA設定。
- 演出追加(Phase2外チューニング): 閃光フラッシュ(全画面白500ms) / +kmポップ(テーマ色グロー文字浮き上がり950ms) / 白塗りバグ修正(乗済み路線は白ハイライト非表示)。
- 残課題: 実ブラウザ実機での総合動作確認。

## Phase 3(公開) 2026-06-19
- 完了: .github/workflows/deploy.yml(main push→GitHub Pages自動デプロイ) / OGP・Twitter Cardメタタグ / vite.config base="/railmap/" / README.md(出典・技術スタック記載)。
- 決定: GitHubリポジトリ名 railmap、公開URL https://adgrky.github.io/railmap/ を想定。
- 残課題: GitHub リポジトリ作成 → git remote add origin → git push でデプロイ完了。X でカード表示確認。区間塗り(status:"partial")はユーザー反応次第で Phase 3+α。

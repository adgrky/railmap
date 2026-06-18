# 進捗・決定事項ログ

各フェーズ完了時、Claude Code が「完了 / 決定 / 残課題」を3行以内で追記する。

## Phase 0(データパイプライン) 2026-06-18
- 完了: §2構成へ整理+git初期化、preprocess.pyでN02-25→lines/stations/meta生成(597路線/10234駅/総延長27,725.7km)。受け入れ条件3点達成、VERIFIED.md記録。
- 決定: データはN02-25(令和7)をコードで自動DL。GeoJSON同梱を直接利用。gzip合計0.72MBで分割不要。地図ベースはdark実在を確認。
- 残課題: pref(都道府県)付与とrailType地下鉄判定の精緻化はPhase 2へ。

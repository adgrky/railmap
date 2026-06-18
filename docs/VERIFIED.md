# 事実確認の記録(Phase 0)

## 1. OpenFreeMap スタイルJSON
- URL一覧(すべて HTTP 200 を確認):
  - https://tiles.openfreemap.org/styles/liberty
  - https://tiles.openfreemap.org/styles/positron
  - https://tiles.openfreemap.org/styles/bright
  - https://tiles.openfreemap.org/styles/dark
- ダーク系の有無: **あり**(`dark` スタイルが実在)
- 採用方針: §6 のダーク地図は `dark` をベースに配色を上書きする(Phase 2)。Phase 1(MVP)は `positron` を暫定ベースに使用。

## 2. 国土数値情報 N02(鉄道)
- 最新年度: **N02-25(令和7年度 / 2025年度)**
- 直リンク: https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-25/N02-25_GML.zip (200 / 14.9MB / application/zip / オープンデータ)
- 同梱物: UTF-8 / Shift-JIS の shp 一式 + **GeoJSON**(`N02-25_RailroadSection.geojson` 路線 21,933 / `N02-25_Station.geojson` 駅 10,234)。GeoJSON を直接利用。CRS=EPSG:6668(JGD2011地理座標)
- 属性フィールド名(実データ確認済):
  - `N02_001` = 鉄道区分(物理種別コード)
  - `N02_002` = 事業者種別: `1`新幹線 / `2`JR在来線 / `3`公営鉄道 / `4`民営鉄道 / `5`第三セクター
  - `N02_003` = 路線名 / `N02_004` = 運営会社
  - 駅のみ `N02_005` = 駅名, `N02_005c`/`N02_005g` = 駅グループコード
  - 鉄道区分(N02_001)実値: 11/12=普通鉄道, 13ケーブル, 14/15モノレール, 16案内軌条(新交通),
    21軌道(路面電車), 22-25 浮上式/モノレール/新交通
- railType マッピング表(tools/preprocess.py `classify_rail_type` に実装):
  1. 事業者種別=1 → 新幹線
  2. 事業者種別=2 → JR在来線
  3. 鉄道区分=21 → 路面・その他(軌道)
  4. 鉄道区分∈{13,14,15,16,22,23,24,25} → 路面・その他(ケーブル/モノレール/新交通/リニア)
  5. 運営会社名に「メトロ/地下鉄/高速電気軌道」を含む → 地下鉄
  6. 事業者種別=3(公営)の普通鉄道 → 地下鉄(近似)
  7. それ以外(民営/三セクの普通鉄道) → 私鉄
  - ⚠️ **残課題(Phase 2)**: N02 に地下鉄専用コードが無いため近似。公営の路面電車を含む地域や、
    地下鉄を一部しか持たない私鉄混在路線で誤分類の可能性。Phase 2 の称号(地下鉄%等)着手時に精緻化。

## 3. GeoJSON サイズ
- simplify 後 raw: lines 5.89MB / stations 1.76MB / meta 0.08MB
- simplify 後 gzip: lines 0.50MB / stations 0.21MB / meta 0.01MB → **路線+駅 合計 0.72MB**
- §3.4 分割配信の要否: **不要**(3MB gzip を大きく下回る)

## 生成結果サマリ(受け入れ条件)
- ① lines/stations/meta 生成: OK
- ② meta.totals.lengthKm = **27,725.7 km**(日本の鉄道総延長 約27,000km ±20% 内): OK
- ③ gzip サイズ報告: 上記の通り 3MB 未満: OK
- 路線数(lineId)=597 / 駅数=10,234
- railType別km: JR在来線16,733.3 / 私鉄6,790.3 / 新幹線2,942.3 / 路面・その他669.9 / 地下鉄589.9
- pref(都道府県)は未付与。SPEC §3.2/§8.1 の都道府県別は Phase 2 で N03 交差により対応(meta は pref:[] / byPref:{} で出力)。

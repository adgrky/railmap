# 路線埋め立てマップ 完全設計書(マスタープラン)

本書はリポジトリに `docs/SPEC.md` として配置する。Claude Code への指示は「SPEC.md の §X を実装。受け入れ条件を満たすこと」の形式で出す(トークン節約のため指示文に仕様を再記述しない)。本書に書かれていないことを Claude Code が勝手に判断・追加することを禁止する。曖昧な点は実装前に質問させる。

---

## §0. プロジェクト概要

| 項目 | 内容 |
|---|---|
| アプリ名(仮) | 路線埋め立てマップ(コード名: railmap) |
| 一言コンセプト | 乗った路線が光る、自分だけの日本地図を育てるアプリ |
| ターゲット | 鉄道好き・旅行好き・乗りつぶし勢(Xの鉄道クラスタ) |
| 差別化 | ①塗る瞬間の快感(発光・アニメ)②シェアしたくなる美しい画像 ③データ完全ローカルの安心感 |
| 維持費 | 0円(静的サイト+localStorage。サーバー・DB・APIキー一切なし) |
| 収益化(将来) | TWA化して Play Store 買い切り。Phase 4 で検討、本書スコープ外 |
| 横展開 | 本アプリの「地図塗りエンジン」を百名山版・道の駅版等に流用する。汎用化を意識した分離設計とする(§2) |

### 絶対原則(全フェーズ共通)

- 外部サーバーへのデータ送信は一切行わない(地図タイル取得を除く)
- ユーザーデータは localStorage のみ。スキーマには必ず `version` を持たせる
- ライブラリ追加は本書記載のもののみ。追加したい場合は実装前に提案・承認を得る
- 全コミュニケーション・コード内コメントは日本語

---

## §1. 技術スタック(確定。変更禁止)

| 領域 | 採用 | バージョン方針 |
|---|---|---|
| ビルド | Vite | 最新安定版 |
| UI | React 18 + TypeScript (strict) | |
| 地図 | MapLibre GL JS | v4系 |
| 状態管理 | Zustand | |
| スタイル | Tailwind CSS | v3系 |
| PWA | vite-plugin-pwa | |
| 画像生成 | Canvas API 直書き(html2canvas は使わない。地図は `map.getCanvas()` から取得) | |
| データ前処理 | Python 3.11+ / geopandas / shapely / pyproj(ローカル実行のみ、配布物に含めない) | |
| 地図タイル | OpenFreeMap(無料・APIキー不要・商用可) | |
| ホスティング | GitHub Pages(GitHub Actions で自動デプロイ) | |

### ⚠️ 実装前の事実確認タスク(Phase 0 冒頭で必ず実施)

推測で進めず、以下を実際に確認して結果を `docs/VERIFIED.md` に記録すること:

1. OpenFreeMap のスタイルJSON URL 一覧(https://openfreemap.org)。ダーク系スタイルの有無。なければ liberty/positron をベースに §6 の配色へ上書きする方針で確定
2. 国土数値情報 N02(鉄道データ)の最新年度・属性フィールド名(年度によりフィールド構成が変わるため、ダウンロードした実データの属性を確認してから前処理コードを書く)
3. GeoJSON 全路線データの実サイズ(simplify 前後)。3MB(gzip後)を超える場合は §3.4 の分割配信を採用

---

## §2. リポジトリ構成

```
railmap/
├── docs/
│   ├── SPEC.md              # 本書
│   ├── VERIFIED.md          # 事実確認の記録
│   └── PROGRESS.md          # フェーズ進捗・決定事項ログ
├── tools/                   # データ前処理(Python、配布物に含めない)
│   ├── preprocess.py
│   └── requirements.txt
├── public/
│   └── data/
│       ├── lines.geojson    # 前処理済み路線データ
│       ├── stations.geojson # 前処理済み駅データ
│       └── meta.json        # 路線メタ情報(距離等)
├── src/
│   ├── core/                # ★汎用エンジン(他の埋め立てアプリに流用する層)
│   │   ├── store.ts         # 塗り状態の Zustand ストア
│   │   ├── persistence.ts   # localStorage 保存/読込/エクスポート/インポート
│   │   ├── progress.ts      # 達成率計算
│   │   ├── achievements.ts  # 称号判定エンジン(定義はJSONで注入)
│   │   └── shareImage.ts    # シェア画像生成
│   ├── app/                 # ★railmap 固有層
│   │   ├── App.tsx
│   │   ├── MapView.tsx      # MapLibre ラッパ
│   │   ├── LineSheet.tsx    # 路線タップ時のボトムシート
│   │   ├── StatsPanel.tsx   # 統計パネル
│   │   ├── AchievementsView.tsx
│   │   ├── SettingsView.tsx
│   │   └── achievementDefs.ts # 称号定義(§9)
│   └── types.ts
├── index.html
└── .github/workflows/deploy.yml
```

`core/` から `app/` への依存は禁止(逆のみ可)。`core/` は「GeoJSON+塗り状態+達成率+称号+シェア画像」だけを知る汎用層。

---

## §3. データ仕様

### 3.1 ソース

- 国土数値情報 N02(鉄道)最新年度。https://nlftp.mlit.go.jp/ksj/ から手動ダウンロードし `tools/raw/` に配置(gitignore)
- ライセンス表記(出典: 国土数値情報)をアプリの設定画面と README に必ず記載

### 3.2 前処理(tools/preprocess.py)

入力: N02 シェープファイル(またはGeoJSON)

処理:

- 路線ID生成: `lineId = normalize(運営会社) + "__" + normalize(路線名)`(normalize = 全角空白除去・トリム)
- 同一 lineId の複数 LineString はそのまま FeatureCollection 内に保持し、各 feature に `lineId` と連番 `segIdx` を付与(将来の区間塗りに使う)
- ジオメトリ簡略化: shapely `simplify(tolerance=0.0005, preserve_topology=True)`。表示が破綻する場合のみ tolerance を調整し VERIFIED.md に記録
- 距離計算: EPSG:6933 に投影して路線ごとの総延長 km を算出(小数1桁)

出力:

- `lines.geojson` … properties: `lineId, operator, lineName, segIdx, railType`(新幹線/JR在来線/私鉄/地下鉄/路面・その他)
- `stations.geojson` … properties: `stationId, name, lineId`
- `meta.json` … `{ lines: { [lineId]: { operator, lineName, lengthKm, railType, pref: string[] } }, totals: { lengthKm, lineCount, stationCount, byPref: {...}, byRailType: {...} } }`
- `pref`(都道府県)は路線ジオメトリと国土数値情報の行政区域ポリゴン(N03)との交差判定で付与

`railType` の分類は N02 の鉄道区分・事業者種別フィールドから機械的にマッピングする(マッピング表は実データ確認後に preprocess.py 冒頭へ定数として記述)。

### 3.3 配信フォーマット

- GeoJSON は minify。gzip は GitHub Pages が自動付与
- アプリ起動時に fetch → IndexedDB ではなくメモリ保持のみ(データは毎回 fetch、HTTP キャッシュと PWA precache に任せる)

### 3.4 サイズ超過時のフォールバック(3MB gzip 超の場合のみ)

- railType 別に lines を4ファイル分割し、初期表示は新幹線+JR、残りは遅延ロード

---

## §4. ユーザーデータモデル(localStorage)

キー: `railmap.v1`

```ts
type SaveData = {
  version: 1;
  updatedAt: string;            // ISO8601
  rides: {
    [lineId: string]: {
      status: "full";           // Phase 3 で "partial" を追加予定
      firstDate?: string;       // YYYY-MM-DD 任意
      count: number;            // 乗車回数、既定1
      memo?: string;            // 140字まで
    };
  };
  visitedStations: string[];    // stationId 配列(Phase 2)
  settings: { theme: "neon-blue" | "neon-green" | "neon-pink"; sound: boolean };
  unlockedAchievements: { [id: string]: string }; // id -> 解除日時
};
```

- 書込は変更操作のたび即時(debounce 300ms)
- 起動時に version を見てマイグレーション関数を通す設計にしておく(v1→v2 の枠だけ用意)
- エクスポート: 上記JSONをそのまま `railmap-backup-YYYYMMDD.json` としてダウンロード
- インポート: ファイル選択 → version 検証 → 「現在のデータを上書きします」確認 → 反映。壊れたファイルはエラーメッセージ表示で中断(現データは保持)

---

## §5. 画面仕様

SPA・モバイルファースト(基準幅 390px)。画面は4つ+1モーダル。下部タブバーで切替: 🗾地図 / 📊統計 / 🏆称号 / ⚙️設定

### 5.1 地図画面(メイン)

- 全画面 MapLibre。初期表示: 日本全体(center `[137.0, 38.0]` / zoom 4.8)
- レイヤー構成(下から): ベースタイル → 未乗路線(グレー `#3a3f4a`, width 1.5) → 乗車済グロー下層(テーマ色 60%透過, width 6, blur) → 乗車済本線(テーマ色, width 2.5) → 駅(zoom≥9 でのみ表示, circle)
- 画面上部に常時オーバーレイ: `全国 12.4% ▏███░░░░░` ミニ達成バー+総走破距離
- 路線タップ → 該当路線を白くハイライト+ §5.2 ボトムシート表示
- タップ判定は `queryRenderedFeatures` に padding 8px

### 5.2 路線ボトムシート

表示項目: 路線名 / 会社名 / 総延長km / 都道府県

操作:

- 未乗時: [🚃 乗った!] 大ボタン1つ。押下 → §7.1 の塗りアニメ → シート内が乗車済表示に切替
- 乗車済時: 初乗り日(date入力・任意)/ 回数(+/-)/ メモ / 取り消す
- 閉じる: 下スワイプ or 地図タップ

### 5.3 統計画面

上から順に:

1. ヒーローカード: 総走破距離(でかい数字)+換算文言(§8.3)
2. 達成率カード: 全国% / 新幹線% / JR% / 私鉄% / 地下鉄%(横棒)
3. 都道府県別グリッド(47マス、達成率で色の濃さ5段階。タップでその県へ地図ジャンプ)
4. [📸 シェア画像をつくる] ボタン → §10

グラフライブラリは使わない。すべて div+CSS で描く

### 5.4 称号画面

- §9 の称号をカード一覧。未解除はシルエット+条件文、解除済はカラー+解除日
- 解除済カードタップ → その称号入りシェア画像生成(§10 のバリアント)

### 5.5 設定画面

- テーマカラー選択(3色) / 効果音 ON/OFF
- データ: エクスポート / インポート / 全消去(2段階確認)
- 出典表記(国土数値情報・OpenFreeMap・OSM)/ バージョン / プライバシー文言「すべてのデータは端末内にのみ保存されます」

---

## §6. デザイントークン(確定値)

```css
--bg: #0b0e14;            /* アプリ背景 */
--surface: #151a23;       /* カード・シート */
--surface-2: #1e2530;
--text: #e8ecf4;
--text-dim: #8b93a3;
--line-unvisited: #3a3f4a;
--accent-blue: #38bdf8;   /* テーマ: neon-blue(既定) */
--accent-green: #34d399;  /* テーマ: neon-green */
--accent-pink: #f472b6;   /* テーマ: neon-pink */
--gold: #fbbf24;          /* 称号・達成演出 */
--danger: #f87171;
--radius: 14px;
```

- フォント: システムフォント(`-apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`)。数字のみ `font-variant-numeric: tabular-nums`
- ベース地図はダークに調整(タイルスタイルJSONの background/water/land を上記 `--bg` 系に上書き。道路・建物ラベルは極力消し、地形と県境と水域だけ残す=路線が主役)
- 影は使わずグロー(`box-shadow: 0 0 12px {accent}40`)で統一
- タップ領域は最小 44×44px

---

## §7. インタラクション仕様

### 7.1 塗りアニメーション(最重要・手抜き禁止)

[乗った!] 押下時:

1. 路線の `line-gradient` を使い、始点→終点へ光が走る(600ms, ease-out)。MapLibre の `line-gradient` + `requestAnimationFrame` で進捗プロパティを更新
2. 完了と同時にグロー層をフェードイン(300ms)
3. 上部の達成率バーが旧値→新値へカウントアップ(数字はカチカチ回る)
4. 効果音ON時: 短い「ポーン」(Web Audio API で合成、音源ファイル不使用、200ms以下)
5. `prefers-reduced-motion` 時はアニメ省略で即時反映

### 7.2 称号解除演出

条件達成時、画面下からトースト(ゴールド縁取り)「🏆 称号獲得: 関東制覇」3秒表示 → タップで称号画面へ

---

## §8. 達成率・統計ロジック(core/progress.ts)

### 8.1 定義

- 達成率はすべて **距離ベース**: `Σ(乗車済 lineId の lengthKm) / 対象範囲の総 lengthKm`
- 都道府県別: 複数県をまたぐ路線は、その県に属する区間距離で按分…は前処理が重いため v1 では「路線が通る各県すべてに全距離を計上」する近似 とし、統計画面に「※県境路線は両県に計上」と注記。厳密化は将来課題として PROGRESS.md に記録
- 小数1桁表示。0%超〜0.05%は「0.1%未満」と表示(ゼロに見せない)

### 8.2 駅

`visitedStations` は達成率に含めない(v1 は表示のみ: 「訪問駅 123 / 9,000」)

### 8.3 換算文言(統計ヒーロー用、距離に応じて自動選択)

| 累計距離 | 文言 |
|---|---|
| 〜500km | 東京→大阪 ◯往復分 |
| 〜3,000km | 日本縦断 ◯回分(2,800kmで1回) |
| 〜40,075km | 地球一周まで あと◯km |
| それ以上 | 地球 ◯周分 |

---

## §9. 称号定義(app/achievementDefs.ts、v1 は12個)

| id | 名称 | 条件 |
|---|---|---|
| first_ride | はじめの一歩 | 初めて路線を塗る |
| shinkansen_first | 超特急デビュー | 新幹線を1路線塗る |
| shinkansen_all | 新幹線コンプリート | 新幹線100% |
| pref_first | ご当地マスター | いずれかの都道府県100% |
| kanto | 関東制覇 | 関東1都6県すべて100% |
| kansai | 関西制覇 | 2府4県100% |
| km_1000 | 1,000kmクラブ | 累計1,000km |
| km_5000 | 5,000kmクラブ | 累計5,000km |
| km_10000 | 1万kmクラブ | 累計10,000km |
| local_hunter | ローカル線ハンター | 私鉄・第三セクター系を20路線 |
| subway_master | 地下鉄マスター | 地下鉄カテゴリ50% |
| national_25 | 日本四分の一 | 全国25% |

判定エンジン(core/achievements.ts)は「定義配列を受け取り、現在の統計値に対して未解除のものを評価して新規解除を返す」純関数。条件は `(stats) => boolean` で定義注入。

---

## §10. シェア画像(core/shareImage.ts)

- サイズ 1200×630(X のOGP比率)、クライアント側 Canvas で生成 → PNG ダウンロード+ Web Share API(対応端末)
- 構図(固定レイアウト):
  - 背景: `--bg`、上に地図キャンバスのスナップショット(`map.getCanvas()` を日本全体ビューで撮影。撮影用に一時的にカメラを全国ビューへ移動→撮影→元に戻す)
  - 左下: `全国 12.4%`(72px bold, テーマ色) / `総走破 3,482km・日本縦断1.2回分`(28px)
  - 右下: アプリ名+URL(小さく、`--text-dim`)
- 称号バリアント: 中央に称号名+ゴールド枠
- 生成ボタン押下から2秒以内に完了すること

---

## §11. PWA / デプロイ

- vite-plugin-pwa: `registerType: autoUpdate`、precache に `data/*.geojson` を含める(オフラインで全機能動作)
- manifest: name「路線埋め立てマップ」/ theme_color `#0b0e14` / アイコンはプレースホルダSVG(光る路線の抽象図形)を Phase 2 で生成
- GitHub Actions: main push → build → gh-pages デプロイ。`vite.config.ts` の `base` をリポジトリ名に設定

---

## §12. フェーズ計画と Claude Code への指示テンプレ

各フェーズ完了時、Claude Code に `docs/PROGRESS.md` へ「完了項目・決定事項・残課題」を3行以内で追記させる。次フェーズの指示はそれを前提にできるので毎回の説明が不要になる。

### Phase 0: データパイプライン(0.5日)

- 事実確認(§1の⚠️)→ VERIFIED.md 記録
- preprocess.py 実装、public/data/ 生成
- 受け入れ条件: ①lines/stations/meta が生成される ②meta.totals.lengthKm が常識的(日本の鉄道総延長 約27,000km±20%)③gzip後サイズ報告
- 指示例: `リポジトリ初期化後、docs/SPEC.md §1の⚠️と§3を実施。受け入れ条件3点を満たし、結果をVERIFIED.mdとPROGRESS.mdに記録`

### Phase 1: 動くMVP(1〜2日)

- §2 構成で Vite+React 雛形 / §5.1 地図表示 / §5.2 シート(乗った!と取り消しのみ)/ §4 保存 / §8 全国達成率のみ
- アニメ・装飾なし。グレーと単色塗り分けまで
- 受け入れ条件: ①路線タップ→塗り→リロードで保持 ②全国%が距離ベースで正しい ③スマホ実機で60fpsパン
- 指示例: `SPEC.md Phase 1を実装。§5.1/§5.2/§4/§8.1参照。受け入れ条件3点`

### Phase 2: 体験を磨く(2〜3日)← ここが勝負

- §6 ダーク地図スタイル+グロー / §7.1 塗りアニメ / §5.3 統計画面 / §5.4・§9 称号 / §10 シェア画像 / §5.5 設定+入出力 / §11 PWA
- 受け入れ条件: ①塗りアニメが仕様通り ②シェア画像が2秒以内に正しく生成 ③エクスポート→全消去→インポートで完全復元 ④Lighthouse PWA合格
- 指示は機能単位で分割して出す(例: `SPEC.md §7.1のみ実装` → 確認 → `§10実装`)。1指示1機能

### Phase 3: 公開と区間塗り(1日+α)

- §11 デプロイ / OGPメタタグ / README(スクショ入り)
- 区間塗り(`status:"partial"`、segIdx 単位トグル)— Phase 2 の反応を見てから着手判断
- 受け入れ条件: 公開URLでフル動作、X でカード表示確認

### Phase 4(本書スコープ外・メモのみ)

- TWA化 / Play Store / プレミアム(廃線データ・詳細統計)/ 百名山版へのエンジン流用

---

## §13. 検収チェックリスト(最終)

- [ ] 機内モード(タイル除く)で全機能動作
- [ ] localStorage 破損JSON を仕込んでも起動する(初期化フォールバック)
- [ ] 路線数の多いズームレベルでカクつかない(iPhone SE 級を想定)
- [ ] 文言に英語が混ざっていない
- [ ] 出典表記あり(国土数値情報 / OpenFreeMap / © OpenStreetMap contributors)
- [ ] console にエラー・警告ゼロ
- [ ] 達成率の手計算検証: 任意の3路線を塗り、meta.json の距離合計と表示%が一致

---

## 付録A: Claude Code 運用ルール(初回セッション冒頭に1度だけ渡す)

```
このリポジトリの唯一の仕様書は docs/SPEC.md。
- 仕様にない実装・ライブラリ追加・デザイン変更は禁止。曖昧なら実装前に質問
- 実データ・実設定値を確認してからコードを書く(推測禁止)
- 各タスク完了時 PROGRESS.md に3行以内で記録
- 回答は簡潔に。コード全文の再掲不要、変更点のみ報告
```

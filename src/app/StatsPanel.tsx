// 統計画面(SPEC §5.3)。div+CSS のみ。グラフライブラリ不使用(§5.3)。app層。
import type { Meta, RailType, SaveData } from "../types";
import { conversionText, formatRatio, railTypeRatio, riddenKm } from "../core/progress";

// §8.1 注: 都道府県データは Phase 2 時点で pref:[] のため都道府県グリッドは距離0で描画。
// 都道府県別集計の精緻化は Phase 2 残課題(PROGRESS.md)。

const RAIL_TYPE_LABELS: [RailType, string][] = [
  ["新幹線",     "🚅 新幹線"],
  ["JR在来線",   "🚃 JR在来線"],
  ["私鉄",       "🚇 私鉄"],
  ["地下鉄",     "🚊 地下鉄"],
  ["路面・その他","🚋 路面・その他"],
];

// 47都道府県(順序は§5.3の「グリッド」表示用)
const PREFS = [
  "北海道","青森","岩手","宮城","秋田","山形","福島",
  "茨城","栃木","群馬","埼玉","千葉","東京","神奈川",
  "新潟","富山","石川","福井","山梨","長野","岐阜",
  "静岡","愛知","三重","滋賀","京都","大阪","兵庫",
  "奈良","和歌山","鳥取","島根","岡山","広島","山口",
  "徳島","香川","愛媛","高知","福岡","佐賀","長崎",
  "熊本","大分","宮崎","鹿児島","沖縄",
];

/** 0〜1 の達成率を 0〜4 の段階に変換(5段階)。 */
function ratioLevel(r: number): 0 | 1 | 2 | 3 | 4 {
  if (r <= 0) return 0;
  if (r < 0.25) return 1;
  if (r < 0.5)  return 2;
  if (r < 0.75) return 3;
  return 4;
}

type Props = {
  meta: Meta;
  rides: SaveData["rides"];
  themeColor: string;
  onJumpToPref?: (pref: string) => void;
  onOpenShare?: () => void;
};

export function StatsPanel({ meta, rides, themeColor, onJumpToPref, onOpenShare }: Props) {
  const km = riddenKm(meta, rides);
  const nationalPct = (km / meta.totals.lengthKm * 100);

  const convert = conversionText(km);

  // 都道府県別: prefごとに乗車済路線の距離を合計(近似: §8.1 の通り全区間計上)
  const prefRidden: Record<string, number> = {};
  const prefTotal: Record<string, number> = {};
  for (const [lineId, m] of Object.entries(meta.lines)) {
    for (const pref of m.pref) {
      prefTotal[pref] = (prefTotal[pref] ?? 0) + m.lengthKm;
      if (rides[lineId]) prefRidden[pref] = (prefRidden[pref] ?? 0) + m.lengthKm;
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-bg pb-20">
      <div className="mx-auto max-w-md space-y-4 p-4">

        {/* ヒーローカード(§5.3 1.) */}
        <div className="rounded-token bg-surface p-5 text-center">
          <p className="text-sm text-text-dim">総走破距離</p>
          <p className="tnum mt-1 text-5xl font-black" style={{ color: themeColor }}>
            {km.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}
            <span className="ml-1 text-xl font-semibold text-text-dim">km</span>
          </p>
          {convert && <p className="mt-2 text-sm text-text-dim">{convert}</p>}
        </div>

        {/* 達成率カード(§5.3 2.) */}
        <div className="rounded-token bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-text-dim">達成率</h2>
          <div className="space-y-2">
            <RatioBar
              label="🗾 全国"
              ratio={nationalPct / 100}
              themeColor={themeColor}
            />
            {RAIL_TYPE_LABELS.map(([type, label]) => (
              <RatioBar
                key={type}
                label={label}
                ratio={railTypeRatio(meta, rides, type)}
                themeColor={themeColor}
              />
            ))}
          </div>
        </div>

        {/* 都道府県別グリッド(§5.3 3.) */}
        <div className="rounded-token bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold text-text-dim">都道府県別</h2>
          <p className="mb-3 text-[10px] text-text-dim">※県境をまたぐ路線は両県に計上</p>
          <div className="grid grid-cols-7 gap-1">
            {PREFS.map((pref) => {
              const total = prefTotal[pref] ?? 0;
              const ridden = prefRidden[pref] ?? 0;
              const ratio = total > 0 ? ridden / total : 0;
              const level = ratioLevel(ratio);
              return (
                <button
                  key={pref}
                  onClick={() => onJumpToPref?.(pref)}
                  title={`${pref} ${formatRatio(ratio)}`}
                  className="flex aspect-square items-center justify-center rounded text-[7px] leading-tight text-text-dim transition-opacity hover:opacity-80"
                  style={{
                    background: level === 0
                      ? "#1e2530"
                      : `rgba(${hexToRgbParts(themeColor)},${0.15 + level * 0.2})`,
                    color: level >= 3 ? "#e8ecf4" : undefined,
                  }}
                >
                  {pref.slice(0, 2)}
                </button>
              );
            })}
          </div>
          {Object.keys(prefTotal).length === 0 && (
            <p className="mt-2 text-center text-xs text-text-dim">
              都道府県データは Phase 2 で追加予定
            </p>
          )}
        </div>

        {/* シェアボタン(§5.3 4.) */}
        <button
          onClick={onOpenShare}
          className="w-full rounded-token bg-surface py-4 text-base font-semibold text-text hover:bg-surface-2"
        >
          📸 シェア画像をつくる
        </button>
      </div>
    </div>
  );
}

function RatioBar({ label, ratio, themeColor }: { label: string; ratio: number; themeColor: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 text-text-dim">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-surface-2" style={{ height: 6 }}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(100, ratio * 100)}%`, background: themeColor }}
        />
      </div>
      <span className="tnum w-14 text-right text-xs text-text">{formatRatio(ratio)}</span>
    </div>
  );
}

function hexToRgbParts(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

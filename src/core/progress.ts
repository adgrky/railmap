// 達成率計算(SPEC §8.1)。core層: app に依存しない。距離ベース。
import type { Meta, SaveData } from "../types";

/** 乗車済 lineId の総走破距離(km)。meta に存在しない lineId は無視。 */
export function riddenKm(meta: Meta, rides: SaveData["rides"]): number {
  let sum = 0;
  for (const lineId of Object.keys(rides)) {
    const m = meta.lines[lineId];
    if (m) sum += m.lengthKm;
  }
  return Math.round(sum * 10) / 10;
}

/** 全国達成率(0〜1)。距離ベース = 乗車済km / 総km(SPEC §8.1)。 */
export function nationalRatio(meta: Meta, rides: SaveData["rides"]): number {
  const total = meta.totals.lengthKm;
  if (total <= 0) return 0;
  return riddenKm(meta, rides) / total;
}

/**
 * 達成率の表示用文字列(SPEC §8.1)。
 * 小数1桁。0%超〜0.05%は「0.1%未満」と表示(ゼロに見せない)。
 */
export function formatRatio(ratio: number): string {
  const pct = ratio * 100;
  if (pct <= 0) return "0%";
  if (pct < 0.05) return "0.1%未満";
  return `${pct.toFixed(1)}%`;
}

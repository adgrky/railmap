// 称号判定エンジン(SPEC §9)。core層: app に依存しない純関数。
// 定義配列を受け取り、現在の統計値に対して未解除のものを評価して新規解除を返す。
import type { Meta, SaveData } from "../types";
import { nationalRatio, railTypeRatio, riddenKm } from "./progress";

/** 称号定義(app から注入、core は構造だけ知る)。 */
export type AchievementDef = {
  id: string;
  name: string;
  condition: string;       // 画面表示用テキスト
  check: (stats: AchievementStats) => boolean;
};

/** 判定に必要な統計値セット。 */
export type AchievementStats = {
  rideCount: number;
  riddenKm: number;
  nationalRatio: number;
  shinkansenRatio: number;
  jrRatio: number;
  subwayRatio: number;
  privateCount: number;     // 私鉄・第三セクターの乗車済路線数
  prefCompletion: Record<string, number>; // 都道府県 → 達成率(0〜1)
};

/** 現在の保存データと meta から統計値を計算する。 */
export function buildStats(meta: Meta, rides: SaveData["rides"]): AchievementStats {
  const rideCount = Object.keys(rides).length;
  const km = riddenKm(meta, rides);

  // 私鉄＋第三セクター系の乗車路線数(「local_hunter」判定用)
  let privateCount = 0;
  for (const lineId of Object.keys(rides)) {
    const m = meta.lines[lineId];
    if (m && (m.railType === "私鉄" || m.railType === "路面・その他")) privateCount++;
  }

  // 都道府県別達成率(pref が付与されていれば計算、未付与は空)
  const prefRidden: Record<string, number> = {};
  const prefTotal: Record<string, number> = {};
  for (const [lineId, m] of Object.entries(meta.lines)) {
    for (const pref of m.pref) {
      prefTotal[pref] = (prefTotal[pref] ?? 0) + m.lengthKm;
      if (rides[lineId]) prefRidden[pref] = (prefRidden[pref] ?? 0) + m.lengthKm;
    }
  }
  const prefCompletion: Record<string, number> = {};
  for (const pref of Object.keys(prefTotal)) {
    prefCompletion[pref] = (prefRidden[pref] ?? 0) / prefTotal[pref];
  }

  return {
    rideCount,
    riddenKm: km,
    nationalRatio: nationalRatio(meta, rides),
    shinkansenRatio: railTypeRatio(meta, rides, "新幹線"),
    jrRatio: railTypeRatio(meta, rides, "JR在来線"),
    subwayRatio: railTypeRatio(meta, rides, "地下鉄"),
    privateCount,
    prefCompletion,
  };
}

/**
 * 未解除の称号を評価し、新規解除リストを返す(pure function, §9)。
 * 呼び出し側が `unlockedAchievements` に追記して保存する。
 */
export function checkNewAchievements(
  defs: AchievementDef[],
  stats: AchievementStats,
  already: Record<string, string>
): string[] {
  const newIds: string[] = [];
  for (const def of defs) {
    if (!already[def.id] && def.check(stats)) {
      newIds.push(def.id);
    }
  }
  return newIds;
}

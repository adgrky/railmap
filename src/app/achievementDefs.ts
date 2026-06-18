// 称号定義(SPEC §9)。app層: railmap 固有。12個。
// 条件は `(stats) => boolean` で注入。判定エンジン(core/achievements.ts)は定義を知らない。
import type { AchievementDef } from "../core/achievements";

const KANTO_PREFS = ["東京", "神奈川", "埼玉", "千葉", "茨城", "栃木", "群馬"];
const KANSAI_PREFS = ["大阪", "京都", "兵庫", "奈良", "和歌山", "滋賀"];

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: "first_ride",
    name: "はじめの一歩",
    condition: "初めて路線を塗る",
    check: (s) => s.rideCount >= 1,
  },
  {
    id: "shinkansen_first",
    name: "超特急デビュー",
    condition: "新幹線を1路線塗る",
    check: (s) => s.shinkansenRatio > 0,
  },
  {
    id: "shinkansen_all",
    name: "新幹線コンプリート",
    condition: "新幹線100%",
    check: (s) => s.shinkansenRatio >= 1,
  },
  {
    id: "pref_first",
    name: "ご当地マスター",
    condition: "いずれかの都道府県100%",
    check: (s) => Object.values(s.prefCompletion).some((r) => r >= 1),
  },
  {
    id: "kanto",
    name: "関東制覇",
    condition: "関東1都6県すべて100%",
    check: (s) => KANTO_PREFS.every((p) => (s.prefCompletion[p] ?? 0) >= 1),
  },
  {
    id: "kansai",
    name: "関西制覇",
    condition: "2府4県100%",
    check: (s) => KANSAI_PREFS.every((p) => (s.prefCompletion[p] ?? 0) >= 1),
  },
  {
    id: "km_1000",
    name: "1,000kmクラブ",
    condition: "累計1,000km",
    check: (s) => s.riddenKm >= 1000,
  },
  {
    id: "km_5000",
    name: "5,000kmクラブ",
    condition: "累計5,000km",
    check: (s) => s.riddenKm >= 5000,
  },
  {
    id: "km_10000",
    name: "1万kmクラブ",
    condition: "累計10,000km",
    check: (s) => s.riddenKm >= 10000,
  },
  {
    id: "local_hunter",
    name: "ローカル線ハンター",
    condition: "私鉄・第三セクター系を20路線",
    check: (s) => s.privateCount >= 20,
  },
  {
    id: "subway_master",
    name: "地下鉄マスター",
    condition: "地下鉄カテゴリ50%",
    check: (s) => s.subwayRatio >= 0.5,
  },
  {
    id: "national_25",
    name: "日本四分の一",
    condition: "全国25%",
    check: (s) => s.nationalRatio >= 0.25,
  },
];

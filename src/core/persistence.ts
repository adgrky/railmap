// localStorage 保存/読込/マイグレーション(SPEC §4)。core層: app に依存しない。
import type { SaveData, ThemeColor } from "../types";

const STORAGE_KEY = "railmap.v1";
const CURRENT_VERSION = 1 as const;

/** 初期データ(破損時のフォールバックにも使う、SPEC §13)。 */
export function createInitialData(): SaveData {
  return {
    version: CURRENT_VERSION,
    updatedAt: new Date().toISOString(),
    rides: {},
    visitedStations: [],
    settings: { theme: "neon-blue", sound: true },
    unlockedAchievements: {},
  };
}

/**
 * version を見てマイグレーションを通す(SPEC §4: v1→v2 の枠だけ用意)。
 * 未知/将来バージョンや構造不正は初期化フォールバック。
 */
function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== "object") return createInitialData();
  const data = raw as Partial<SaveData> & { version?: number };
  switch (data.version) {
    case 1:
      // 必須フィールドの最低限の健全性チェック(壊れていれば初期化)
      if (typeof data.rides !== "object" || data.rides === null) return createInitialData();
      return {
        version: 1,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
        rides: data.rides as SaveData["rides"],
        visitedStations: Array.isArray(data.visitedStations) ? data.visitedStations : [],
        settings: normalizeSettings(data.settings),
        unlockedAchievements:
          typeof data.unlockedAchievements === "object" && data.unlockedAchievements !== null
            ? (data.unlockedAchievements as SaveData["unlockedAchievements"])
            : {},
      };
    // case 2: ... 将来のマイグレーションをここに追加
    default:
      return createInitialData();
  }
}

function normalizeSettings(s: unknown): SaveData["settings"] {
  const def = createInitialData().settings;
  if (!s || typeof s !== "object") return def;
  const o = s as Partial<SaveData["settings"]>;
  const themes: ThemeColor[] = ["neon-blue", "neon-green", "neon-pink"];
  return {
    theme: o.theme && themes.includes(o.theme) ? o.theme : def.theme,
    sound: typeof o.sound === "boolean" ? o.sound : def.sound,
  };
}

/** 読込。破損JSONは握りつぶして初期化(SPEC §13: 破損でも起動する)。 */
export function loadData(): SaveData {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return createInitialData();
    return migrate(JSON.parse(text));
  } catch {
    return createInitialData();
  }
}

// 書込は変更操作のたび即時(debounce 300ms, SPEC §4)。
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveData(data: SaveData): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const payload: SaveData = { ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 容量超過等は無視(Phase 2 でユーザー通知を検討)
    }
  }, 300);
}

// --- エクスポート/インポートの枠(本実装は Phase 2 §5.5) ---

export function exportData(data: SaveData): string {
  return JSON.stringify(data, null, 2);
}

/** version 検証つきインポート。失敗時は null(現データ保持、SPEC §4)。 */
export function parseImported(text: string): SaveData | null {
  try {
    const obj = JSON.parse(text);
    if (!obj || obj.version !== CURRENT_VERSION) return null;
    return migrate(obj);
  } catch {
    return null;
  }
}

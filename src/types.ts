// railmap 共通型(SPEC §3.2 データ / §4 ユーザーデータ)

export type RailType = "新幹線" | "JR在来線" | "私鉄" | "地下鉄" | "路面・その他";

/** meta.json の路線メタ情報(SPEC §3.2) */
export type LineMeta = {
  operator: string;
  lineName: string;
  lengthKm: number;
  railType: RailType;
  pref: string[]; // Phase 2 で付与
  segCount: number;
};

export type Meta = {
  lines: Record<string, LineMeta>;
  totals: {
    lengthKm: number;
    lineCount: number;
    stationCount: number;
    byPref: Record<string, number>;
    byRailType: Record<string, number>;
  };
};

/** lines.geojson の feature properties(SPEC §3.2) */
export type LineProps = {
  lineId: string;
  operator: string;
  lineName: string;
  segIdx: number;
  railType: RailType;
};

// --- ユーザーデータ(localStorage, SPEC §4) ---

export type RideStatus = "full" | "partial";

export type Ride = {
  status: RideStatus;
  firstDate?: string; // YYYY-MM-DD 任意
  count: number; // 既定1
  memo?: string; // 140字まで
  riddenSegments?: number[]; // partial のみ使用
};

export type ThemeColor = "neon-blue" | "neon-green" | "neon-pink";

export type SaveData = {
  version: 1;
  updatedAt: string; // ISO8601
  rides: Record<string, Ride>;
  visitedStations: string[]; // Phase 2
  settings: { theme: ThemeColor; sound: boolean };
  unlockedAchievements: Record<string, string>; // id -> 解除日時
};

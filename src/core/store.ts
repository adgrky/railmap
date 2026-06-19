// 塗り状態の Zustand ストア(SPEC §2 core)。app に依存しない汎用層。
import { create } from "zustand";
import type { Ride, SaveData } from "../types";
import { loadData, saveData } from "./persistence";

type RailStore = {
  data: SaveData;
  /** 路線を乗車済にする(既定 status:"full", count:1)。 */
  addRide: (lineId: string) => void;
  /** 乗車を取り消す。 */
  removeRide: (lineId: string) => void;
  /** 乗車済トグル(full ⇄ 未乗)。 */
  toggleRide: (lineId: string) => void;
  /** 区間単位のトグル。全区間揃ったら full に昇格。 */
  toggleSegment: (lineId: string, segIdx: number, segCount: number) => void;
  /** 既存 ride のフィールド更新(初乗り日/回数/メモ)。 */
  updateRide: (lineId: string, patch: Partial<Ride>) => void;
  isRidden: (lineId: string) => boolean;
  isSegRidden: (lineId: string, segIdx: number) => boolean;
};

/** state を更新しつつ debounce 保存する共通処理。 */
function persist(set: (fn: (s: RailStore) => Partial<RailStore>) => void, mutate: (d: SaveData) => SaveData) {
  set((s) => {
    const next = mutate(s.data);
    saveData(next);
    return { data: next };
  });
}

export const useRailStore = create<RailStore>((set, get) => ({
  data: loadData(),

  addRide: (lineId) =>
    persist(set, (d) => {
      const existing = d.rides[lineId];
      return {
        ...d,
        rides: {
          ...d.rides,
          // partial から full に昇格する場合も考慮: count/firstDate/memo は引き継ぐ
          [lineId]: { status: "full", count: existing?.count ?? 1, firstDate: existing?.firstDate, memo: existing?.memo },
        },
      };
    }),

  removeRide: (lineId) =>
    persist(set, (d) => {
      const rides = { ...d.rides };
      delete rides[lineId];
      return { ...d, rides };
    }),

  toggleRide: (lineId) => {
    if (get().isRidden(lineId)) get().removeRide(lineId);
    else get().addRide(lineId);
  },

  toggleSegment: (lineId, segIdx, segCount) => {
    const ride = get().data.rides[lineId];
    if (!ride) {
      // 初めての区間: partial として登録
      persist(set, (d) => ({
        ...d,
        rides: { ...d.rides, [lineId]: { status: "partial", count: 1, riddenSegments: [segIdx] } },
      }));
    } else if (ride.status === "full") {
      // 全区間済 → 1区間外す → partial に降格
      const segs = Array.from({ length: segCount }, (_, i) => i).filter((i) => i !== segIdx);
      if (segs.length === 0) {
        get().removeRide(lineId);
      } else {
        persist(set, (d) => ({
          ...d,
          rides: { ...d.rides, [lineId]: { ...ride, status: "partial", riddenSegments: segs } },
        }));
      }
    } else {
      // partial: 対象区間をトグル
      const segs = ride.riddenSegments ?? [];
      if (segs.includes(segIdx)) {
        const next = segs.filter((s) => s !== segIdx);
        if (next.length === 0) {
          get().removeRide(lineId);
        } else {
          persist(set, (d) => ({
            ...d,
            rides: { ...d.rides, [lineId]: { ...ride, riddenSegments: next } },
          }));
        }
      } else {
        const next = [...segs, segIdx];
        if (next.length === segCount) {
          // 全区間揃った → full に昇格
          persist(set, (d) => ({
            ...d,
            rides: {
              ...d.rides,
              [lineId]: { status: "full", count: ride.count, firstDate: ride.firstDate, memo: ride.memo },
            },
          }));
        } else {
          persist(set, (d) => ({
            ...d,
            rides: { ...d.rides, [lineId]: { ...ride, riddenSegments: next } },
          }));
        }
      }
    }
  },

  updateRide: (lineId, patch) =>
    persist(set, (d) => {
      const cur = d.rides[lineId];
      if (!cur) return d;
      return { ...d, rides: { ...d.rides, [lineId]: { ...cur, ...patch } } };
    }),

  isRidden: (lineId) => Boolean(get().data.rides[lineId]),

  isSegRidden: (lineId, segIdx) => {
    const ride = get().data.rides[lineId];
    if (!ride) return false;
    if (ride.status === "full") return true;
    return (ride.riddenSegments ?? []).includes(segIdx);
  },
}));

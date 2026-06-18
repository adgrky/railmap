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
  /** 乗車済トグル(Phase1: full ⇄ 未乗)。 */
  toggleRide: (lineId: string) => void;
  /** 既存 ride のフィールド更新(初乗り日/回数/メモ)。 */
  updateRide: (lineId: string, patch: Partial<Ride>) => void;
  isRidden: (lineId: string) => boolean;
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
    persist(set, (d) => ({
      ...d,
      rides: { ...d.rides, [lineId]: d.rides[lineId] ?? { status: "full", count: 1 } },
    })),

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

  updateRide: (lineId, patch) =>
    persist(set, (d) => {
      const cur = d.rides[lineId];
      if (!cur) return d;
      return { ...d, rides: { ...d.rides, [lineId]: { ...cur, ...patch } } };
    }),

  isRidden: (lineId) => Boolean(get().data.rides[lineId]),
}));

// railmap ルート。データ読込・地図・シート・上部達成率バー(SPEC §5.1 / §5.2)。app層。
import { useEffect, useMemo, useState } from "react";
import type { Meta, ThemeColor } from "../types";
import { useRailStore } from "../core/store";
import { formatRatio, nationalRatio, riddenKm } from "../core/progress";
import { MapView } from "./MapView";
import { LineSheet } from "./LineSheet";

const BASE = import.meta.env.BASE_URL;

// テーマカラー → 実色(SPEC §6)
const THEME_HEX: Record<ThemeColor, string> = {
  "neon-blue": "#38bdf8",
  "neon-green": "#34d399",
  "neon-pink": "#f472b6",
};

type TabId = "map" | "stats" | "achievements" | "settings";

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("map");

  const data = useRailStore((s) => s.data);
  const toggleRide = useRailStore((s) => s.toggleRide);
  const isRidden = useRailStore((s) => s.isRidden);

  // 起動時にメタ情報を fetch(geojson 本体は MapView が直接読む, SPEC §3.3)
  useEffect(() => {
    fetch(`${BASE}data/meta.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`meta.json ${r.status}`);
        return r.json();
      })
      .then((m: Meta) => setMeta(m))
      .catch((e) => setLoadError(String(e)));
  }, []);

  const riddenIds = useMemo(() => Object.keys(data.rides), [data.rides]);
  const themeColor = THEME_HEX[data.settings.theme];

  const ratio = meta ? nationalRatio(meta, data.rides) : 0;
  const km = meta ? riddenKm(meta, data.rides) : 0;

  const selectedMeta = selectedLineId && meta ? meta.lines[selectedLineId] : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      {/* 地図 */}
      {tab === "map" && (
        <>
          <MapView
            riddenIds={riddenIds}
            themeColor={themeColor}
            selectedLineId={selectedLineId}
            onSelectLine={setSelectedLineId}
          />

          {/* 上部オーバーレイ: ミニ達成バー + 総走破距離(SPEC §5.1) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
            <div className="mx-auto max-w-md rounded-token bg-surface/90 px-4 py-2 backdrop-blur">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-text-dim">
                  全国 <span className="tnum font-bold text-text">{formatRatio(ratio)}</span>
                </span>
                <span className="tnum text-text-dim">{km.toFixed(1)} km</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${Math.min(100, ratio * 100)}%`, background: themeColor }}
                />
              </div>
            </div>
          </div>

          {selectedLineId && selectedMeta && (
            <LineSheet
              lineId={selectedLineId}
              meta={selectedMeta}
              isRidden={isRidden(selectedLineId)}
              onToggle={() => toggleRide(selectedLineId)}
              onClose={() => setSelectedLineId(null)}
            />
          )}
        </>
      )}

      {/* Phase2 で実装する画面のプレースホルダ */}
      {tab !== "map" && (
        <div className="flex h-full items-center justify-center px-6 text-center text-text-dim">
          この画面は Phase 2 で実装予定だよ
        </div>
      )}

      {/* 読込エラー表示(SPEC §13: 起動は止めない) */}
      {loadError && (
        <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-token bg-surface px-4 py-3 text-sm text-danger">
          データ読込に失敗: {loadError}
        </div>
      )}

      {/* 下部タブバー(SPEC §5: 器のみ。地図以外は Phase2) */}
      <nav className="absolute inset-x-0 bottom-0 z-30 flex border-t border-surface-2 bg-surface">
        {(
          [
            ["map", "🗾", "地図"],
            ["stats", "📊", "統計"],
            ["achievements", "🏆", "称号"],
            ["settings", "⚙️", "設定"],
          ] as [TabId, string, string][]
        ).map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center py-1.5 text-[11px] ${
              tab === id ? "text-text" : "text-text-dim"
            }`}
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className="mt-0.5">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

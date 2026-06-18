// railmap ルート(SPEC §5.1 / §5.2 / §7.1)。app層。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meta, ThemeColor } from "../types";
import { useRailStore } from "../core/store";
import { formatRatio, nationalRatio, riddenKm } from "../core/progress";
import { MapView, type AnimateLineCallback } from "./MapView";
import { LineSheet } from "./LineSheet";
import { playPon } from "./sound";

const BASE = import.meta.env.BASE_URL;

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

  // §7.1 达成率カウントアップ表示用(アニメ中は旧値を使い、完了後に新値へカチカチ)
  const [displayRatio, setDisplayRatio] = useState(0);
  const countUpRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const data = useRailStore((s) => s.data);
  const toggleRide = useRailStore((s) => s.toggleRide);
  const isRidden = useRailStore((s) => s.isRidden);

  // アニメーション関数(MapViewから受け取る)
  const animateFnRef = useRef<AnimateLineCallback | null>(null);
  const onAnimateRef = useCallback((fn: AnimateLineCallback) => {
    animateFnRef.current = fn;
  }, []);

  useEffect(() => {
    fetch(`${BASE}data/meta.json`)
      .then((r) => { if (!r.ok) throw new Error(`meta.json ${r.status}`); return r.json(); })
      .then((m: Meta) => { setMeta(m); })
      .catch((e) => setLoadError(String(e)));
  }, []);

  const riddenIds = useMemo(() => Object.keys(data.rides), [data.rides]);
  const themeColor = THEME_HEX[data.settings.theme];
  const ratio = meta ? nationalRatio(meta, data.rides) : 0;
  const km = meta ? riddenKm(meta, data.rides) : 0;

  // displayRatio: 通常は ratio と同期。アニメ中のカウントアップで更新される。
  useEffect(() => { setDisplayRatio(ratio); }, [ratio]);

  const selectedMeta = selectedLineId && meta ? meta.lines[selectedLineId] : null;

  /** [乗った!] / [取り消す] 押下(§7.1 アニメ統合)。 */
  const handleToggle = useCallback(() => {
    if (!selectedLineId || !meta) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wasRidden = isRidden(selectedLineId);

    if (!wasRidden) {
      // 先にストアを更新(MapView の riddenIds が変わり line-gradient の filter が更新される)
      toggleRide(selectedLineId);

      // 効果音(§7.1 step4)
      if (data.settings.sound) playPon();

      if (reducedMotion) return; // §7.1 step5: reduced-motion は即時

      // アニメ開始
      const prevRatio = displayRatio;
      const nextRatio = meta ? nationalRatio(meta, { ...data.rides, [selectedLineId]: { status: "full", count: 1 } }) : displayRatio;

      if (animateFnRef.current) {
        animateFnRef.current(selectedLineId, () => {
          // アニメ完了コールバック: step3 カウントアップ
          if (countUpRef.current) clearInterval(countUpRef.current);
          const steps = 20;
          let i = 0;
          countUpRef.current = setInterval(() => {
            i++;
            setDisplayRatio(prevRatio + (nextRatio - prevRatio) * (i / steps));
            if (i >= steps) { clearInterval(countUpRef.current!); countUpRef.current = null; }
          }, 15);
        });
      }
    } else {
      // 取り消しはアニメなしで即時
      toggleRide(selectedLineId);
    }
  }, [selectedLineId, meta, isRidden, toggleRide, data.settings.sound, data.rides, displayRatio]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      {tab === "map" && (
        <>
          <MapView
            riddenIds={riddenIds}
            themeColor={themeColor}
            selectedLineId={selectedLineId}
            onSelectLine={setSelectedLineId}
            onAnimateRef={onAnimateRef}
          />

          {/* 上部オーバーレイ: ミニ達成バー + 総走破距離(§5.1) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
            <div className="mx-auto max-w-md rounded-token bg-surface/90 px-4 py-2 backdrop-blur">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-text-dim">
                  全国{" "}
                  <span className="tnum font-bold text-text">
                    {formatRatio(displayRatio)}
                  </span>
                </span>
                <span className="tnum text-text-dim">{km.toFixed(1)} km</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${Math.min(100, displayRatio * 100)}%`, background: themeColor }}
                />
              </div>
            </div>
          </div>

          {selectedLineId && selectedMeta && (
            <LineSheet
              lineId={selectedLineId}
              meta={selectedMeta}
              isRidden={isRidden(selectedLineId)}
              onToggle={handleToggle}
              onClose={() => setSelectedLineId(null)}
            />
          )}
        </>
      )}

      {tab !== "map" && (
        <div className="flex h-full items-center justify-center px-6 text-center text-text-dim">
          この画面は Phase 2 で実装予定だよ
        </div>
      )}

      {loadError && (
        <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-token bg-surface px-4 py-3 text-sm text-danger">
          データ読込に失敗: {loadError}
        </div>
      )}

      {/* 下部タブバー */}
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

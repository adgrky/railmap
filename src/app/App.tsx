// railmap ルート(SPEC §5.1/§5.2/§5.3/§5.4/§7.1/§7.2/§9)。app層。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meta, ThemeColor } from "../types";
import { useRailStore } from "../core/store";
import { formatRatio, nationalRatio, riddenKm } from "../core/progress";
import { buildStats, checkNewAchievements } from "../core/achievements";
import { MapView, type AnimateLineCallback, type FlyToCallback, type CaptureMapCallback } from "./MapView";
import { generateShareImage, shareOrDownload } from "../core/shareImage";
import { LineSheet } from "./LineSheet";
import { StatsPanel } from "./StatsPanel";
import { AchievementsView } from "./AchievementsView";
import { AchievementToast } from "./AchievementToast";
import { ACHIEVEMENT_DEFS } from "./achievementDefs";
import { playPon } from "./sound";
import { PREF_COORDS } from "./prefCoords";

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

  // §7.1 カウントアップ表示
  const [displayRatio, setDisplayRatio] = useState(0);
  const countUpRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // §7.2 トースト
  const [toastName, setToastName] = useState<string | null>(null);

  const data = useRailStore((s) => s.data);
  const toggleRide = useRailStore((s) => s.toggleRide);
  const isRidden  = useRailStore((s) => s.isRidden);
  // 称号解除はストアの setState で直接書き込む
  const setAchievementUnlocked = useCallback((id: string) => {
    useRailStore.setState((s) => ({
      data: {
        ...s.data,
        unlockedAchievements: {
          ...s.data.unlockedAchievements,
          [id]: new Date().toISOString(),
        },
      },
    }));
    // debounce保存
    import("../core/persistence").then(({ saveData }) =>
      saveData({
        ...useRailStore.getState().data,
        unlockedAchievements: {
          ...useRailStore.getState().data.unlockedAchievements,
          [id]: useRailStore.getState().data.unlockedAchievements[id] ?? new Date().toISOString(),
        },
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateFnRef = useRef<AnimateLineCallback | null>(null);
  const flyToFnRef   = useRef<FlyToCallback | null>(null);
  const captureFnRef = useRef<CaptureMapCallback | null>(null);
  const onAnimateRef = useCallback((fn: AnimateLineCallback)  => { animateFnRef.current = fn; }, []);
  const onFlyToRef   = useCallback((fn: FlyToCallback)        => { flyToFnRef.current   = fn; }, []);
  const onCaptureRef = useCallback((fn: CaptureMapCallback)   => { captureFnRef.current  = fn; }, []);

  useEffect(() => {
    fetch(`${BASE}data/meta.json`)
      .then((r) => { if (!r.ok) throw new Error(`meta.json ${r.status}`); return r.json(); })
      .then((m: Meta) => setMeta(m))
      .catch((e) => setLoadError(String(e)));
  }, []);

  const riddenIds = useMemo(() => Object.keys(data.rides), [data.rides]);
  const themeColor = THEME_HEX[data.settings.theme];
  const ratio = meta ? nationalRatio(meta, data.rides) : 0;
  const km    = meta ? riddenKm(meta, data.rides) : 0;

  useEffect(() => { setDisplayRatio(ratio); }, [ratio]);

  // 称号チェック(rides 変化ごとに走る)
  useEffect(() => {
    if (!meta) return;
    const stats = buildStats(meta, data.rides);
    const newIds = checkNewAchievements(ACHIEVEMENT_DEFS, stats, data.unlockedAchievements);
    for (const id of newIds) {
      setAchievementUnlocked(id);
      const def = ACHIEVEMENT_DEFS.find((d) => d.id === id);
      if (def) setToastName(def.name);
    }
  }, [meta, data.rides, data.unlockedAchievements, setAchievementUnlocked]);

  const selectedMeta = selectedLineId && meta ? meta.lines[selectedLineId] : null;

  const handleToggle = useCallback(() => {
    if (!selectedLineId || !meta) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wasRidden = isRidden(selectedLineId);

    if (!wasRidden) {
      toggleRide(selectedLineId);
      if (data.settings.sound) playPon();
      if (reducedMotion) return;

      const prevRatio = displayRatio;
      const nextRatio = nationalRatio(meta, { ...data.rides, [selectedLineId]: { status: "full", count: 1 } });

      if (animateFnRef.current) {
        animateFnRef.current(selectedLineId, () => {
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
      toggleRide(selectedLineId);
    }
  }, [selectedLineId, meta, isRidden, toggleRide, data.settings.sound, data.rides, displayRatio]);

  // §10 シェア画像生成(通常 / 称号バリアント)
  const handleShare = useCallback(async (achievementName?: string) => {
    if (!captureFnRef.current || !meta) return;
    const mapCanvas = await captureFnRef.current();
    const blob = await generateShareImage({
      mapCanvas,
      nationalRatio: nationalRatio(meta, data.rides),
      riddenKm: riddenKm(meta, data.rides),
      themeColor,
      achievementName,
    });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    await shareOrDownload(blob, `railmap-${date}.png`);
  }, [meta, data.rides, themeColor]);

  const handleJumpToPref = useCallback((pref: string) => {
    const coord = PREF_COORDS[pref];
    if (coord && flyToFnRef.current) {
      setTab("map");
      setTimeout(() => flyToFnRef.current?.(coord, 9), 50);
    }
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      {/* 地図は常時マウント */}
      <div className={tab === "map" ? "absolute inset-0" : "pointer-events-none absolute inset-0 opacity-0"}>
        <MapView
          riddenIds={riddenIds}
          themeColor={themeColor}
          selectedLineId={selectedLineId}
          onSelectLine={setSelectedLineId}
          onAnimateRef={onAnimateRef}
          onFlyToRef={onFlyToRef}
          onCaptureRef={onCaptureRef}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
          <div className="mx-auto max-w-md rounded-token bg-surface/90 px-4 py-2 backdrop-blur">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-text-dim">
                全国{" "}
                <span className="tnum font-bold text-text">{formatRatio(displayRatio)}</span>
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

        {selectedLineId && selectedMeta && tab === "map" && (
          <LineSheet
            lineId={selectedLineId}
            meta={selectedMeta}
            isRidden={isRidden(selectedLineId)}
            onToggle={handleToggle}
            onClose={() => setSelectedLineId(null)}
          />
        )}
      </div>

      {/* 統計(§5.3) */}
      {tab === "stats" && meta && (
        <div className="absolute inset-0">
          <StatsPanel
            meta={meta}
            rides={data.rides}
            themeColor={themeColor}
            onJumpToPref={handleJumpToPref}
            onOpenShare={() => handleShare()}
          />
        </div>
      )}

      {/* 称号(§5.4) */}
      {tab === "achievements" && (
        <div className="absolute inset-0">
          <AchievementsView
            defs={ACHIEVEMENT_DEFS}
            unlocked={data.unlockedAchievements}
            themeColor={themeColor}
            onShareAchievement={(id) => {
              const def = ACHIEVEMENT_DEFS.find((d) => d.id === id);
              if (def) handleShare(def.name);
            }}
          />
        </div>
      )}

      {/* 設定(Phase2 プレースホルダ) */}
      {tab === "settings" && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-text-dim">
          この画面は Phase 2 で実装予定だよ
        </div>
      )}

      {/* §7.2 称号解除トースト */}
      <AchievementToast
        achievementName={toastName}
        onTap={() => { setTab("achievements"); setToastName(null); }}
        onDismiss={() => setToastName(null)}
      />

      {loadError && (
        <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-token bg-surface px-4 py-3 text-sm text-danger">
          データ読込に失敗: {loadError}
        </div>
      )}

      <nav className="absolute inset-x-0 bottom-0 z-30 flex border-t border-surface-2 bg-surface">
        {(
          [
            ["map",          "🗾", "地図"],
            ["stats",        "📊", "統計"],
            ["achievements", "🏆", "称号"],
            ["settings",     "⚙️", "設定"],
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

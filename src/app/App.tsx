// railmap ルート(SPEC §5.1/§5.2/§5.3/§5.4/§7.1/§7.2/§9)。app層。
import { useCallback, useEffect, useRef, useState } from "react";
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
import { SettingsView } from "./SettingsView";
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

  // 乗車演出: 閃光フラッシュ(key が変わるたびに再アニメ)
  const [flashKey, setFlashKey] = useState(0);
  // 乗車演出: +km ポップ
  const [kmPop, setKmPop] = useState<{ key: number; km: number } | null>(null);

  const data = useRailStore((s) => s.data);
  const addRide = useRailStore((s) => s.addRide);
  const removeRide = useRailStore((s) => s.removeRide);
  const toggleSegment = useRailStore((s) => s.toggleSegment);
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

  // 全区間乗った！(full 追加 or partial → full 昇格) + 演出
  const handleToggle = useCallback(() => {
    if (!selectedLineId || !meta) return;
    const ride = data.rides[selectedLineId];
    const isFull = ride?.status === "full";

    if (isFull) {
      // full → 取り消す
      removeRide(selectedLineId);
      return;
    }

    // 未乗 or partial → full に追加/昇格
    const lineMeta = meta.lines[selectedLineId];
    const addedKm = lineMeta?.lengthKm ?? 0;
    addRide(selectedLineId);
    if (data.settings.sound) playPon();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    setFlashKey((k) => k + 1);
    setKmPop({ key: Date.now(), km: addedKm });

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
  }, [selectedLineId, meta, addRide, removeRide, data.settings.sound, data.rides, displayRatio]);

  // 区間単位のトグル
  const handleToggleSegment = useCallback((segIdx: number) => {
    if (!selectedLineId || !meta) return;
    const segCount = meta.lines[selectedLineId]?.segCount ?? 1;
    toggleSegment(selectedLineId, segIdx, segCount);
  }, [selectedLineId, meta, toggleSegment]);

  // 全区間取り消す(partial 専用)
  const handleRemove = useCallback(() => {
    if (!selectedLineId) return;
    removeRide(selectedLineId);
  }, [selectedLineId, removeRide]);

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
          rides={data.rides}
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
            ride={data.rides[selectedLineId] ?? null}
            themeColor={themeColor}
            onToggle={handleToggle}
            onRemove={handleRemove}
            onToggleSegment={handleToggleSegment}
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

      {/* 設定(§5.5) */}
      {tab === "settings" && (
        <div className="absolute inset-0">
          <SettingsView />
        </div>
      )}

      {/* §7.2 称号解除トースト */}
      <AchievementToast
        achievementName={toastName}
        onTap={() => { setTab("achievements"); setToastName(null); }}
        onDismiss={() => setToastName(null)}
      />

      {/* 乗車演出: 閃光フラッシュ(全画面白) */}
      {flashKey > 0 && (
        <div
          key={flashKey}
          className="pointer-events-none absolute inset-0 z-40 bg-white"
          style={{ animation: "screen-flash 500ms ease-out forwards" }}
        />
      )}

      {/* 乗車演出: +km ポップ */}
      {kmPop && (
        <div
          key={kmPop.key}
          className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
          style={{ top: "38%", animation: "km-pop 950ms ease-out forwards" }}
        >
          <span
            className="tnum text-3xl font-bold tracking-wide"
            style={{
              color: themeColor,
              textShadow: `0 0 24px ${themeColor}, 0 0 48px ${themeColor}80`,
            }}
          >
            +{kmPop.km.toFixed(1)} km
          </span>
        </div>
      )}

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

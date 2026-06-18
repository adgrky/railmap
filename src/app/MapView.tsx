// MapLibre ラッパ(SPEC §5.1 / §6 / §7.1)。app層(railmap固有)。
import { useEffect, useRef } from "react";
import maplibregl, { StyleSpecification, LayerSpecification } from "maplibre-gl";

const BASE = import.meta.env.BASE_URL;
const LINES_URL = `${BASE}data/lines.geojson`;
const STATIONS_URL = `${BASE}data/stations.geojson`;
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

// §6「道路・建物ラベルは極力消し、地形と県境と水域だけ残す」
const HIDDEN_LAYER_PREFIXES = [
  "building", "aeroway", "highway", "road_", "railway",
  "water_name", "place_", "landuse_", "landcover_",
];
function shouldHide(id: string): boolean {
  return HIDDEN_LAYER_PREFIXES.some((p) => id.startsWith(p));
}

async function buildDarkStyle(): Promise<StyleSpecification> {
  const style: StyleSpecification = await fetch(DARK_STYLE_URL).then((r) => r.json());
  const patched = style.layers
    .filter((l: LayerSpecification) => !shouldHide(l.id))
    .map((l: LayerSpecification): LayerSpecification => {
      if (l.id === "background" && l.type === "background")
        return { ...l, paint: { "background-color": "#0b0e14" } };
      if ((l.id === "water" || l.id === "waterway") && "paint" in l) {
        const p = { ...(l.paint as Record<string, unknown>) };
        if ("fill-color" in p) p["fill-color"] = "#0d1219";
        if ("line-color" in p) p["line-color"] = "#0d1219";
        return { ...l, paint: p };
      }
      if (l.id.startsWith("boundary_") && "paint" in l) {
        const p = { ...(l.paint as Record<string, unknown>) };
        if ("line-color" in p) p["line-color"] = "#2a3040";
        if ("line-opacity" in p) p["line-opacity"] = 0.8;
        return { ...l, paint: p };
      }
      return l;
    });
  return { ...style, layers: patched };
}

// §7.1: line-gradient を使った「光が走る」アニメーション(600ms, ease-out)
// GeoJSON ソースに lineMetrics:true が必要。
const ANIM_DURATION = 600;

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** themeColor の hex を rgba(r,g,b,alpha) に変換(グロー用)。 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export type AnimateLineCallback = (lineId: string, onComplete: () => void) => void;
export type FlyToCallback = (center: [number, number], zoom?: number) => void;
export type CaptureMapCallback = () => Promise<HTMLCanvasElement>;

type Props = {
  riddenIds: string[];
  themeColor: string;
  selectedLineId: string | null;
  onSelectLine: (lineId: string | null) => void;
  onAnimateRef?: (fn: AnimateLineCallback) => void;
  onFlyToRef?: (fn: FlyToCallback) => void;
  onCaptureRef?: (fn: CaptureMapCallback) => void;
};

export function MapView({ riddenIds, themeColor, selectedLineId, onSelectLine, onAnimateRef, onFlyToRef, onCaptureRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const animRafRef = useRef<number | null>(null);

  // 初期化(一度だけ)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const style = await buildDarkStyle();
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [137.0, 38.0],
        zoom: 4.8,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      if (import.meta.env.DEV) (window as unknown as { __map?: maplibregl.Map }).__map = map;

      map.on("load", () => {
        // lineMetrics:true で line-gradient を有効化(§7.1)
        map.addSource("lines", {
          type: "geojson",
          data: LINES_URL,
          lineMetrics: true,
        } as maplibregl.GeoJSONSourceSpecification);
        map.addSource("stations", { type: "geojson", data: STATIONS_URL });

        // 未乗路線(グレー)
        map.addLayer({
          id: "lines-unvisited",
          type: "line",
          source: "lines",
          paint: { "line-color": "#3a3f4a", "line-width": 1.5 },
          layout: { "line-cap": "round", "line-join": "round" },
        });

        // グロー下層(§5.1 / §6: テーマ色 60%透過, width 6, blur)。opacity は後から制御。
        map.addLayer({
          id: "lines-glow",
          type: "line",
          source: "lines",
          paint: {
            "line-color": themeColor,
            "line-width": 6,
            "line-opacity": 0,    // アニメ完了時に 0.4 へフェードイン
            "line-blur": 4,
          },
          layout: { "line-cap": "round", "line-join": "round" },
          filter: ["in", ["get", "lineId"], ["literal", []]],
        });

        // 乗車済本線(line-gradient 対応層。lineMetrics:true が必要)
        map.addLayer({
          id: "lines-visited",
          type: "line",
          source: "lines",
          paint: {
            "line-color": themeColor,
            "line-width": 2.5,
            "line-gradient": [
              "interpolate",
              ["linear"],
              ["line-progress"],
              0, themeColor,
              1, themeColor,
            ],
          },
          layout: { "line-cap": "round", "line-join": "round" },
          filter: ["in", ["get", "lineId"], ["literal", []]],
        });

        // アニメ中の走光レイヤー(§7.1: 光が走る)
        map.addLayer({
          id: "lines-anim",
          type: "line",
          source: "lines",
          paint: {
            "line-width": 3,
            "line-gradient": [
              "interpolate",
              ["linear"],
              ["line-progress"],
              0, "rgba(0,0,0,0)",
              1, "rgba(0,0,0,0)",
            ],
          },
          layout: { "line-cap": "round", "line-join": "round" },
          filter: ["==", ["get", "lineId"], "__none__"],
        });

        // 選択ハイライト(白)
        map.addLayer({
          id: "lines-selected",
          type: "line",
          source: "lines",
          paint: { "line-color": "#ffffff", "line-width": 3.5 },
          layout: { "line-cap": "round", "line-join": "round" },
          filter: ["==", ["get", "lineId"], "__none__"],
        });

        // 駅(zoom≥9)
        map.addLayer({
          id: "stations",
          type: "circle",
          source: "stations",
          minzoom: 9,
          paint: {
            "circle-radius": 3,
            "circle-color": "#e8ecf4",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#0b0e14",
          },
        });

        loadedRef.current = true;
        applyRidden(map, riddenIds, themeColor);
        applySelected(map, selectedLineId);

        // アニメーション関数を親に渡す(§7.1)
        if (onAnimateRef) {
          onAnimateRef((lineId: string, onComplete: () => void) => {
            animateLine(map, lineId, themeColor, animRafRef, onComplete);
          });
        }
        // flyTo 関数を親に渡す(§5.3 都道府県タップ)
        if (onFlyToRef) {
          onFlyToRef((center, zoom = 9) => {
            map.flyTo({ center, zoom, duration: 800 });
          });
        }
        // キャプチャ関数を親に渡す(§10: 全国ビューで撮影→元に戻す)
        if (onCaptureRef) {
          onCaptureRef((): Promise<HTMLCanvasElement> => {
            return new Promise((resolve) => {
              const cur = { center: map.getCenter(), zoom: map.getZoom() };
              map.jumpTo({ center: [137.0, 38.0], zoom: 4.8 });
              const doCapture = () => {
                const c = map.getCanvas();
                // Canvas の内容を別 canvas にコピー(元はGL描画で直接参照が失われる場合がある)
                const out = document.createElement("canvas");
                out.width = c.width; out.height = c.height;
                out.getContext("2d")!.drawImage(c, 0, 0);
                map.jumpTo(cur);
                resolve(out);
              };
              // idle イベントで描画完了を待つ(最大500ms でタイムアウト)
              let done = false;
              const onIdle = () => { if (!done) { done = true; doCapture(); } };
              map.once("idle", onIdle);
              setTimeout(() => { if (!done) { done = true; map.off("idle", onIdle); doCapture(); } }, 500);
            });
          });
        }
      });

      map.on("click", (e) => {
        if (!loadedRef.current) return;
        const p = e.point;
        const pad = 8;
        const feats = map.queryRenderedFeatures(
          [[p.x - pad, p.y - pad], [p.x + pad, p.y + pad]],
          { layers: ["lines-unvisited", "lines-visited"] }
        );
        if (feats.length > 0) {
          onSelectLine((feats[0].properties?.lineId as string) ?? null);
        } else {
          onSelectLine(null);
        }
      });

      map.on("mouseenter", "lines-unvisited", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "lines-unvisited", () => (map.getCanvas().style.cursor = ""));
    })();

    return () => {
      cancelled = true;
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        loadedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyRidden(map, riddenIds, themeColor);
  }, [riddenIds, themeColor]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applySelected(map, selectedLineId);
  }, [selectedLineId]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

function applyRidden(map: maplibregl.Map, riddenIds: string[], themeColor: string) {
  const filter = ["in", ["get", "lineId"], ["literal", riddenIds]] as maplibregl.FilterSpecification;
  map.setFilter("lines-glow", filter);
  map.setFilter("lines-visited", filter);
  map.setFilter("lines-unvisited", ["!", filter] as maplibregl.FilterSpecification);
  map.setPaintProperty("lines-glow", "line-color", themeColor);
  // visited は line-gradient で色を持つため line-color 更新は不要
}

function applySelected(map: maplibregl.Map, selectedLineId: string | null) {
  map.setFilter("lines-selected", ["==", ["get", "lineId"], selectedLineId ?? "__none__"]);
}

/** §7.1 塗りアニメ: 始点→終点へ光が走る(600ms, ease-out) → グロー fade in(300ms)。 */
function animateLine(
  map: maplibregl.Map,
  lineId: string,
  themeColor: string,
  rafRef: React.MutableRefObject<number | null>,
  onComplete: () => void
): void {
  // prefers-reduced-motion: 即時完了
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    onComplete();
    return;
  }

  // ビームは白にしてテーマカラーの線の上でも視認できるようにする(§7.1「光が走る」)
  const rgba = "rgba(255,255,255,0.95)";
  const start = performance.now();

  // アニメレイヤーをこの路線に絞り込む
  map.setFilter("lines-anim", ["==", ["get", "lineId"], lineId]);

  function step(now: number) {
    const raw = Math.min((now - start) / ANIM_DURATION, 1);
    const progress = easeOut(raw);

    // 光のhead位置: progress ± 0.08 のウィンドウで輝く
    const head = progress;
    const tail = Math.max(0, head - 0.08);
    const afterHead = Math.min(1, head + 0.001);

    map.setPaintProperty("lines-anim", "line-gradient", [
      "interpolate", ["linear"], ["line-progress"],
      0,          "rgba(0,0,0,0)",
      Math.max(0, tail - 0.02), "rgba(0,0,0,0)",
      tail,       rgba,
      head,       rgba,
      afterHead,  "rgba(0,0,0,0)",
      1,          "rgba(0,0,0,0)",
    ]);

    if (raw < 1) {
      rafRef.current = requestAnimationFrame(step);
    } else {
      // アニメ完了: animレイヤーを非表示に戻す
      map.setFilter("lines-anim", ["==", ["get", "lineId"], "__none__"]);
      onComplete();

      // グロー fade in (300ms, §7.1 step2)
      const glowStart = performance.now();
      function fadeGlow(t: number) {
        const p = Math.min((t - glowStart) / 300, 1);
        map.setPaintProperty("lines-glow", "line-opacity", p * 0.4);
        if (p < 1) rafRef.current = requestAnimationFrame(fadeGlow);
      }
      rafRef.current = requestAnimationFrame(fadeGlow);
    }
  }

  rafRef.current = requestAnimationFrame(step);
}

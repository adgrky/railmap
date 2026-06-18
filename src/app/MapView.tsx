// MapLibre ラッパ(SPEC §5.1 のうち Phase1 MVP 分)。app層(railmap固有)。
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

const BASE = import.meta.env.BASE_URL;
const LINES_URL = `${BASE}data/lines.geojson`;
const STATIONS_URL = `${BASE}data/stations.geojson`;
// Phase1 暫定ベース(§6 ダーク化は Phase 2、VERIFIED.md)
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

type Props = {
  riddenIds: string[];
  themeColor: string;
  selectedLineId: string | null;
  onSelectLine: (lineId: string | null) => void;
};

export function MapView({ riddenIds, themeColor, selectedLineId, onSelectLine }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);

  // 初期化(一度だけ)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [137.0, 38.0], // SPEC §5.1
      zoom: 4.8,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    // 開発時のみ: 動作検証用に map を公開(本番ビルドには含まれない)
    if (import.meta.env.DEV) (window as unknown as { __map?: maplibregl.Map }).__map = map;

    map.on("load", () => {
      map.addSource("lines", { type: "geojson", data: LINES_URL });
      map.addSource("stations", { type: "geojson", data: STATIONS_URL });

      // 未乗路線(グレー)。乗車済 lineId を除外(SPEC §5.1)
      map.addLayer({
        id: "lines-unvisited",
        type: "line",
        source: "lines",
        paint: { "line-color": "#3a3f4a", "line-width": 1.5 },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      // 乗車済本線(テーマ色)。乗車済 lineId のみ
      map.addLayer({
        id: "lines-visited",
        type: "line",
        source: "lines",
        paint: { "line-color": themeColor, "line-width": 2.5 },
        layout: { "line-cap": "round", "line-join": "round" },
        filter: ["in", ["get", "lineId"], ["literal", []]],
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

      // 駅(zoom≥9, SPEC §5.1)
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
    });

    // タップ判定(queryRenderedFeatures + padding 8px, SPEC §5.1)
    map.on("click", (e) => {
      if (!loadedRef.current) return;
      const p = e.point;
      const pad = 8;
      const feats = map.queryRenderedFeatures(
        [
          [p.x - pad, p.y - pad],
          [p.x + pad, p.y + pad],
        ],
        { layers: ["lines-unvisited", "lines-visited"] }
      );
      if (feats.length > 0) {
        const lineId = feats[0].properties?.lineId as string | undefined;
        onSelectLine(lineId ?? null);
      } else {
        onSelectLine(null); // 地図タップで閉じる(SPEC §5.2)
      }
    });

    // 線の上でカーソル変化
    map.on("mouseenter", "lines-unvisited", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "lines-unvisited", () => (map.getCanvas().style.cursor = ""));

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // 初期化は一度だけ。最新値は下の effect で反映する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 乗車済/テーマ色の反映
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyRidden(map, riddenIds, themeColor);
  }, [riddenIds, themeColor]);

  // 選択ハイライトの反映
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applySelected(map, selectedLineId);
  }, [selectedLineId]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

function applyRidden(map: maplibregl.Map, riddenIds: string[], themeColor: string) {
  map.setFilter("lines-visited", ["in", ["get", "lineId"], ["literal", riddenIds]]);
  map.setFilter("lines-unvisited", ["!", ["in", ["get", "lineId"], ["literal", riddenIds]]]);
  map.setPaintProperty("lines-visited", "line-color", themeColor);
}

function applySelected(map: maplibregl.Map, selectedLineId: string | null) {
  map.setFilter("lines-selected", ["==", ["get", "lineId"], selectedLineId ?? "__none__"]);
}

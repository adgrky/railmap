// MapLibre ラッパ(SPEC §5.1 / §6)。app層(railmap固有)。
import { useEffect, useRef } from "react";
import maplibregl, { StyleSpecification, LayerSpecification } from "maplibre-gl";

const BASE = import.meta.env.BASE_URL;
const LINES_URL = `${BASE}data/lines.geojson`;
const STATIONS_URL = `${BASE}data/stations.geojson`;
// §6 / VERIFIED.md: dark スタイル実在確認済み
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

// §6「道路・建物ラベルは極力消し、地形と県境と水域だけ残す=路線が主役」
// 除去/非表示にするレイヤーIDパターン。実データ確認済み(VERIFIED.md §1)。
const HIDDEN_LAYER_PREFIXES = [
  "building",
  "aeroway",
  "highway",
  "road_",
  "railway", // OpenFreeMapのrailwayタイル(独自ソースで描画するため)
  "water_name",
  "place_",
  "landuse_",
  "landcover_",
];

function shouldHide(id: string): boolean {
  return HIDDEN_LAYER_PREFIXES.some((p) => id.startsWith(p));
}

/** OpenFreeMap dark スタイルを §6 配色に上書きしたスタイルを返す。 */
async function buildDarkStyle(): Promise<StyleSpecification> {
  const style: StyleSpecification = await fetch(DARK_STYLE_URL).then((r) => r.json());

  const patched = style.layers
    .filter((l: LayerSpecification) => !shouldHide(l.id))
    .map((l: LayerSpecification): LayerSpecification => {
      // 背景を §6 --bg に
      if (l.id === "background" && l.type === "background") {
        return { ...l, paint: { "background-color": "#0b0e14" } };
      }
      // 水域を --bg 系の暗い青に統一
      if ((l.id === "water" || l.id === "waterway") && "paint" in l) {
        const p = { ...(l.paint as Record<string, unknown>) };
        if ("fill-color" in p) p["fill-color"] = "#0d1219";
        if ("line-color" in p) p["line-color"] = "#0d1219";
        return { ...l, paint: p };
      }
      // 県境・国境は薄いグレーで保持(地形を認識する最低限)
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

    let cancelled = false;

    (async () => {
      const style = await buildDarkStyle();
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [137.0, 38.0], // SPEC §5.1
        zoom: 4.8,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      // 開発時のみ: 動作検証用に公開(本番ビルドには含まれない)
      if (import.meta.env.DEV) (window as unknown as { __map?: maplibregl.Map }).__map = map;

      map.on("load", () => {
        map.addSource("lines", { type: "geojson", data: LINES_URL });
        map.addSource("stations", { type: "geojson", data: STATIONS_URL });

        // 未乗路線(グレー, §5.1)
        map.addLayer({
          id: "lines-unvisited",
          type: "line",
          source: "lines",
          paint: { "line-color": "#3a3f4a", "line-width": 1.5 },
          layout: { "line-cap": "round", "line-join": "round" },
        });

        // グロー下層(テーマ色 60%透過, width 6, §5.1 / §6)
        map.addLayer({
          id: "lines-glow",
          type: "line",
          source: "lines",
          paint: {
            "line-color": themeColor,
            "line-width": 6,
            "line-opacity": 0.4,
            "line-blur": 4,
          },
          layout: { "line-cap": "round", "line-join": "round" },
          filter: ["in", ["get", "lineId"], ["literal", []]],
        });

        // 乗車済本線(テーマ色, §5.1)
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

        // 駅(zoom≥9, §5.1)
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

      // タップ判定(queryRenderedFeatures + padding 8px, §5.1)
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
          onSelectLine(null); // 地図タップで閉じる(§5.2)
        }
      });

      map.on("mouseenter", "lines-unvisited", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "lines-unvisited", () => (map.getCanvas().style.cursor = ""));
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        loadedRef.current = false;
      }
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
  const filter = ["in", ["get", "lineId"], ["literal", riddenIds]] as maplibregl.FilterSpecification;
  map.setFilter("lines-glow", filter);
  map.setFilter("lines-visited", filter);
  map.setFilter("lines-unvisited", ["!", filter] as maplibregl.FilterSpecification);
  map.setPaintProperty("lines-glow", "line-color", themeColor);
  map.setPaintProperty("lines-visited", "line-color", themeColor);
}

function applySelected(map: maplibregl.Map, selectedLineId: string | null) {
  map.setFilter("lines-selected", ["==", ["get", "lineId"], selectedLineId ?? "__none__"]);
}

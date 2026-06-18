"""国土数値情報 N02(鉄道)→ アプリ用 GeoJSON / meta.json 前処理(SPEC §3.2)。

実行: uv run --with geopandas --with shapely --with pyproj tools/preprocess.py
- 入力: tools/raw/ の N02-25(無ければ自動DL・解凍)
- 出力: public/data/{lines,stations}.geojson, public/data/meta.json

SPEC原則: 推測せず実データの属性を確認してから書く。本ファイルの定数(鉄道区分・
事業者種別コード)は tools/raw の N02-25 実データの分布を確認して確定した(docs/VERIFIED.md)。
"""
from __future__ import annotations

import json
import subprocess
import sys
import zipfile
from pathlib import Path

import geopandas as gpd

# --- パス ---
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw"
OUT = ROOT / "public" / "data"
N02_URL = "https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-25/N02-25_GML.zip"
ZIP = RAW / "N02-25_GML.zip"
GML = RAW / "N02-25" / "N02-25_GML" / "UTF-8"
LINES_SRC = GML / "N02-25_RailroadSection.geojson"
STATIONS_SRC = GML / "N02-25_Station.geojson"

# --- N02 属性フィールド(実データで確認、docs/VERIFIED.md) ---
F_RAILCLASS = "N02_001"  # 鉄道区分
F_OPTYPE = "N02_002"     # 事業者種別
F_LINENAME = "N02_003"   # 路線名
F_OPERATOR = "N02_004"   # 運営会社
F_STATION = "N02_005"    # 駅名(Stationのみ)
F_STATION_C = "N02_005c"  # 駅グループコード(Stationのみ)

# 事業者種別コード(N02_002)
OPTYPE_SHINKANSEN = "1"   # 新幹線
OPTYPE_JR = "2"           # JR在来線
OPTYPE_PUBLIC = "3"       # 公営鉄道
OPTYPE_PRIVATE = "4"      # 民営鉄道
OPTYPE_SECTOR = "5"       # 第三セクター

# 鉄道区分コード(N02_001) … 普通鉄道以外(路面・モノレール・新交通・ケーブル・リニア)
RAILCLASS_TRAM = "21"     # 軌道(路面電車)
RAILCLASS_OTHER = {"13", "14", "15", "16", "22", "23", "24", "25"}
# 13ケーブル/14懸垂モノレール/15跨座モノレール/16案内軌条(新交通)/22-25 浮上式・モノレール・新交通

# 距離計算用の等積投影(SPEC §3.2)
EPSG_EQUAL_AREA = "EPSG:6933"
SIMPLIFY_TOL = 0.0005  # SPEC §3.2


def normalize(s: str) -> str:
    """全角空白・半角空白を除去しトリム(SPEC §3.2)。"""
    if s is None:
        return ""
    return str(s).replace("　", "").replace(" ", "").strip()


def ensure_raw() -> None:
    """N02-25 が無ければ DL して解凍する。"""
    if LINES_SRC.exists() and STATIONS_SRC.exists():
        return
    RAW.mkdir(parents=True, exist_ok=True)
    if not ZIP.exists():
        print(f"N02-25 をダウンロード中: {N02_URL}")
        subprocess.run(["curl", "-sL", "--max-time", "300", "-o", str(ZIP), N02_URL], check=True)
    print("解凍中...")
    with zipfile.ZipFile(ZIP) as z:
        z.extractall(RAW / "N02-25")
    if not LINES_SRC.exists():
        sys.exit(f"想定パスにデータがありません: {LINES_SRC}")


def classify_rail_type(railclass: str, optype: str, operator: str) -> str:
    """SPEC §3.2 railType: 新幹線 / JR在来線 / 私鉄 / 地下鉄 / 路面・その他。

    事業者種別を主軸に、鉄道区分で路面・モノレール等を分離。地下鉄は専用コードが
    無いため「運営会社名にメトロ/地下鉄/高速電気軌道」または「公営の普通鉄道」を
    近似判定とする(厳密化は Phase 2 の残課題、docs/VERIFIED.md 記載)。
    """
    if optype == OPTYPE_SHINKANSEN:
        return "新幹線"
    if optype == OPTYPE_JR:
        return "JR在来線"
    if railclass == RAILCLASS_TRAM:
        return "路面・その他"
    if railclass in RAILCLASS_OTHER:
        return "路面・その他"
    # ここまで来るのは普通鉄道(区分11/12)の公営/民営/三セク
    if ("メトロ" in operator) or ("地下鉄" in operator) or ("高速電気軌道" in operator):
        return "地下鉄"
    if optype == OPTYPE_PUBLIC:
        return "地下鉄"  # 公営の普通鉄道 ≈ 地下鉄(近似)
    return "私鉄"  # 民営・第三セクターの普通鉄道


def main() -> None:
    ensure_raw()
    OUT.mkdir(parents=True, exist_ok=True)

    print("路線データ読込...")
    lines = gpd.read_file(LINES_SRC)
    print(f"  features={len(lines)} crs={lines.crs}")

    # lineId / railType を付与
    lines["operator"] = lines[F_OPERATOR].fillna("")
    lines["lineName"] = lines[F_LINENAME].fillna("")
    lines["lineId"] = lines.apply(
        lambda r: f"{normalize(r['operator'])}__{normalize(r['lineName'])}", axis=1
    )
    lines["railType"] = lines.apply(
        lambda r: classify_rail_type(str(r[F_RAILCLASS]), str(r[F_OPTYPE]), str(r["operator"])),
        axis=1,
    )

    # ジオメトリ簡略化(表示用、出力ジオメトリに反映)
    simplified = lines.geometry.simplify(SIMPLIFY_TOL, preserve_topology=True)
    lines = lines.set_geometry(simplified)

    # 距離: 等積投影で feature ごとの長さ(km)
    proj = lines.to_crs(EPSG_EQUAL_AREA)
    lines["seg_km"] = proj.geometry.length / 1000.0

    # 路線ごとの集計
    meta_lines: dict[str, dict] = {}
    for line_id, grp in lines.groupby("lineId"):
        first = grp.iloc[0]
        length_km = round(float(grp["seg_km"].sum()), 1)
        meta_lines[line_id] = {
            "operator": str(first["operator"]),
            "lineName": str(first["lineName"]),
            "lengthKm": length_km,
            "railType": str(first["railType"]),
            "pref": [],  # Phase 2 で N03 交差により付与(SPEC §3.2 / §8.1)
        }

    # 各 feature に segIdx を付与して lines.geojson を構築
    seg_counter: dict[str, int] = {}
    out_features = []
    for _, row in lines.iterrows():
        lid = row["lineId"]
        idx = seg_counter.get(lid, 0)
        seg_counter[lid] = idx + 1
        out_features.append(
            {
                "type": "Feature",
                "properties": {
                    "lineId": lid,
                    "operator": str(row["operator"]),
                    "lineName": str(row["lineName"]),
                    "segIdx": idx,
                    "railType": str(row["railType"]),
                },
                "geometry": row.geometry.__geo_interface__,
            }
        )
    lines_fc = {"type": "FeatureCollection", "features": out_features}

    # 駅データ
    print("駅データ読込...")
    stations = gpd.read_file(STATIONS_SRC)
    print(f"  features={len(stations)}")
    st_features = []
    for i, row in stations.iterrows():
        operator = normalize(str(row.get(F_OPERATOR, "")))
        line_name = normalize(str(row.get(F_LINENAME, "")))
        lid = f"{operator}__{line_name}"
        code = row.get(F_STATION_C)
        station_id = str(code) if code else f"st_{i}"
        centroid = row.geometry.centroid  # 駅はプラットフォームLineString → 重心を点に
        st_features.append(
            {
                "type": "Feature",
                "properties": {
                    "stationId": station_id,
                    "name": str(row.get(F_STATION, "")),
                    "lineId": lid,
                },
                "geometry": {"type": "Point", "coordinates": [round(centroid.x, 6), round(centroid.y, 6)]},
            }
        )
    stations_fc = {"type": "FeatureCollection", "features": st_features}

    # meta.json totals
    total_km = round(sum(m["lengthKm"] for m in meta_lines.values()), 1)
    by_rail: dict[str, float] = {}
    for m in meta_lines.values():
        by_rail[m["railType"]] = round(by_rail.get(m["railType"], 0.0) + m["lengthKm"], 1)
    meta = {
        "lines": meta_lines,
        "totals": {
            "lengthKm": total_km,
            "lineCount": len(meta_lines),
            "stationCount": len(st_features),
            "byPref": {},  # Phase 2
            "byRailType": by_rail,
        },
    }

    # 出力(minify)
    (OUT / "lines.geojson").write_text(
        json.dumps(lines_fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (OUT / "stations.geojson").write_text(
        json.dumps(stations_fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (OUT / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    # レポート
    print("\n=== 生成完了 ===")
    print(f"路線数(lineId): {len(meta_lines)}")
    print(f"駅数: {len(st_features)}")
    print(f"総延長: {total_km} km")
    print("railType別:")
    for k, v in sorted(by_rail.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v} km")


if __name__ == "__main__":
    main()

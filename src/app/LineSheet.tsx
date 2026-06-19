// 路線タップ時のボトムシート(SPEC §5.2)。app層。
import type { LineMeta, Ride } from "../types";

type Props = {
  lineId: string;
  meta: LineMeta;
  /** store の rides[lineId]。未乗なら null。 */
  ride: Ride | null;
  themeColor: string;
  /** 未乗 → 全区間乗った / partial → 全区間乗った / full → 取り消す */
  onToggle: () => void;
  /** partial 状態で全区間を一括取り消すとき */
  onRemove: () => void;
  /** バータップ時に区間単位でトグル */
  onToggleSegment: (segIdx: number) => void;
  onClose: () => void;
};

/** 区間乗車状態から CSS linear-gradient を生成。 */
function buildSegGradient(segCount: number, riddenSet: Set<number>, color: string): string {
  const unridden = "#3a3f4a";
  if (segCount === 0) return color;
  const stops: string[] = [];
  let cur = riddenSet.has(0) ? color : unridden;
  stops.push(`${cur} 0%`);
  for (let i = 1; i < segCount; i++) {
    const next = riddenSet.has(i) ? color : unridden;
    if (next !== cur) {
      const pct = ((i / segCount) * 100).toFixed(2);
      stops.push(`${cur} ${pct}%`, `${next} ${pct}%`);
      cur = next;
    }
  }
  stops.push(`${cur} 100%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function LineSheet({ meta, ride, themeColor, onToggle, onRemove, onToggleSegment, onClose }: Props) {
  const isFull = ride?.status === "full";
  const isPartial = ride?.status === "partial";
  const riddenSet = isFull
    ? new Set(Array.from({ length: meta.segCount }, (_, i) => i))
    : new Set(ride?.riddenSegments ?? []);
  const riddenCount = riddenSet.size;

  const partialKm = (riddenCount / (meta.segCount || 1)) * meta.lengthKm;
  const gradient = buildSegGradient(meta.segCount, riddenSet, themeColor);

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const segIdx = Math.max(0, Math.min(meta.segCount - 1, Math.floor(pct * meta.segCount)));
    onToggleSegment(segIdx);
  }

  return (
    <div className="absolute inset-x-0 bottom-14 z-40">
      <div className="mx-auto max-w-md rounded-t-[14px] bg-surface p-5 pb-7 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-text">{meta.lineName}</h2>
            <p className="truncate text-sm text-text-dim">{meta.operator}</p>
          </div>
          <button
            aria-label="閉じる"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-dim hover:bg-surface-2"
          >
            ✕
          </button>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <dt className="text-text-dim">総延長</dt>
            <dd className="tnum text-base font-semibold text-text">{meta.lengthKm.toFixed(1)} km</dd>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <dt className="text-text-dim">都道府県</dt>
            <dd className="text-base font-semibold text-text">
              {meta.pref.length ? meta.pref.join("・") : "—"}
            </dd>
          </div>
        </dl>

        {/* 区間バー */}
        {meta.segCount > 1 && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span>
                {riddenCount > 0 ? (
                  <>
                    <span className="tnum font-semibold" style={{ color: themeColor }}>
                      {riddenCount}
                    </span>
                    <span className="text-text-dim"> / {meta.segCount} 区間</span>
                  </>
                ) : (
                  <span className="text-text-dim">{meta.segCount} 区間</span>
                )}
              </span>
              {riddenCount > 0 && (
                <span className="tnum text-text-dim">{partialKm.toFixed(1)} km</span>
              )}
            </div>
            <div
              role="button"
              aria-label="区間をタップして乗車記録を切り替え"
              className="h-5 w-full cursor-pointer rounded"
              style={{ background: gradient }}
              onClick={handleBarClick}
            />
            <p className="mt-1 text-[10px] text-text-dim">バーをタップして区間を記録</p>
          </div>
        )}

        {/* メインアクションボタン */}
        {isFull ? (
          <button
            onClick={onToggle}
            className="min-h-[44px] w-full rounded-token border border-danger/60 py-3 font-semibold text-danger hover:bg-danger/10"
          >
            乗車を取り消す
          </button>
        ) : (
          <button
            onClick={onToggle}
            className="min-h-[44px] w-full rounded-token bg-accent-blue py-3 text-base font-bold text-bg hover:opacity-90"
          >
            🚃 {isPartial ? "全区間乗った！" : "乗った!"}
          </button>
        )}

        {/* partial 時: 全区間取り消す */}
        {isPartial && (
          <button
            onClick={onRemove}
            className="mt-2 min-h-[44px] w-full rounded-token border border-danger/60 py-3 font-semibold text-danger hover:bg-danger/10"
          >
            全区間取り消す
          </button>
        )}
      </div>
    </div>
  );
}

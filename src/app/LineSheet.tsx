// 路線タップ時のボトムシート(SPEC §5.2 のうち Phase1: 乗った!/取り消し)。app層。
import type { LineMeta } from "../types";

type Props = {
  lineId: string;
  meta: LineMeta;
  isRidden: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export function LineSheet({ meta, isRidden, onToggle, onClose }: Props) {
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

        {isRidden ? (
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
            🚃 乗った!
          </button>
        )}
      </div>
    </div>
  );
}

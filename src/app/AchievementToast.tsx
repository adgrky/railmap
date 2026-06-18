// 称号解除トースト(SPEC §7.2)。ゴールド縁取り・3秒・タップで称号画面。app層。
import { useEffect, useState } from "react";

type Props = {
  achievementName: string | null;
  onTap: () => void;
  onDismiss: () => void;
};

export function AchievementToast({ achievementName, onTap, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!achievementName) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, 3000);
    return () => clearTimeout(t);
  }, [achievementName, onDismiss]);

  if (!achievementName) return null;

  return (
    <div
      className={`absolute inset-x-4 z-50 transition-all duration-300 ${
        visible ? "bottom-20 opacity-100" : "-bottom-20 opacity-0"
      }`}
    >
      <button
        onClick={() => { setVisible(false); setTimeout(onTap, 150); }}
        className="w-full rounded-token px-4 py-3 text-left"
        style={{ background: "#151a23", border: "2px solid #fbbf24", boxShadow: "0 0 16px #fbbf2460" }}
      >
        <p className="font-bold" style={{ color: "#fbbf24" }}>
          🏆 称号獲得: {achievementName}
        </p>
        <p className="mt-0.5 text-xs text-text-dim">タップで称号一覧へ</p>
      </button>
    </div>
  );
}

// 称号画面(SPEC §5.4)。app層。
import type { AchievementDef } from "../core/achievements";
import type { SaveData } from "../types";

type Props = {
  defs: AchievementDef[];
  unlocked: SaveData["unlockedAchievements"];
  themeColor: string;
  onShareAchievement?: (id: string) => void;
};

export function AchievementsView({ defs, unlocked, themeColor, onShareAchievement }: Props) {
  return (
    <div className="h-full overflow-y-auto bg-bg pb-20">
      <div className="mx-auto max-w-md space-y-3 p-4">
        <p className="text-sm text-text-dim">
          解除済 {Object.keys(unlocked).length} / {defs.length}
        </p>
        {defs.map((def) => {
          const unlockedAt = unlocked[def.id];
          return (
            <button
              key={def.id}
              onClick={() => unlockedAt && onShareAchievement?.(def.id)}
              disabled={!unlockedAt}
              className={`w-full rounded-token p-4 text-left transition-opacity ${
                unlockedAt
                  ? "bg-surface hover:bg-surface-2"
                  : "cursor-default bg-surface opacity-50"
              }`}
              style={unlockedAt ? { boxShadow: `0 0 12px ${themeColor}40` } : undefined}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-2xl">{unlockedAt ? "🏆" : "🔒"}</span>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-bold"
                    style={{ color: unlockedAt ? themeColor : "#8b93a3" }}
                  >
                    {unlockedAt ? def.name : "???"}
                  </p>
                  <p className="mt-0.5 text-sm text-text-dim">{def.condition}</p>
                  {unlockedAt && (
                    <p className="mt-1 text-xs text-text-dim">
                      解除日: {new Date(unlockedAt).toLocaleDateString("ja-JP")}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

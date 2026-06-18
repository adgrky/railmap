// 効果音(§7.1): Web Audio API で合成。音源ファイル不使用・200ms以下。
// prefers-reduced-motion は呼び出し側で判定済みとして、ここは純粋に鳴らすだけ。

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** 短い「ポーン」(§7.1 §4)。音量・周波数はサイン波合成で生成。 */
export function playPon(): void {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    const t = ac.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.15);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.start(t);
    osc.stop(t + 0.2); // 200ms以下(§7.1)
  } catch {
    // AudioContext 失敗は無視
  }
}

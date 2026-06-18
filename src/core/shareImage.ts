// シェア画像生成(SPEC §10)。core層: app に依存しない。Canvas API 直書き。
// html2canvas は使わない(§1)。地図は map.getCanvas() から取得。
import { conversionText, formatRatio } from "./progress";

const W = 1200;
const H = 630;

type ShareImageOptions = {
  mapCanvas: HTMLCanvasElement;
  nationalRatio: number;
  riddenKm: number;
  themeColor: string;
  /** 称号バリアント: 中央に称号名+ゴールド枠(§10)。省略時は通常バリアント。 */
  achievementName?: string;
};

/** OGP(1200×630) PNG を生成して Blob を返す。2秒以内完了が要件(§10)。 */
export async function generateShareImage(opts: ShareImageOptions): Promise<Blob> {
  const { mapCanvas, nationalRatio, riddenKm, themeColor, achievementName } = opts;

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 背景
  ctx.fillStyle = "#0b0e14";
  ctx.fillRect(0, 0, W, H);

  // 地図スナップ(全画面にフィット、縦横比保持しつつ中央クロップ)
  const mapW = mapCanvas.width;
  const mapH = mapCanvas.height;
  const scale = Math.max(W / mapW, H / mapH);
  const dw = mapW * scale;
  const dh = mapH * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  ctx.globalAlpha = 0.7;
  ctx.drawImage(mapCanvas, dx, dy, dw, dh);
  ctx.globalAlpha = 1;

  // グラデーションオーバーレイ(下半分を暗く)
  const grad = ctx.createLinearGradient(0, H * 0.4, 0, H);
  grad.addColorStop(0, "rgba(11,14,20,0)");
  grad.addColorStop(1, "rgba(11,14,20,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (achievementName) {
    // --- 称号バリアント: 中央に称号名+ゴールド枠(§10) ---
    const bw = 700, bh = 120;
    const bx = (W - bw) / 2;
    const by = (H - bh) / 2;

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 20;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(11,14,20,0.85)";
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 36px -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`🏆 ${achievementName}`, W / 2, H / 2 - 8);

    ctx.fillStyle = "#8b93a3";
    ctx.font = "18px -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
    ctx.fillText("路線埋め立てマップで解除しました", W / 2, H / 2 + 34);
  } else {
    // --- 通常バリアント: 左下に達成率・右下にアプリ名(§10) ---

    // 左下: 全国%
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = themeColor;
    ctx.font = "bold 72px -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 16;
    ctx.fillText(`全国 ${formatRatio(nationalRatio)}`, 56, H - 96);
    ctx.shadowBlur = 0;

    // 左下: 走破距離 + 換算文言
    const subText = `総走破 ${riddenKm.toLocaleString("ja-JP", { maximumFractionDigits: 1 })} km　${conversionText(riddenKm)}`;
    ctx.fillStyle = "#e8ecf4";
    ctx.font = "24px -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
    ctx.fillText(subText, 56, H - 52);
  }

  // 右下: アプリ名(両バリアント共通)
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#8b93a3";
  ctx.font = "18px -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
  ctx.fillText("路線埋め立てマップ", W - 40, H - 40);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))), "image/png");
  });
}

/** PNG Blob を `filename.png` でダウンロードする。 */
export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Web Share API でシェア(未対応端末はダウンロードにフォールバック)。 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "路線埋め立てマップ" });
  } else {
    downloadPng(blob, filename);
  }
}

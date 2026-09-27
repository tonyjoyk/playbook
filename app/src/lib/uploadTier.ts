import type { UploadTier } from '../types';

/** Heuristic v1: high edge + colour variance → painterly. */
export async function classifyUploadTier(blob: Blob): Promise<UploadTier> {
  const bitmap = await createImageBitmap(blob);
  const maxSide = 256;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return 'folk-art';
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, w, h);
  let edgeSum = 0;
  let colorVar = 0;
  const samples: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      samples.push(lum);
      const li = ((y * w + (x - 1)) * 4);
      const ri = ((y * w + (x + 1)) * 4);
      const ui = (((y - 1) * w + x) * 4);
      const di = (((y + 1) * w + x) * 4);
      const gx =
        -0.299 * data[li] -
        0.587 * data[li + 1] -
        0.114 * data[li + 2] +
        0.299 * data[ri] +
        0.587 * data[ri + 1] +
        0.114 * data[ri + 2];
      const gy =
        -0.299 * data[ui] -
        0.587 * data[ui + 1] -
        0.114 * data[ui + 2] +
        0.299 * data[di] +
        0.587 * data[di + 1] +
        0.114 * data[di + 2];
      edgeSum += Math.hypot(gx, gy);
    }
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  for (const s of samples) colorVar += (s - mean) ** 2;
  colorVar /= samples.length;
  const edgeMean = edgeSum / samples.length;
  if (edgeMean > 18 && colorVar > 900) return 'painterly';
  if (edgeMean > 14 && colorVar > 650) return 'painterly';
  return 'folk-art';
}

export function effectiveUploadTier(
  tier: UploadTier,
  override: UploadTier | null | undefined
): UploadTier {
  return override ?? tier;
}

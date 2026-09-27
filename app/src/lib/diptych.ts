import type { EditRegion } from '../types';

export type RegionRect = { x: number; y: number; w: number; h: number };

/** Detect vertical gutter near center (low column variance). */
export function detectDiptychSplit(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): number | null {
  const mid = Math.floor(width / 2);
  const search = Math.floor(width * 0.08);
  let bestX = mid;
  let bestScore = Infinity;
  for (let x = mid - search; x <= mid + search; x++) {
    if (x < 2 || x >= width - 2) continue;
    let score = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      const li = (y * width + (x - 1)) * 4;
      const ri = (y * width + (x + 1)) * 4;
      score +=
        Math.abs(pixels[i] - pixels[li]) +
        Math.abs(pixels[i + 1] - pixels[li + 1]) +
        Math.abs(pixels[i + 2] - pixels[li + 2]) +
        Math.abs(pixels[i] - pixels[ri]) +
        Math.abs(pixels[i + 1] - pixels[ri + 1]) +
        Math.abs(pixels[i + 2] - pixels[ri + 2]);
    }
    score += Math.abs(x - mid) * 2;
    if (score < bestScore) {
      bestScore = score;
      bestX = x;
    }
  }
  const leftMean = columnMean(pixels, width, height, Math.floor(width * 0.25));
  const rightMean = columnMean(pixels, width, height, Math.floor(width * 0.75));
  const diff =
    Math.abs(leftMean[0] - rightMean[0]) +
    Math.abs(leftMean[1] - rightMean[1]) +
    Math.abs(leftMean[2] - rightMean[2]);
  if (diff < 40) return null;
  return bestX;
}

function columnMean(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number
): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = 0; y < height; y++) {
    const i = (y * width + x) * 4;
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
  }
  return [r / height, g / height, b / height];
}

export function regionBounds(
  region: EditRegion,
  width: number,
  height: number,
  splitX: number | null
): RegionRect {
  if (region === 'full' || splitX == null) {
    return { x: 0, y: 0, w: width, h: height };
  }
  if (region === 'left') return { x: 0, y: 0, w: splitX, h: height };
  return { x: splitX, y: 0, w: width - splitX, h: height };
}

export function clampPointToRegion(
  x: number,
  y: number,
  rect: RegionRect
): { x: number; y: number } {
  return {
    x: Math.max(rect.x, Math.min(rect.x + rect.w - 1, x)),
    y: Math.max(rect.y, Math.min(rect.y + rect.h - 1, y)),
  };
}

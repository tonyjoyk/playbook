import { countMaskComponents } from './segmentation';

export function alphaToMask(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i * 4 + 3] > 20 ? 255 : 0;
  }
  return mask;
}

/** Keep only the connected component containing (clickX, clickY). */
export function maskComponentAtClick(
  mask: Uint8Array,
  width: number,
  height: number,
  clickX: number,
  clickY: number
): Uint8Array | null {
  const cx = Math.max(0, Math.min(width - 1, Math.floor(clickX)));
  const cy = Math.max(0, Math.min(height - 1, Math.floor(clickY)));
  const seed = cy * width + cx;
  if (mask[seed] === 0) return null;

  const out = new Uint8Array(width * height);
  const stack = [seed];
  out[seed] = 255;
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % width;
    const y = (idx / width) | 0;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (mask[ni] === 0 || out[ni]) continue;
      out[ni] = 255;
      stack.push(ni);
    }
  }
  return out;
}

/** Paste crop-local mask into full canvas coordinates. */
export function pasteCropMask(
  cropMask: Uint8Array,
  cropW: number,
  cropH: number,
  canvasW: number,
  canvasH: number,
  offsetX: number,
  offsetY: number
): Uint8Array {
  const full = new Uint8Array(canvasW * canvasH);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      if (cropMask[y * cropW + x] === 0) continue;
      const fx = offsetX + x;
      const fy = offsetY + y;
      if (fx < 0 || fy < 0 || fx >= canvasW || fy >= canvasH) continue;
      full[fy * canvasW + fx] = 255;
    }
  }
  return full;
}

export function subtractPointsFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
  points: { x: number; y: number }[],
  pixels: Uint8ClampedArray
): void {
  for (const pt of points) {
    subtractRegion(mask, width, height, pt.x, pt.y, 38, pixels);
  }
}

function subtractRegion(
  mask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  threshold: number,
  pixels: Uint8ClampedArray
): void {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(cx)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(cy)));
  const seedIdx = y0 * width + x0;
  if (mask[seedIdx] === 0) return;
  const seedPi = seedIdx * 4;
  const stack = [seedIdx];
  mask[seedIdx] = 0;
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % width;
    const y = (idx / width) | 0;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (mask[ni] === 0) continue;
      const pi = ni * 4;
      const dr = pixels[pi] - pixels[seedPi];
      const dg = pixels[pi + 1] - pixels[seedPi + 1];
      const db = pixels[pi + 2] - pixels[seedPi + 2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > threshold) continue;
      mask[ni] = 0;
      stack.push(ni);
    }
  }
}

export function validateMaskForCrowd(
  mask: Uint8Array,
  width: number,
  height: number,
  maxAreaRatio = 0.35,
  maxComponents = 3
): void {
  const area = mask.reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
  const components = countMaskComponents(mask, width, height);
  if (components > maxComponents || area > width * height * maxAreaRatio) {
    throw new Error('Try clicking closer to the figure');
  }
}

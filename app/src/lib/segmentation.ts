/** Edge-aware region grow from click (deterministic SAM fallback / pre-ONNX path). */

export type Point = { x: number; y: number };

function colorDist(
  pixels: Uint8ClampedArray,
  _w: number,
  i: number,
  j: number
): number {
  const dr = pixels[i] - pixels[j];
  const dg = pixels[i + 1] - pixels[j + 1];
  const db = pixels[i + 2] - pixels[j + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function edgeStrength(pixels: Uint8ClampedArray, w: number, h: number, x: number, y: number): number {
  const idx = (y * w + x) * 4;
  const left = x > 0 ? (y * w + (x - 1)) * 4 : idx;
  const right = x + 1 < w ? (y * w + (x + 1)) * 4 : idx;
  const up = y > 0 ? ((y - 1) * w + x) * 4 : idx;
  const down = y + 1 < h ? ((y + 1) * w + x) * 4 : idx;
  const gx =
    -pixels[left] + pixels[right] - pixels[left + 1] + pixels[right + 1] - pixels[left + 2] + pixels[right + 2];
  const gy =
    -pixels[up] + pixels[down] - pixels[up + 1] + pixels[down + 1] - pixels[up + 2] + pixels[down + 2];
  return Math.hypot(gx, gy);
}

export function segmentFromClick(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  clickX: number,
  clickY: number,
  negativePoints: Point[] = [],
  opts?: { colorThreshold?: number; edgeThreshold?: number; maxAreaRatio?: number }
): Uint8Array {
  const colorThreshold = opts?.colorThreshold ?? 42;
  const edgeThreshold = opts?.edgeThreshold ?? 38;
  const maxArea = Math.floor(width * height * (opts?.maxAreaRatio ?? 0.35));

  const mask = new Uint8Array(width * height);
  const cx = Math.max(0, Math.min(width - 1, Math.floor(clickX)));
  const cy = Math.max(0, Math.min(height - 1, Math.floor(clickY)));
  const seedIdx = cy * width + cx;
  const seedPi = seedIdx * 4;

  const queue: number[] = [seedIdx];
  mask[seedIdx] = 1;
  let count = 1;

  while (queue.length > 0 && count < maxArea) {
    const idx = queue.pop()!;
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
      if (mask[ni]) continue;
      if (edgeStrength(pixels, width, height, nx, ny) > edgeThreshold) continue;
      const pi = ni * 4;
      if (colorDist(pixels, width, pi, seedPi) > colorThreshold) continue;
      mask[ni] = 1;
      count++;
      queue.push(ni);
    }
  }

  for (const neg of negativePoints) {
    subtractRegion(mask, width, height, neg.x, neg.y, colorThreshold * 0.8, pixels);
  }

  const out = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) out[i] = 255;
  }
  return out;
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
  if (!mask[seedIdx]) return;
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
      if (!mask[ni]) continue;
      const pi = ni * 4;
      if (colorDist(pixels, width, pi, seedPi) > threshold) continue;
      mask[ni] = 0;
      stack.push(ni);
    }
  }
}

export function maskBounds(mask: Uint8Array, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let area = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 0) continue;
      area++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, area, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function countMaskComponents(mask: Uint8Array, width: number, height: number): number {
  const seen = new Uint8Array(mask.length);
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0 || seen[i]) continue;
    count++;
    const stack = [i];
    seen[i] = 1;
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
        if (mask[ni] === 0 || seen[ni]) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
  }
  return count;
}

export function maskIoU(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] > 0;
    const bv = b[i] > 0;
    if (av && bv) inter++;
    if (av || bv) union++;
  }
  return union === 0 ? 0 : inter / union;
}

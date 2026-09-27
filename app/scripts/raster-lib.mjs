/** Shared deterministic segmentation/inpaint for raster gate scripts (mirrors src/lib). */

export function colorDist(pixels, i, j) {
  const dr = pixels[i] - pixels[j];
  const dg = pixels[i + 1] - pixels[j + 1];
  const db = pixels[i + 2] - pixels[j + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function edgeStrength(pixels, w, h, x, y) {
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
  pixels,
  width,
  height,
  clickX,
  clickY,
  negativePoints = [],
  opts = {}
) {
  const colorThreshold = opts.colorThreshold ?? 42;
  const edgeThreshold = opts.edgeThreshold ?? 38;
  const maxArea = Math.floor(width * height * (opts.maxAreaRatio ?? 0.35));

  const mask = new Uint8Array(width * height);
  const cx = Math.max(0, Math.min(width - 1, Math.floor(clickX)));
  const cy = Math.max(0, Math.min(height - 1, Math.floor(clickY)));
  const seedIdx = cy * width + cx;
  const seedPi = seedIdx * 4;

  const queue = [seedIdx];
  mask[seedIdx] = 1;
  let count = 1;

  while (queue.length > 0 && count < maxArea) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (mask[ni]) continue;
      if (edgeStrength(pixels, width, height, nx, ny) > edgeThreshold) continue;
      const pi = ni * 4;
      if (colorDist(pixels, pi, seedPi) > colorThreshold) continue;
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

function subtractRegion(mask, width, height, cx, cy, threshold, pixels) {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(cx)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(cy)));
  const seedIdx = y0 * width + x0;
  if (!mask[seedIdx]) return;
  const seedPi = seedIdx * 4;
  const stack = [seedIdx];
  mask[seedIdx] = 0;
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (!mask[ni]) continue;
      const pi = ni * 4;
      if (colorDist(pixels, pi, seedPi) > threshold) continue;
      mask[ni] = 0;
      stack.push(ni);
    }
  }
}

export function countMaskComponents(mask, width, height) {
  const seen = new Uint8Array(mask.length);
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0 || seen[i]) continue;
    count++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % width;
      const y = (idx / width) | 0;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
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

export function maskIoU(a, b) {
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

export function maskFromAlpha(png) {
  const { width, height, data } = png;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i * 4 + 3] > 127 ? 255 : 0;
  }
  return mask;
}

export function inpaintHole(pixels, width, height, holeMask) {
  const out = new Uint8ClampedArray(pixels);
  const toFill = new Uint8Array(width * height);
  let remaining = 0;
  for (let i = 0; i < holeMask.length; i++) {
    if (holeMask[i] > 0) {
      toFill[i] = 1;
      remaining++;
    }
  }
  if (remaining === 0) return out;

  const dist = new Float32Array(width * height).fill(Infinity);
  const queue = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (toFill[i]) continue;
      dist[i] = 0;
      queue.push(i);
    }
  }

  let q = 0;
  while (q < queue.length) {
    const idx = queue[q++];
    const x = idx % width;
    const y = (idx / width) | 0;
    const d = dist[idx] + 1;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (!toFill[ni] || d >= dist[ni]) continue;
      dist[ni] = d;
      queue.push(ni);
    }
  }

  const order = [...toFill.keys()].filter((i) => toFill[i]).sort((a, b) => dist[b] - dist[a]);

  for (const idx of order) {
    const x = idx % width;
    const y = (idx / width) | 0;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let wSum = 0;
    for (const [dx, dy, w] of [
      [-1, 0, 1],
      [1, 0, 1],
      [0, -1, 1],
      [0, 1, 1],
      [-1, -1, 0.7],
      [1, -1, 0.7],
      [-1, 1, 0.7],
      [1, 1, 0.7],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (toFill[ni]) continue;
      const pi = ni * 4;
      rSum += out[pi] * w;
      gSum += out[pi + 1] * w;
      bSum += out[pi + 2] * w;
      wSum += w;
    }
    if (wSum === 0) continue;
    const pi = idx * 4;
    out[pi] = Math.round(rSum / wSum);
    out[pi + 1] = Math.round(gSum / wSum);
    out[pi + 2] = Math.round(bSum / wSum);
    out[pi + 3] = 255;
    toFill[idx] = 0;
  }

  return out;
}

export function rgbSsim(a, b) {
  let n = 0;
  let sumA = 0;
  let sumB = 0;
  let sumAA = 0;
  let sumBB = 0;
  let sumAB = 0;
  for (let i = 0; i < a.length; i += 4) {
    const av = (a[i] + a[i + 1] + a[i + 2]) / 3;
    const bv = (b[i] + b[i + 1] + b[i + 2]) / 3;
    n++;
    sumA += av;
    sumB += bv;
    sumAA += av * av;
    sumBB += bv * bv;
    sumAB += av * bv;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  const varA = sumAA / n - meanA * meanA;
  const varB = sumBB / n - meanB * meanB;
  const cov = sumAB / n - meanA * meanB;
  const c1 = 6.5025;
  const c2 = 58.5225;
  return ((2 * meanA * meanB + c1) * (2 * cov + c2)) / ((meanA * meanA + meanB * meanB + c1) * (varA + varB + c2));
}

export function detectDiptychSplit(pixels, width, height) {
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

function columnMean(pixels, width, height, x) {
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

import { createHash } from 'node:crypto';

export function md5Hex(buf) {
  return createHash('md5').update(buf).digest('hex');
}

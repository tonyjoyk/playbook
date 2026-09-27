/** Deterministic hole fill (LaMa-class fallback — patch diffusion from border). */

export function inpaintHole(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  holeMask: Uint8Array
): Uint8ClampedArray {
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
  const queue: number[] = [];
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
    ] as const) {
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
    ] as const) {
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

/** Simple SSIM on RGB for smoke tests. */
export function rgbSsim(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
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

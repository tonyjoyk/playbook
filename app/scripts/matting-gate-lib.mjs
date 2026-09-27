/**
 * Shared matting gate helpers (mirrors app/src/lib matting crop + mask).
 */
import { PNG } from 'pngjs';
import removeBackground from '@imgly/background-removal-node';

export function cropRectAroundClick(imageWidth, imageHeight, clickX, clickY, cropSize, region) {
  const half = Math.floor(cropSize / 2);
  let x0 = Math.floor(clickX) - half;
  let y0 = Math.floor(clickY) - half;
  let w = cropSize;
  let h = cropSize;
  const regionRight = region.x + region.w;
  const regionBottom = region.y + region.h;
  if (x0 < region.x) x0 = region.x;
  if (y0 < region.y) y0 = region.y;
  if (x0 + w > regionRight) x0 = Math.max(region.x, regionRight - w);
  if (y0 + h > regionBottom) y0 = Math.max(region.y, regionBottom - h);
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x0 + w > imageWidth) x0 = Math.max(0, imageWidth - w);
  if (y0 + h > imageHeight) y0 = Math.max(0, imageHeight - h);
  w = Math.min(w, imageWidth - x0);
  h = Math.min(h, imageHeight - y0);
  return { x0, y0, width: w, height: h };
}

export function cropPixels(pixels, imageWidth, imageHeight, rect) {
  const crop = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const sx = rect.x0 + x;
      const sy = rect.y0 + y;
      const si = (y * rect.width + x) * 4;
      const pi = (sy * imageWidth + sx) * 4;
      crop[si] = pixels[pi];
      crop[si + 1] = pixels[pi + 1];
      crop[si + 2] = pixels[pi + 2];
      crop[si + 3] = pixels[pi + 3];
    }
  }
  return crop;
}

export function cropToPngBuffer(pixels, imageWidth, imageHeight, rect) {
  const png = new PNG({ width: rect.width, height: rect.height });
  const crop = cropPixels(pixels, imageWidth, imageHeight, rect);
  png.data.set(crop);
  return PNG.sync.write(png);
}

export function alphaToMask(data, width, height) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 20 ? 255 : 0;
  return mask;
}

export function maskComponentAtClick(mask, width, height, clickX, clickY) {
  const cx = Math.max(0, Math.min(width - 1, Math.floor(clickX)));
  const cy = Math.max(0, Math.min(height - 1, Math.floor(clickY)));
  const seed = cy * width + cx;
  if (mask[seed] === 0) return null;
  const out = new Uint8Array(width * height);
  const stack = [seed];
  out[seed] = 255;
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
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

export function pasteCropMask(cropMask, cropW, cropH, canvasW, canvasH, offsetX, offsetY) {
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
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
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

export async function mattingMaskAtClick(
  pixels,
  width,
  height,
  clickX,
  clickY,
  region,
  cropSize = 512,
  negativePoints = []
) {
  const rect = cropRectAroundClick(width, height, clickX, clickY, cropSize, region);
  const pngBuf = cropToPngBuffer(pixels, width, height, rect);
  const blob = new Blob([pngBuf], { type: 'image/png' });
  const resultBlob = await removeBackground(blob);
  const buf = Buffer.from(await resultBlob.arrayBuffer());
  const decoded = PNG.sync.read(buf);
  const cropMask = alphaToMask(decoded.data, decoded.width, decoded.height);
  const localX = clickX - rect.x0;
  const localY = clickY - rect.y0;
  const component = maskComponentAtClick(cropMask, decoded.width, decoded.height, localX, localY);
  if (!component) return null;
  let full = pasteCropMask(component, decoded.width, decoded.height, width, height, rect.x0, rect.y0);
  if (negativePoints.length) {
    subtractPoints(full, width, height, negativePoints, pixels);
  }
  return full;
}

function subtractPoints(mask, width, height, points, pixels) {
  for (const pt of points) {
    subtractRegion(mask, width, height, pt.x, pt.y, 38, pixels);
  }
}

function subtractRegion(mask, width, height, cx, cy, threshold, pixels) {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(cx)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(cy)));
  const seedIdx = y0 * width + x0;
  if (mask[seedIdx] === 0) return;
  const seedPi = seedIdx * 4;
  const stack = [seedIdx];
  mask[seedIdx] = 0;
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
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

export function maskFromAlphaPng(png) {
  const { width, height, data } = png;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 127 ? 255 : 0;
  return mask;
}

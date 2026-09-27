import { inpaintHole } from './inpaint';
import { maskBounds } from './segmentation';
import type { CompositeLayer } from '../types';
import { DEFAULT_TRANSFORM } from '../types';

export async function blobToImageData(blob: Blob): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const img = ctx.getImageData(0, 0, width, height);
  return { data: new Uint8ClampedArray(img.data.buffer), width, height };
}

export async function imageDataToBlob(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

export function extractLayerFromMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Uint8Array
): { layer: CompositeLayer; holeMask: Uint8Array; sprite: Uint8ClampedArray } | null {
  const bounds = maskBounds(mask, width, height);
  if (!bounds) return null;
  const { minX, minY, width: lw, height: lh } = bounds;
  const sprite = new Uint8ClampedArray(lw * lh * 4);
  const holeMask = new Uint8Array(width * height);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const sx = minX + x;
      const sy = minY + y;
      const mi = sy * width + sx;
      const alpha = mask[mi];
      if (alpha === 0) continue;
      const si = (y * lw + x) * 4;
      const pi = mi * 4;
      sprite[si] = pixels[pi];
      sprite[si + 1] = pixels[pi + 1];
      sprite[si + 2] = pixels[pi + 2];
      sprite[si + 3] = alpha;
      if (alpha > 127) holeMask[mi] = 255;
    }
  }
  const layer: CompositeLayer = {
    id: `layer-${crypto.randomUUID().slice(0, 8)}`,
    maskBlobId: '',
    spriteBlobId: '',
    originX: minX,
    originY: minY,
    width: lw,
    height: lh,
    transform: { ...DEFAULT_TRANSFORM },
    zIndex: 1,
  };
  return { layer, holeMask, sprite };
}

/** Build full-canvas hole mask from layer alpha at given transform offset. */
export function buildHoleMaskAtTransform(
  layer: CompositeLayer,
  layerAlpha: Uint8Array,
  canvasWidth: number,
  canvasHeight: number,
  tx: number,
  ty: number
): Uint8Array {
  const hole = new Uint8Array(canvasWidth * canvasHeight);
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const mi = y * layer.width + x;
      if (layerAlpha[mi] < 128) continue;
      const cx = layer.originX + tx + x;
      const cy = layer.originY + ty + y;
      if (cx < 0 || cy < 0 || cx >= canvasWidth || cy >= canvasHeight) continue;
      hole[cy * canvasWidth + cx] = 255;
    }
  }
  return hole;
}

export async function layerAlphaFromMaskBlob(maskBlob: Blob): Promise<Uint8Array> {
  const { data, width, height } = await blobToImageData(maskBlob);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = data[i * 4 + 3];
  }
  return alpha;
}

export async function cutHoleInBackground(
  backgroundBlob: Blob,
  holeMask: Uint8Array
): Promise<Blob> {
  const { data, width, height } = await blobToImageData(backgroundBlob);
  const cleared = new Uint8ClampedArray(data);
  for (let i = 0; i < holeMask.length; i++) {
    if (holeMask[i] === 0) continue;
    const pi = i * 4;
    cleared[pi + 3] = 0;
  }
  return imageDataToBlob(cleared, width, height);
}

export async function inpaintBackgroundBlob(
  backgroundBlob: Blob,
  holeMask: Uint8Array
): Promise<Blob> {
  const { data, width, height } = await blobToImageData(backgroundBlob);
  const filled = inpaintHole(data, width, height, holeMask);
  return imageDataToBlob(filled, width, height);
}

export async function renderCompositeToBlob(
  backgroundBlob: Blob,
  layers: CompositeLayer[],
  loadSprite: (layer: CompositeLayer) => Promise<Blob>
): Promise<Blob> {
  const bg = await blobToImageData(backgroundBlob);
  const canvas = new OffscreenCanvas(bg.width, bg.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(bg.data), bg.width, bg.height), 0, 0);
  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  for (const layer of sorted) {
    const spriteBlob = await loadSprite(layer);
    const bitmap = await createImageBitmap(spriteBlob);
    const { tx, ty, scale } = layer.transform;
    ctx.save();
    ctx.translate(layer.originX + tx, layer.originY + ty);
    ctx.scale(scale, scale);
    ctx.drawImage(bitmap, 0, 0);
    ctx.restore();
    bitmap.close();
  }
  return canvas.convertToBlob({ type: 'image/png' });
}

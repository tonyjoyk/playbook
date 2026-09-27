import type { RegionRect } from './diptych';

export type CropRect = {
  x0: number;
  y0: number;
  width: number;
  height: number;
};

/** Crop region centered on click, clamped to edit region and image bounds. */
export function cropRectAroundClick(
  imageWidth: number,
  imageHeight: number,
  clickX: number,
  clickY: number,
  cropSize: number,
  region: RegionRect
): CropRect {
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

export async function cropImageDataToBlob(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  _imageHeight: number,
  rect: CropRect
): Promise<Blob> {
  const canvas = new OffscreenCanvas(rect.width, rect.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const cropData = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const sx = rect.x0 + x;
      const sy = rect.y0 + y;
      const si = (y * rect.width + x) * 4;
      const pi = (sy * imageWidth + sx) * 4;
      cropData[si] = pixels[pi];
      cropData[si + 1] = pixels[pi + 1];
      cropData[si + 2] = pixels[pi + 2];
      cropData[si + 3] = pixels[pi + 3];
    }
  }
  ctx.putImageData(new ImageData(cropData, rect.width, rect.height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

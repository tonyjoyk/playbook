import { MAX_TRACE_EDGE } from './vtracerConfig';

export type PreparedImage = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
};

export async function prepareImageForTrace(blob: Blob): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(blob);
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longEdge > MAX_TRACE_EDGE ? MAX_TRACE_EDGE / longEdge : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas for tracing');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  return {
    pixels: imageData.data,
    width,
    height,
  };
}

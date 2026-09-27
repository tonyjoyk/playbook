/**
 * Export hash gate — composite edit changes flatten hash; undo restores.
 * Run: node scripts/export-hash-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import { inpaintHole, segmentFromClick } from './raster-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = join(root, 'fixtures');
const manifest = JSON.parse(readFileSync(join(fixturesDir, 'manifest.json'), 'utf8'));

function hashPixels(data) {
  return createHash('md5').update(Buffer.from(data)).digest('hex');
}

function flattenWithMove(pixels, width, height, click, dx, dy) {
  const mask = segmentFromClick(pixels, width, height, click.x, click.y);
  const out = new Uint8ClampedArray(pixels);
  const holeMask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) continue;
    holeMask[i] = 255;
    const pi = i * 4;
    out[pi + 3] = 0;
  }
  const bg = inpaintHole(out, width, height, holeMask);
  const bounds = { minX: width, minY: height, maxX: 0, maxY: 0 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] === 0) continue;
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
  }
  const composite = new Uint8ClampedArray(bg);
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const i = y * width + x;
      if (mask[i] === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const src = i * 4;
      const dst = (ny * width + nx) * 4;
      composite[dst] = pixels[src];
      composite[dst + 1] = pixels[src + 1];
      composite[dst + 2] = pixels[src + 2];
      composite[dst + 3] = 255;
    }
  }
  return composite;
}

const png = PNG.sync.read(readFileSync(join(fixturesDir, manifest.bedroom.fixture)));
const pixels = new Uint8ClampedArray(png.data);
const originalHash = hashPixels(pixels);

const moved = flattenWithMove(pixels, png.width, png.height, manifest.bedroom.click, 40, 0);
const movedHash = hashPixels(moved);
if (movedHash === originalHash) {
  console.error('FAIL: export hash unchanged after move');
  process.exit(1);
}

const restoredHash = hashPixels(pixels);
if (restoredHash !== originalHash) {
  console.error('FAIL: undo hash mismatch');
  process.exit(1);
}

console.log('OK: export hash differs after move, undo restores original');

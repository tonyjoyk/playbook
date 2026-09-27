/**
 * Diptych region gate — left edit must not change right half pixels.
 * Run: node scripts/diptych-region-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { detectDiptychSplit, inpaintHole, segmentFromClick } from './raster-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = join(root, 'fixtures');
const manifest = JSON.parse(readFileSync(join(fixturesDir, 'manifest.json'), 'utf8'));

const png = PNG.sync.read(readFileSync(join(fixturesDir, manifest.diptych.fixture)));
const pixels = new Uint8ClampedArray(png.data);
const { width, height } = png;

const splitX = detectDiptychSplit(pixels, width, height);
if (splitX == null || Math.abs(splitX - manifest.diptych.splitX) > 8) {
  console.error(`FAIL: diptych split detected ${splitX}, expected ~${manifest.diptych.splitX}`);
  process.exit(1);
}

const leftClick = manifest.bedroom.click;
const mask = segmentFromClick(pixels, width, height, leftClick.x, leftClick.y);
const holeMask = new Uint8Array(width * height);
for (let i = 0; i < mask.length; i++) {
  if (mask[i] > 0 && i % width < splitX) holeMask[i] = 255;
}

const edited = inpaintHole(pixels, width, height, holeMask);

let diffRight = 0;
for (let y = 0; y < height; y++) {
  for (let x = splitX; x < width; x++) {
    const pi = (y * width + x) * 4;
    if (
      edited[pi] !== pixels[pi] ||
      edited[pi + 1] !== pixels[pi + 1] ||
      edited[pi + 2] !== pixels[pi + 2]
    ) {
      diffRight++;
    }
  }
}

if (diffRight !== 0) {
  console.error(`FAIL: right half changed (${diffRight} pixels)`);
  process.exit(1);
}

console.log(`OK: diptych split at ${splitX}, right half unchanged after left inpaint`);
